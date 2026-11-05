import { describe, expect, it } from 'vitest'
import type { DomainEvent, RecordVersion } from '@oxeo/scheme'
import { clone, createJournal, domains, tick, type Scheme } from '../../server/tests/journal.fixture'
import { ClientChange, Tracker, UncoveredReadError, createClient } from '../lib'

/** Клиент над журналом: пакеты и вызовы — через копию, как по сети; поток — по подписке. */
const connectClient = (
  journal: ReturnType<typeof createJournal>,
  onResync?: (reason: string) => void
) => {
  const queries: unknown[] = []
  const client = createClient<Scheme, typeof domains>({
    transport: {
      query: async (batch) => {
        queries.push(clone(batch))
        return clone(await journal.server.query(clone(batch)))
      },
      call: async ({ domain, method, params }) => {
        return clone(await journal.server.run({ domain, method, params } as never, 'автор'))
      }
    },
    retries: [],
    countDelay: 0,
    onResync
  })

  journal.stream.add((event) => client.push(event))

  return { client, queries }
}

/** Проход рендера без React: что прочитано, чего не хватило, что вернуло тело. */
const pass = <R>(tracker: Tracker, body: () => R) => {
  return tracker.run(body)
}

describe('createClient', () => {
  it('чтение вне рендера: непокрытое — ошибка, load загружает и делает покрытым', async () => {
    const journal = createJournal()
    const { client } = connectClient(journal)

    await journal.server.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)
    await journal.server.run(
      { domain: 'notes', method: 'add', params: { text: 'a', authorId: 1 } },
      null
    )

    expect(() => client.data.note.all()).toThrow(UncoveredReadError)

    const notes = await client.data.note.load()

    expect(notes.map((note) => note.text)).toEqual(['a'])
    expect(client.data.note.all()).toHaveLength(1)
    // автор пришёл захватом по ссылке — покрыт без запроса
    expect(client.data.author.get(1)?.name).toBe('Аня')
    expect(() => client.data.author.get(2)).toThrow(UncoveredReadError)
  })

  it('проход собирает потребности в один пакет, второй проход видит данные', async () => {
    const journal = createJournal()
    const { client, queries } = connectClient(journal)
    const tracker = new Tracker()

    await journal.server.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)
    await journal.server.run(
      { domain: 'notes', method: 'add', params: { text: 'a', authorId: 1 } },
      null
    )

    const body = () => {
      const author = client.data.author.get(1)
      const notes = client.data.note.find({ authorId: 1 })
      const drafts = client.data.note.count({ status: 'draft' })

      return { name: author?.name ?? null, texts: notes.map((note) => note.text), drafts }
    }

    expect(pass(tracker, body)).toEqual({ name: null, texts: [], drafts: 0 })
    expect(tracker.needs.size).toBe(3)

    await client.request([...tracker.needs.values()])

    expect(queries).toHaveLength(1)
    expect(pass(tracker, body)).toEqual({ name: 'Аня', texts: ['a'], drafts: 1 })
    expect(tracker.needs.size).toBe(0)
    expect(tracker.records.get('author:1')).toEqual(new Set(['name']))
  })

  it('чужие изменения: подходящая запись входит в запрос, переставшая — выходит, удалённая — пропадает', async () => {
    const journal = createJournal()
    const { client } = connectClient(journal)
    const changes: ClientChange[] = []

    client.subscribe((change) => changes.push(change))

    await journal.server.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)
    await journal.server.run(
      { domain: 'notes', method: 'add', params: { text: 'a', authorId: 1 } },
      null
    )

    await client.data.note.load({ status: 'draft' })

    // смена 2 создаётся черновиком — входит; смена 1 опубликована — выходит
    await journal.server.run(
      { domain: 'notes', method: 'add', params: { text: 'b', authorId: 1 } },
      null
    )
    await journal.server.run({ domain: 'notes', method: 'publish', params: { noteId: 1 } }, null)
    await tick()

    expect(client.data.note.find({ status: 'draft' }).map((note) => note.noteId)).toEqual([2])

    await journal.server.run({ domain: 'notes', method: 'remove', params: { noteId: 2 } }, null)
    await tick()

    expect(client.data.note.find({ status: 'draft' })).toEqual([])
    expect(client.data.note.get(2)).toBeNull()
    expect(changes.some((change) => change.records.get('note:1')?.includes('status'))).toBe(true)
  })

  it('свой вызов: результат после применения, записи события сохраняются', async () => {
    const journal = createJournal()
    const { client } = connectClient(journal)

    const authorId = await client.DomainsAPI.notes.addAuthor({ name: 'Аня' })

    expect(authorId).toBe(1)
    expect(client.data.author.get(1)?.name).toBe('Аня')
    // чужой вызов: запись никто не ждёт — клиент её не держит
    await journal.server.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Боря' } }, null)
    await tick()

    expect(() => client.data.author.get(2)).toThrow(UncoveredReadError)
  })

  it('счётчик перезапрашивается после изменений коллекции', async () => {
    const journal = createJournal()
    const { client } = connectClient(journal)

    await journal.server.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)
    await client.request([{ kind: 'count', collection: 'author', where: null }])

    expect(client.data.author.count()).toBe(1)

    await journal.server.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Боря' } }, null)
    await tick(20)

    expect(client.data.author.count()).toBe(2)
  })

  it('пересинхронизация забывает всё и будит всех подписчиков', async () => {
    const journal = createJournal()
    const reasons: string[] = []
    const { client } = connectClient(journal, (reason) => reasons.push(reason))
    const tracker = new Tracker()

    await journal.server.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)
    await client.data.author.load()

    pass(tracker, () => client.data.author.all())

    const affected: boolean[] = []

    client.subscribe((change) => affected.push(tracker.isAffected(change)))
    client.resync('сервер: reset')

    expect(reasons).toEqual(['сервер: reset'])
    expect(affected).toEqual([true])
    expect(() => client.data.author.all()).toThrow(UncoveredReadError)
  })

  it('then и символы не становятся вызовами и коллекциями', async () => {
    const journal = createJournal()
    const { client } = connectClient(journal)

    await expect(Promise.resolve(client.DomainsAPI)).resolves.toBe(client.DomainsAPI)
    await expect(Promise.resolve(client.data)).resolves.toBe(client.data)
    expect(
      (client.DomainsAPI.notes as Record<PropertyKey, unknown>)[Symbol.toStringTag]
    ).toBeUndefined()
  })
})

describe('Tracker', () => {
  it('изменение касается прочитанных полей, состава запросов и коллекций', () => {
    const tracker = new Tracker()
    const record = { noteId: 1, text: 'a', status: 'draft' }

    tracker.run(() => {
      tracker.queries.add('find:note:{}')
      tracker.track('note:1', record).text
    })

    const change = (patch: Partial<ClientChange>): ClientChange => ({
      records: new Map(),
      queries: new Set(),
      collections: new Set(),
      everything: false,
      ...patch
    })

    expect(tracker.isAffected(change({ records: new Map([['note:1', ['status']]]) }))).toBe(false)
    expect(tracker.isAffected(change({ records: new Map([['note:1', ['text']]]) }))).toBe(true)
    expect(tracker.isAffected(change({ records: new Map([['note:1', null]]) }))).toBe(true)
    expect(tracker.isAffected(change({ queries: new Set(['find:note:{}']) }))).toBe(true)
    expect(tracker.isAffected(change({ everything: true }))).toBe(true)
  })
})

describe('поток и ответ вызова', () => {
  const note = (noteId: number, text: string): RecordVersion => ({
    collection: 'note',
    id: noteId,
    record: { noteId, text, status: 'draft', createdAt: 0, authorId: 1 }
  })

  const event = (revision: number, changes: RecordVersion[], epoch = 'e1'): DomainEvent => ({
    epoch,
    revision,
    domain: 'notes',
    method: 'publish',
    params: {},
    ctx: { actor: null, at: 0, today: '2026-01-01' },
    result: null,
    changes
  })

  /** Клиент над управляемым транспортом: заметки 1 и 2 загружены, ответ вызова отдаёт `pending.answer`. */
  const connect = async (onResync?: (reason: string) => void) => {
    const pending = { answer: (_: DomainEvent) => {} }
    const client = createClient<Scheme, typeof domains>({
      transport: {
        query: async () => ({ records: [note(1, 'a'), note(2, 'b')], results: [{ ids: [1, 2] }] }),
        call: () => {
          return new Promise((resolve) => {
            pending.answer = resolve
          })
        }
      },
      retries: [],
      onResync
    })

    await client.data.note.load()

    return { client, pending }
  }

  it('ответ вызова опоздал: поток дошёл дальше, и старая версия не затирает новую', async () => {
    const { client, pending } = await connect()
    const called = client.DomainsAPI.notes.publish({ noteId: 1 })

    client.push(event(1, [note(1, 'своя')]))
    client.push(event(2, [note(1, 'новее')]))
    pending.answer(event(1, [note(1, 'своя')]))

    await called

    expect(client.data.note.get(1)?.text).toBe('новее')
  })

  it('ответ вызова обогнал поток: своя версия — сразу, чужое событие не теряется', async () => {
    const { client, pending } = await connect()

    client.push(event(1, []))

    const called = client.DomainsAPI.notes.publish({ noteId: 1 })

    pending.answer(event(3, [note(1, 'своя')]))

    await called

    expect(client.data.note.get(1)?.text).toBe('своя')

    client.push(event(2, [note(1, 'чужая'), note(2, 'чужая')]))
    client.push(event(3, [note(1, 'своя')]))

    expect(client.data.note.get(1)?.text).toBe('своя')
    expect(client.data.note.get(2)?.text).toBe('чужая')
  })

  it('разрыв ревизий и смена эпохи ведут к пересинхронизации', async () => {
    const reasons: string[] = []
    const { client } = await connect((reason) => reasons.push(reason))

    client.push(event(1, []))
    client.push(event(3, []))

    expect(reasons).toEqual(['stream'])

    client.push(event(1, []))
    client.push(event(2, [], 'e2'))

    expect(reasons).toEqual(['stream', 'stream'])
  })
})
