import { describe, expect, it } from 'vitest'
import type { DomainEvent, QueryAnswer, RecordVersion } from '@oxeo/scheme'
import {
  clone,
  createRuntime,
  domains,
  tick,
  views,
  type Scheme
} from '../../server/tests/runtime.fixture'
import { createClient } from '../lib'
import type { BindingClient, Read } from '../lib'

/**
 * Ответ пакета и события, пришедшие, пока пакет был в пути. Сервер считает пакет мимо очереди вызовов, ответ и поток
 * идут разными каналами, поэтому событие операции может обогнать ответ, снятый до неё, и отстать от ответа, снятого
 * после. Клиент склеивает их так, чтобы итог не зависел от порядка прихода.
 */

/** Что клиент отдаёт без загрузки: покрытое — значение, непокрытое — `undefined`. */
const peek = <Db, Views, R>(client: BindingClient<Db, Views>, read: Read<Db, Views, R>) => {
  const pass = client.createTracker({ plain: true }).run(read)

  return pass.isComplete ? pass.value : undefined
}

/**
 * Клиент над рантаймом, чей ответ на пакет задерживается: сервер считает пакет сразу, а клиенту ответ уходит по
 * `release()`. Пока ответ в пути, тест выполняет операции, и их события доходят до клиента раньше ответа.
 */
const connectHeld = (fixture: ReturnType<typeof createRuntime>) => {
  const held: (() => void)[] = []
  const client = createClient<Scheme, typeof domains, typeof views>({
    transport: {
      query: async (batch) => {
        const answer = clone(await fixture.runtime.query(clone(batch), 'автор'))

        await new Promise<void>((resolve) => held.push(resolve))

        return answer
      },
      call: async ({ domain, method, params }) => {
        return clone(await fixture.runtime.run({ domain, method, params } as never, 'автор'))
      }
    },
    retries: [],
    refreshDelay: 0
  })

  fixture.stream.add((event) => client.push(event))

  /** Дождаться, пока сервер посчитает пакет и ответ встанет в ожидание. */
  const answered = async (count = 1) => {
    while (held.length < count) {
      await tick()
    }
  }

  /** Отдать клиенту все задержанные ответы. */
  const release = async () => {
    held.splice(0).forEach((resolve) => resolve())
    await tick()
  }

  return { client, answered, release }
}

/** Автор и заметки с временем создания по списку. */
const seed = async (fixture: ReturnType<typeof createRuntime>, times: number[]) => {
  await fixture.runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)

  for (const at of times) {
    await fixture.runtime.run(
      { domain: 'notes', method: 'add', params: { text: `${at}`, authorId: 1 } },
      null,
      { at }
    )
  }
}

const add = (fixture: ReturnType<typeof createRuntime>, text: string, at?: number) => {
  return fixture.runtime.run(
    { domain: 'notes', method: 'add', params: { text, authorId: 1 } },
    null,
    at === undefined ? {} : { at }
  )
}

const publish = (fixture: ReturnType<typeof createRuntime>, noteId: number) => {
  return fixture.runtime.run({ domain: 'notes', method: 'publish', params: { noteId } }, null)
}

const remove = (fixture: ReturnType<typeof createRuntime>, noteId: number) => {
  return fixture.runtime.run({ domain: 'notes', method: 'remove', params: { noteId } }, null)
}

describe('событие обогнало ответ пакета', () => {
  it('новая запись, подходящая под запрос в пути, входит в него', async () => {
    const fixture = createRuntime()
    const { client, answered, release } = connectHeld(fixture)

    await seed(fixture, [10])

    const read = client.read((db) => db.note.find({ authorId: 1 }))

    await answered()
    await add(fixture, 'новая')
    await release()
    await read

    expect(peek(client, (db) => db.note.find({ authorId: 1 }).map((note) => note.noteId))).toEqual([
      1, 2
    ])
  })

  it('окно: лучшая запись, созданная за время запроса, входит, худший член выходит', async () => {
    const fixture = createRuntime()
    const { client, answered, release } = connectHeld(fixture)
    const latest = { order: { field: 'createdAt', direction: 'desc' }, limit: 2 } as const

    await seed(fixture, [30, 10, 20])

    const read = client.read((db) => db.note.find({}, latest))

    await answered()
    await add(fixture, '40', 40)
    await release()
    await read

    expect(peek(client, (db) => db.note.find({}, latest).map((note) => note.noteId))).toEqual([4, 1])
  })

  it('ответ не затирает версию записи, которую принесло событие новее него', async () => {
    const fixture = createRuntime()
    const { client, answered, release } = connectHeld(fixture)

    await seed(fixture, [10])

    const known = client.read((db) => db.note.get(1))

    await answered()
    await release()
    await known

    const read = client.read((db) => db.note.find({ authorId: 1 }))

    await answered()
    await publish(fixture, 1)
    await release()
    await read

    expect(peek(client, (db) => db.note.get(1)?.status)).toBe('published')
  })

  it('запись, переставшая подходить за время запроса, в его состав не входит', async () => {
    const fixture = createRuntime()
    const { client, answered, release } = connectHeld(fixture)

    await seed(fixture, [10, 20])

    const read = client.read((db) => db.note.find({ status: 'draft' }))

    await answered()
    await publish(fixture, 1)
    await release()
    await read

    expect(peek(client, (db) => db.note.find({ status: 'draft' }).map((note) => note.noteId))).toEqual([
      2
    ])
    expect(peek(client, (db) => db.note.get(1)?.status)).toBe('published')
  })

  it('запись, удалённая за время запроса, пропадает и из записей, и из состава', async () => {
    const fixture = createRuntime()
    const { client, answered, release } = connectHeld(fixture)

    await seed(fixture, [10, 20])

    const read = client.read((db) => ({ notes: db.note.find({ authorId: 1 }), first: db.note.get(1) }))

    await answered()
    await remove(fixture, 1)
    await release()
    await read

    expect(peek(client, (db) => db.note.find({ authorId: 1 }).map((note) => note.noteId))).toEqual([2])
    expect(peek(client, (db) => db.note.get(1))).toBeNull()
  })

  it('перезапрос окна: запись, созданная, пока он в пути, остаётся в окне', async () => {
    const fixture = createRuntime()
    const { client, answered, release } = connectHeld(fixture)
    const latest = { order: { field: 'createdAt', direction: 'desc' }, limit: 2 } as const

    await seed(fixture, [30, 10, 20])

    const read = client.read((db) => db.note.find({}, latest))

    await answered()
    await release()
    await read

    // член полного окна ушёл — окно перезапрашивается; пока перезапрос в пути, приходит лучшая запись
    await remove(fixture, 1)
    await answered()
    await add(fixture, '40', 40)
    await release()

    expect(peek(client, (db) => db.note.find({}, latest).map((note) => note.noteId))).toEqual([4, 3])
  })

  it('запись по id, которой не было на момент ответа и которую создало событие, — есть', async () => {
    const fixture = createRuntime()
    const { client, answered, release } = connectHeld(fixture)

    await seed(fixture, [10])

    const read = client.read((db) => db.note.get(2))

    await answered()
    await add(fixture, 'вторая')
    await release()
    await read

    expect(peek(client, (db) => db.note.get(2)?.text)).toBe('вторая')
  })

  it('счётчик, тронутый событием за время запроса, перезапрашивается', async () => {
    const fixture = createRuntime()
    const { client, answered, release } = connectHeld(fixture)

    await seed(fixture, [10])

    const read = client.read((db) => db.note.count({ status: 'draft' }))

    await answered()
    await add(fixture, 'вторая')
    await release()
    await read

    expect(peek(client, (db) => db.note.count({ status: 'draft' }))).toBe(1)

    // перезапрос устаревшего: ответ тоже задержан
    await answered()
    await release()

    expect(peek(client, (db) => db.note.count({ status: 'draft' }))).toBe(2)
  })

  it('значение представления, чьи коллекции тронуло событие за время запроса, перезапрашивается', async () => {
    const fixture = createRuntime()
    const { client, answered, release } = connectHeld(fixture)
    const summary = { kind: 'view', view: 'notes', method: 'summary', params: { authorId: 1 } } as const

    await seed(fixture, [10, 20])

    const request = client.request([summary])

    await answered()
    await publish(fixture, 1)
    await release()
    await request
    await answered()
    await release()

    expect(peek(client, (_, values) => values.notes.summary({ authorId: 1 }))).toMatchObject({
      drafts: 1,
      published: 1
    })
  })

  it('свой вызов за время запроса: созданная запись входит в его состав', async () => {
    const fixture = createRuntime()
    const { client, answered, release } = connectHeld(fixture)

    await seed(fixture, [10])

    const read = client.read((db) => db.note.find({ authorId: 1 }))

    await answered()
    await client.DomainsAPI.notes.add({ text: 'своя', authorId: 1 })
    await release()
    await read

    expect(peek(client, (db) => db.note.find({ authorId: 1 }).map((note) => note.noteId))).toEqual([
      1, 2
    ])
  })

  it('пакеты в пути по очереди: каждый склеивается со своими событиями', async () => {
    const fixture = createRuntime()
    const { client, answered, release } = connectHeld(fixture)

    await seed(fixture, [10])

    const drafts = client.read((db) => db.note.find({ status: 'draft' }))

    await answered()
    await add(fixture, 'вторая')

    const all = client.read((db) => db.note.find({ authorId: 1 }))

    await answered(2)
    await publish(fixture, 1)
    await release()
    await Promise.all([drafts, all])

    expect(peek(client, (db) => db.note.find({ status: 'draft' }).map((note) => note.noteId))).toEqual([
      2
    ])
    expect(peek(client, (db) => db.note.find({ authorId: 1 }).map((note) => note.noteId))).toEqual([
      1, 2
    ])
  })
})

describe('событие отстало от ответа пакета', () => {
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

  /** Клиент, чей транспорт отдаёт ответы из очереди теста. */
  const connect = (answers: QueryAnswer[], onResync?: (reason: string) => void) => {
    const client = createClient<Scheme, typeof domains>({
      transport: {
        query: async () => answers.shift()!,
        call: async () => {
          throw new Error('вызовов в этих тестах нет')
        }
      },
      retries: [],
      refreshDelay: 0,
      onResync
    })

    return client
  }

  it('событие, которое ответ уже учёл, не возвращает старую версию', async () => {
    const client = connect([
      { epoch: 'e1', revision: 3, records: [note(1, 'v3')], results: [{ ids: [1] }] }
    ])

    // поток отстал от ответа: события 2 и 3 приходят после него
    client.push(event(1, []))
    await client.read((db) => db.note.find({ authorId: 1 }))
    client.push(event(2, [note(1, 'v2')]))

    expect(peek(client, (db) => db.note.get(1)?.text)).toBe('v3')

    client.push(event(3, [note(1, 'v3')]))
    client.push(event(4, [note(1, 'v4')]))

    expect(peek(client, (db) => db.note.get(1)?.text)).toBe('v4')
  })

  it('запись, которой в ответе уже нет, не возвращается из прежнего события', async () => {
    const client = connect([{ epoch: 'e1', revision: 3, records: [], results: [{ ids: [] }] }])

    // операция 2 создала заметку, операция 3 удалила; ответ снят после обеих, поток отстал
    client.push(event(1, []))
    await client.read((db) => db.note.find({ authorId: 1 }))
    client.push(event(2, [note(1, 'старая')]))

    expect(peek(client, (db) => db.note.find({ authorId: 1 }))).toEqual([])
    expect(peek(client, (db) => db.note.get(1))).toBeUndefined()

    client.push(event(3, [{ collection: 'note', id: 1, record: null }]))

    expect(peek(client, (db) => db.note.find({ authorId: 1 }))).toEqual([])
  })

  it('коллекция целиком: запись, которой в ответе уже нет, не возвращается из прежнего события', async () => {
    const client = connect([{ epoch: 'e1', revision: 3, records: [], results: [{ ids: [] }] }])

    client.push(event(1, []))
    await client.read((db) => db.note.all())
    client.push(event(2, [note(1, 'старая')]))

    expect(peek(client, (db) => db.note.all())).toEqual([])

    client.push(event(3, [{ collection: 'note', id: 1, record: null }]))
    client.push(event(4, [note(2, 'новая')]))

    expect(peek(client, (db) => db.note.all().map((item) => item.text))).toEqual(['новая'])
  })

  it('ответ другой эпохи — пересинхронизация: сервер перезапущен', async () => {
    const reasons: string[] = []
    const answer: QueryAnswer = {
      epoch: 'e2',
      revision: 0,
      records: [note(1, 'a')],
      results: [{ ids: [1] }]
    }
    const client = connect([answer, clone(answer)], (reason) => reasons.push(reason))

    client.push(event(1, [note(1, 'прежняя эпоха')]))

    // ответ новой эпохи не кладётся поверх прежней: клиент забывает всё, чтение запрашивает снова
    const notes = await client.read((db) => db.note.find({ authorId: 1 }))

    expect(reasons).toEqual(['epoch'])
    expect(notes.map((item) => item.text)).toEqual(['a'])
  })

  it('первое событие другой эпохи, чем ответ, — пересинхронизация', async () => {
    const reasons: string[] = []
    const client = connect(
      [{ epoch: 'e1', revision: 5, records: [note(1, 'a')], results: [{ ids: [1] }] }],
      (reason) => reasons.push(reason)
    )

    await client.read((db) => db.note.find({ authorId: 1 }))
    client.push(event(6, [], 'e2'))

    expect(reasons).toEqual(['stream'])
  })

  it('ответ без ревизии (сервер прежней версии) кладётся как есть', async () => {
    const client = connect([{ records: [note(1, 'ответ')], results: [{ ids: [1] }] } as QueryAnswer])

    client.push(event(1, [note(1, 'событие')]))
    await client.read((db) => db.note.find({ authorId: 1 }))

    expect(peek(client, (db) => db.note.get(1)?.text)).toBe('ответ')
  })
})
