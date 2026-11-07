import { describe, expect, it } from 'vitest'
import type { DomainEvent, Query, QueryAnswer, RecordVersion } from '@oxeo/scheme'
import {
  clone,
  createRuntime,
  domains,
  tick,
  viewRuns,
  views,
  type Scheme
} from '../../server/tests/runtime.fixture'
import { QueryFailedError, createClient } from '../lib'
import type { BindingClient, ClientChange, ClientOptions, Read } from '../lib'

/** Клиент над рантаймом: пакеты и вызовы — через копию, как по сети; поток — по подписке. */
const connectClient = (
  fixture: ReturnType<typeof createRuntime>,
  options: Partial<ClientOptions> = {}
) => {
  const queries: unknown[] = []
  const client = createClient<Scheme, typeof domains, typeof views>({
    transport: {
      query: async (batch) => {
        queries.push(clone(batch))
        return clone(await fixture.runtime.query(clone(batch), 'автор'))
      },
      call: async ({ domain, method, params }) => {
        return clone(await fixture.runtime.run({ domain, method, params } as never, 'автор'))
      }
    },
    retries: [],
    refreshDelay: 0,
    ...options
  })

  fixture.stream.add((event) => client.push(event))

  return { client, queries }
}

/** Что клиент отдаёт без загрузки: покрытое — значение, непокрытое — `undefined`. */
const peek = <Db, Views, R>(client: BindingClient<Db, Views>, read: Read<Db, Views, R>) => {
  const pass = client.createTracker({ plain: true }).run(read)

  return pass.isComplete ? pass.value : undefined
}

describe('createClient', () => {
  it('разовое чтение загружает непокрытое; записи по ссылкам приходят захватом', async () => {
    const fixture = createRuntime()
    const { client } = connectClient(fixture)

    await fixture.runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)
    await fixture.runtime.run(
      { domain: 'notes', method: 'add', params: { text: 'a', authorId: 1 } },
      null
    )

    expect(peek(client, (db) => db.note.all())).toBeUndefined()

    const notes = await client.read((db) => db.note.all())

    expect(notes.map((note) => note.text)).toEqual(['a'])
    expect(peek(client, (db) => db.note.all())).toHaveLength(1)
    // автор пришёл захватом по ссылке — покрыт без запроса
    expect(peek(client, (db) => db.author.get(1)?.name)).toBe('Аня')
    expect(peek(client, (db) => db.author.get(2))).toBeUndefined()
  })

  it('проход собирает потребности в один пакет, второй проход видит данные', async () => {
    const fixture = createRuntime()
    const { client, queries } = connectClient(fixture)
    const tracker = client.createTracker()

    await fixture.runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)
    await fixture.runtime.run(
      { domain: 'notes', method: 'add', params: { text: 'a', authorId: 1 } },
      null
    )

    const run = () => {
      return tracker.run((db) => {
        const author = db.author.get(1)
        const notes = db.note.find({ authorId: 1 })
        const drafts = db.note.count({ status: 'draft' })

        return { name: author?.name ?? null, texts: notes.map((note) => note.text), drafts }
      })
    }

    expect(run()).toEqual({ isComplete: false })
    expect(tracker.needs.size).toBe(3)

    await client.request([...tracker.needs.values()])

    expect(queries).toHaveLength(1)
    expect(run()).toEqual({ isComplete: true, value: { name: 'Аня', texts: ['a'], drafts: 1 } })
    expect(tracker.needs.size).toBe(0)
    expect(tracker.records.get('author:1')).toEqual(new Set(['name']))
  })

  it('чужие изменения: подходящая запись входит в запрос, переставшая — выходит, удалённая — пропадает', async () => {
    const fixture = createRuntime()
    const { client } = connectClient(fixture)
    const changes: ClientChange[] = []

    client.subscribe((change) => changes.push(change))

    await fixture.runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)
    await fixture.runtime.run(
      { domain: 'notes', method: 'add', params: { text: 'a', authorId: 1 } },
      null
    )

    await client.read((db) => db.note.find({ status: 'draft' }))

    // смена 2 создаётся черновиком — входит; смена 1 опубликована — выходит
    await fixture.runtime.run(
      { domain: 'notes', method: 'add', params: { text: 'b', authorId: 1 } },
      null
    )
    await fixture.runtime.run({ domain: 'notes', method: 'publish', params: { noteId: 1 } }, null)
    await tick()

    const drafts = peek(client, (db) => db.note.find({ status: 'draft' }))

    expect(drafts?.map((note) => note.noteId)).toEqual([2])

    await fixture.runtime.run({ domain: 'notes', method: 'remove', params: { noteId: 2 } }, null)
    await tick()

    expect(peek(client, (db) => db.note.find({ status: 'draft' }))).toEqual([])
    expect(peek(client, (db) => db.note.get(2))).toBeNull()
    expect(changes.some((change) => change.records.get('note:1')?.includes('status'))).toBe(true)
  })

  it('свой вызов: результат после применения, записи события сохраняются', async () => {
    const fixture = createRuntime()
    const { client } = connectClient(fixture)

    const authorId = await client.DomainsAPI.notes.addAuthor({ name: 'Аня' })

    expect(authorId).toBe(1)
    expect(peek(client, (db) => db.author.get(1)?.name)).toBe('Аня')
    // чужой вызов: запись никто не ждёт — клиент её не держит
    await fixture.runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Боря' } }, null)
    await tick()

    expect(peek(client, (db) => db.author.get(2))).toBeUndefined()
  })

  it('счётчик перезапрашивается после изменений коллекции', async () => {
    const fixture = createRuntime()
    const { client } = connectClient(fixture)

    await fixture.runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)
    await client.request([{ kind: 'count', collection: 'author', where: null }])

    expect(peek(client, (db) => db.author.count())).toBe(1)

    await fixture.runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Боря' } }, null)
    await tick(20)

    expect(peek(client, (db) => db.author.count())).toBe(2)
  })

  it('пересинхронизация забывает всё и будит всех подписчиков', async () => {
    const fixture = createRuntime()
    const reasons: string[] = []
    const onResync = (reason: string) => reasons.push(reason)
    const { client } = connectClient(fixture, { onResync })
    const tracker = client.createTracker()

    await fixture.runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)
    await client.read((db) => db.author.all())

    tracker.run((db) => db.author.all())

    const affected: boolean[] = []

    client.subscribe((change) => affected.push(tracker.isAffected(change)))
    client.resync('сервер: reset')

    expect(reasons).toEqual(['сервер: reset'])
    expect(affected).toEqual([true])
    expect(peek(client, (db) => db.author.all())).toBeUndefined()
  })

  it('then и символы не становятся вызовами и коллекциями', async () => {
    const fixture = createRuntime()
    const { client } = connectClient(fixture)

    await expect(Promise.resolve(client.DomainsAPI)).resolves.toBe(client.DomainsAPI)
    // промис разрешается самим `db`: иначе `then` стал бы коллекцией
    await expect(client.read((db) => db)).resolves.toBeDefined()
    expect(
      (client.DomainsAPI.notes as Record<PropertyKey, unknown>)[Symbol.toStringTag]
    ).toBeUndefined()
  })
})

describe('Tracker', () => {
  it('изменение касается прочитанных полей, состава запросов и коллекций', () => {
    const { client } = connectClient(createRuntime())
    const tracker = client.createTracker()
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

    tracker.release()

    expect(tracker.isAffected(change({ everything: true }))).toBe(false)
  })

  it('db живёт только в проходе: сохранённая ссылка закрыта', () => {
    const { client } = connectClient(createRuntime())
    const tracker = client.createTracker()
    const saved: { db: { note: { all: () => object[] } } | null } = { db: null }

    tracker.run((db) => {
      saved.db = db
    })

    expect(() => saved.db?.note.all()).toThrow('внутри колбэка')
  })

  it('ошибка прохода на пустых данных выбрасывается, ошибка полного прохода идёт наверх', async () => {
    const fixture = createRuntime()
    const { client } = connectClient(fixture)
    const tracker = client.createTracker()

    await fixture.runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)

    const run = () => {
      return tracker.run((db) => {
        const author = db.author.get(1)

        return author!.name.toUpperCase()
      })
    }

    expect(run()).toEqual({ isComplete: false })

    await client.request([...tracker.needs.values()])

    expect(run()).toEqual({ isComplete: true, value: 'АНЯ' })

    expect(() => {
      tracker.run(() => {
        throw new Error('настоящая')
      })
    }).toThrow('настоящая')
  })
})

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

describe('пересинхронизация и пакеты в полёте', () => {
  const notes: Query = { kind: 'find', collection: 'note', where: null }

  /** Клиент над транспортом, ответы которого отдаёт тест: пакет — `answers[i]`, отказ — `refusals[i]`. */
  const connect = () => {
    const answers: ((answer: QueryAnswer) => void)[] = []
    const refusals: ((error: Error) => void)[] = []
    const client = createClient<Scheme, typeof domains>({
      transport: {
        query: () => {
          return new Promise((resolve, reject) => {
            answers.push(resolve)
            refusals.push(reject)
          })
        },
        call: async () => {
          throw new Error('вызовов в этих тестах нет')
        }
      },
      retries: [],
      refreshDelay: 0
    })

    return { client, answers, refusals }
  }

  it('ответ старого пакета не кладётся, а новое чтение уходит новым пакетом', async () => {
    const { client, answers } = connect()
    const first = client.request([notes])

    await tick()
    client.resync('тест')

    const second = client.request([notes])

    await tick()
    expect(answers).toHaveLength(2)

    answers[0]({ records: [note(1, 'старая')], results: [{ ids: [1] }] })
    await first

    expect(peek(client, (db) => db.note.all())).toBeUndefined()

    answers[1]({ records: [note(1, 'новая')], results: [{ ids: [1] }] })
    await second

    expect(peek(client, (db) => db.note.get(1)?.text)).toBe('новая')
  })

  it('отказ старого пакета не становится отказом нового состояния', async () => {
    const { client, refusals } = connect()
    const tracker = client.createTracker()
    const run = () => tracker.run((db) => db.note.all())

    run()

    const request = client.request([...tracker.needs.values()])

    await tick()
    client.resync('тест')
    refusals[0](new Error('упал'))
    await request

    run()

    expect(tracker.failures.size).toBe(0)
    expect(tracker.needs.size).toBe(1)
  })

  it('успех старого пакета не снимает отказ нового состояния', async () => {
    const { client, answers, refusals } = connect()
    const tracker = client.createTracker()
    const run = () => tracker.run((db) => db.note.all())

    run()

    const needs = [...tracker.needs.values()]
    const first = client.request(needs)

    await tick()
    client.resync('тест')

    const second = client.request(needs)

    await tick()
    refusals[1](new Error('упал'))
    await expect(second).rejects.toThrow('упал')

    answers[0]({ records: [], results: [{ ids: [] }] })
    await first

    run()

    expect(tracker.failures.size).toBe(1)
  })

  it('разовое чтение через пересинхронизацию запрашивает снова', async () => {
    const { client, answers } = connect()
    const loading = client.read((db) => db.note.all())

    await tick()
    client.resync('тест')
    answers[0]({ records: [note(1, 'старая')], results: [{ ids: [1] }] })
    await tick(5)

    expect(answers).toHaveLength(2)

    answers[1]({ records: [note(1, 'новая')], results: [{ ids: [1] }] })

    const loaded = await loading

    expect(loaded.map((item) => item.text)).toEqual(['новая'])
  })

  it('число старого перезапроса счётчика не кладётся', async () => {
    const { client, answers } = connect()
    const loaded = client.request([{ kind: 'count', collection: 'note', where: null }])

    await tick()
    answers[0]({ records: [], results: [{ count: 1 }] })
    await loaded

    client.push(event(1, [note(1, 'a')]))
    await tick(5)
    client.resync('тест')
    answers[1]({ records: [], results: [{ count: 2 }] })
    await tick()

    expect(peek(client, (db) => db.note.count())).toBeUndefined()
  })

  it('сборщик замечает изменения после прохода: подписка появляется позже него', () => {
    const { client } = connect()
    const tracker = client.createTracker()

    tracker.run(() => null)
    expect(tracker.hasMissedChanges()).toBe(false)

    client.push(event(1, []))
    expect(tracker.hasMissedChanges()).toBe(true)

    tracker.run(() => null)
    expect(tracker.hasMissedChanges()).toBe(false)
  })
})

describe('поток и ответ вызова', () => {
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

    await client.read((db) => db.note.all())

    return { client, pending }
  }

  it('ответ вызова опоздал: поток дошёл дальше, и старая версия не затирает новую', async () => {
    const { client, pending } = await connect()
    const called = client.DomainsAPI.notes.publish({ noteId: 1 })

    client.push(event(1, [note(1, 'своя')]))
    client.push(event(2, [note(1, 'новее')]))
    pending.answer(event(1, [note(1, 'своя')]))

    await called

    expect(peek(client, (db) => db.note.get(1)?.text)).toBe('новее')
  })

  it('ответ вызова обогнал поток: своя версия — сразу, чужое событие не теряется', async () => {
    const { client, pending } = await connect()

    client.push(event(1, []))

    const called = client.DomainsAPI.notes.publish({ noteId: 1 })

    pending.answer(event(3, [note(1, 'своя')]))

    await called

    expect(peek(client, (db) => db.note.get(1)?.text)).toBe('своя')

    client.push(event(2, [note(1, 'чужая'), note(2, 'чужая')]))
    client.push(event(3, [note(1, 'своя')]))

    expect(peek(client, (db) => db.note.get(1)?.text)).toBe('своя')
    expect(peek(client, (db) => db.note.get(2)?.text)).toBe('чужая')
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

describe('окна find и представления', () => {
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

  const latest = { order: { field: 'createdAt', direction: 'desc' }, limit: 2 } as const

  it('окно: лучшая новая запись входит без запроса, худший член выходит', async () => {
    const fixture = createRuntime()
    const { client, queries } = connectClient(fixture)

    await seed(fixture, [30, 10, 20])
    await client.read((db) => db.note.find({}, latest))

    const before = peek(client, (db) => db.note.find({}, latest))

    expect(before?.map((note) => note.noteId)).toEqual([1, 3])

    // хуже худшего — окно не меняется; лучше — входит, худший выходит
    await fixture.runtime.run(
      { domain: 'notes', method: 'add', params: { text: '5', authorId: 1 } },
      null,
      {
        at: 5
      }
    )
    await fixture.runtime.run(
      { domain: 'notes', method: 'add', params: { text: '40', authorId: 1 } },
      null,
      {
        at: 40
      }
    )
    await tick()

    const after = peek(client, (db) => db.note.find({}, latest))

    expect(after?.map((note) => note.noteId)).toEqual([5, 1])
    expect(queries).toHaveLength(1)
  })

  it('окно: ушедший член полного окна — перезапрос, до ответа — прежний состав без него', async () => {
    const fixture = createRuntime()
    const { client, queries } = connectClient(fixture)

    await seed(fixture, [30, 10, 20])
    await client.read((db) => db.note.find({}, latest))
    await fixture.runtime.run({ domain: 'notes', method: 'remove', params: { noteId: 1 } }, null)

    const left = peek(client, (db) => db.note.find({}, latest))

    expect(left?.map((note) => note.noteId)).toEqual([3])

    await tick(20)

    const refreshed = peek(client, (db) => db.note.find({}, latest))

    expect(refreshed?.map((note) => note.noteId)).toEqual([3, 2])
    expect(queries).toHaveLength(2)
  })

  it('окно над коллекцией целиком считается на месте', async () => {
    const fixture = createRuntime()
    const { client, queries } = connectClient(fixture)

    await seed(fixture, [30, 10, 20])
    await client.read((db) => db.note.all())

    const oldest = peek(client, (db) => {
      return db.note.find(
        { status: 'draft' },
        { order: { field: 'createdAt', direction: 'asc' }, limit: 1 }
      )
    })

    expect(oldest?.map((note) => note.noteId)).toEqual([2])
    expect(queries).toHaveLength(1)
  })

  it('представление: потребность прохода, значение, перезапрос после события по прочитанной коллекции', async () => {
    const fixture = createRuntime()
    const { client, queries } = connectClient(fixture)
    const tracker = client.createTracker()
    const changes: ClientChange[] = []

    await seed(fixture, [30, 10])

    const run = () => tracker.run((_, views) => views.notes.summary({ authorId: 1 }))

    expect(run()).toEqual({ isComplete: false })
    expect([...tracker.needs.values()]).toEqual([
      { kind: 'view', view: 'notes', method: 'summary', params: { authorId: 1 } }
    ])

    await client.request([...tracker.needs.values()])

    expect(run()).toEqual({
      isComplete: true,
      value: { author: 'Аня', drafts: 2, published: 0, viewer: 'автор' }
    })

    client.subscribe((change) => changes.push(change))

    const runs = viewRuns.count

    await fixture.runtime.run({ domain: 'notes', method: 'publish', params: { noteId: 1 } }, null)
    await tick(20)

    const summary = peek(client, (_, views) => views.notes.summary({ authorId: 1 }))

    expect(summary).toMatchObject({ drafts: 1, published: 1 })
    expect(viewRuns.count).toBe(runs + 1)
    expect(queries).toHaveLength(2)
    expect(changes.some((change) => tracker.isAffected(change))).toBe(true)
  })

  it('значение представления: покрыто после загрузки, пересинхронизация забывает', async () => {
    const fixture = createRuntime()
    const { client } = connectClient(fixture)

    await seed(fixture, [30])

    expect(peek(client, (_, views) => views.notes.summary({ authorId: 1 }))).toBeUndefined()

    await client.request([{ kind: 'view', view: 'notes', method: 'summary', params: { authorId: 1 } }])

    const summary = peek(client, (_, views) => views.notes.summary({ authorId: 1 }))

    expect(summary).toMatchObject({ drafts: 1 })

    client.resync('сервер: reset')

    expect(peek(client, (_, views) => views.notes.summary({ authorId: 1 }))).toBeUndefined()
  })
})

describe('отказ запроса', () => {
  it('отказ одного запроса — только его ключ; соседи пакета покрыты; повтор забывает отказ', async () => {
    const fixture = createRuntime()
    const { client, queries } = connectClient(fixture)
    const tracker = client.createTracker()

    await fixture.runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)

    const run = () => {
      return tracker.run((db, views) => {
        return { authors: db.author.all().length, crash: views.notes.crash({}) }
      })
    }

    run()
    await client.request([...tracker.needs.values()])

    expect(queries).toHaveLength(1)
    expect(run()).toEqual({ isComplete: false })
    expect([...tracker.failures.keys()]).toEqual(['view:notes.crash:{}'])
    expect(tracker.needs.size).toBe(0)

    // повтор: отказ забыт — проход снова собирает запрос как потребность
    client.forgetFailures([...tracker.failures.keys()])
    run()

    expect(tracker.failures.size).toBe(0)
    expect(tracker.needs.size).toBe(1)
  })

  it('разовое чтение отказавшего запроса бросает QueryFailedError с кодом сервера', async () => {
    const fixture = createRuntime()
    const { client } = connectClient(fixture)
    const ghost = (db: unknown) => (db as Record<string, { all: () => object[] }>).ghost.all()

    await expect(client.read(ghost)).rejects.toBeInstanceOf(QueryFailedError)
    await expect(client.read(ghost)).rejects.toMatchObject({ code: 'notFound' })
  })

  it('прежний отказ разовому чтению не мешает: оно запрашивает заново', async () => {
    const fixture = createRuntime()
    const state = { isBroken: true }
    const client = createClient<Scheme, typeof domains>({
      transport: {
        query: async (batch) => {
          if (state.isBroken) {
            throw new Error('нет связи')
          }

          return clone(await fixture.runtime.query(clone(batch), 'автор'))
        },
        call: async () => {
          throw new Error('вызовов в этом тесте нет')
        }
      },
      retries: []
    })

    await expect(client.read((db) => db.note.all())).rejects.toThrow('нет связи')

    state.isBroken = false

    await expect(client.read((db) => db.note.all())).resolves.toEqual([])
  })
})

describe('разовое чтение', () => {
  it('зависимые чтения догружаются проходами, записи — простые объекты', async () => {
    const fixture = createRuntime()
    const { client, queries } = connectClient(fixture)

    await fixture.runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)
    await fixture.runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Боря' } }, null)
    await fixture.runtime.run(
      { domain: 'notes', method: 'add', params: { text: 'a', authorId: 2 } },
      null
    )

    const author = await client.read((db) => {
      const [first] = db.note.find({ text: 'a' })

      return first ? db.author.find({ authorId: first.authorId }) : []
    })

    expect(author.map((item) => item.name)).toEqual(['Боря'])
    expect(queries).toHaveLength(2)
    // прокси structuredClone не копирует
    expect(structuredClone(author)).toEqual(author)
  })

  it('покрытое разрешается без запроса', async () => {
    const fixture = createRuntime()
    const { client, queries } = connectClient(fixture)

    await fixture.runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)
    await client.read((db) => db.author.all())
    await client.read((db) => db.author.get(1))

    expect(queries).toHaveLength(1)
  })
})

describe('onReadError', () => {
  /** Клиент над транспортом, который всегда отказывает, и отчёты `onReadError`. */
  const connect = () => {
    const errors: Error[] = []
    const client = createClient<Scheme, typeof domains>({
      transport: {
        query: async () => {
          throw new Error('нет связи')
        },
        call: async () => {
          throw new Error('вызовов в этих тестах нет')
        }
      },
      retries: [],
      onReadError: (error) => errors.push(error)
    })

    return { client, errors }
  }

  it('отказ пакета — один вызов на пакет', async () => {
    const { client, errors } = connect()
    const tracker = client.createTracker()

    tracker.run((db) => [db.note.all(), db.author.all()])

    await expect(client.request([...tracker.needs.values()])).rejects.toThrow('нет связи')

    expect(errors.map((error) => error.message)).toEqual(['нет связи'])
  })

  it('отказ запроса сервером — тоже, соседи пакета ответ получают', async () => {
    const fixture = createRuntime()
    const errors: Error[] = []
    const { client } = connectClient(fixture, { onReadError: (error) => errors.push(error) })
    const tracker = client.createTracker()

    tracker.run((db, views) => [db.author.all(), views.notes.crash({})])

    await client.request([...tracker.needs.values()])

    expect(errors).toHaveLength(1)
    expect(errors[0]).toBeInstanceOf(QueryFailedError)
  })

  it('разовое чтение получает отказ промисом и сюда не приходит', async () => {
    const { client, errors } = connect()

    await expect(client.read((db) => db.note.all())).rejects.toThrow('нет связи')

    expect(errors).toEqual([])
  })
})

describe('заморозка в разработке', () => {
  interface DetailedNote {
    noteId: number
    text: string
    tags: string[]
    meta: { color: string }
  }

  const readNote: Read<any, any, DetailedNote> = (db) => db.note.get(1)
  const readSummary: Read<any, any, { list: number[] }> = (_, views) => views.notes.summary({})

  /** Клиент, которому сервер отдаёт заметку с вложенными данными и значение представления. */
  const connect = () => {
    return createClient<any, any, any>({
      transport: {
        query: async ({ queries }) => {
          const record = { noteId: 1, text: 'a', tags: ['x'], meta: { color: 'red' } }
          const results = queries.map((query) => {
            return query.kind === 'view' ? { value: { list: [1, 2] }, reads: [] } : { ids: [1] }
          })

          return { records: [{ collection: 'note', id: 1, record }], results }
        },
        call: async () => {
          throw new Error('вызовов в этих тестах нет')
        }
      },
      retries: []
    })
  }

  it('запись заморожена целиком, вложенные данные — тоже', async () => {
    const client = connect()
    const note = await client.read(readNote)

    expect(Object.isFrozen(note)).toBe(true)
    expect(Object.isFrozen(note.tags)).toBe(true)
    expect(Object.isFrozen(note.meta)).toBe(true)
    expect(() => note.tags.push('y')).toThrow(TypeError)
  })

  it('прокси читает замороженную запись и не даёт писать', async () => {
    const client = connect()
    const tracker = client.createTracker()

    tracker.run(readNote)
    await client.request([...tracker.needs.values()])

    const pass = tracker.run(readNote)

    if (!pass.isComplete) {
      throw new Error('запись не загрузилась')
    }

    expect(pass.value.tags).toEqual(['x'])

    expect(() => {
      pass.value.text = 'b'
    }).toThrow(TypeError)
  })

  it('значение представления заморожено', async () => {
    const client = connect()
    const value = await client.read(readSummary)

    expect(() => value.list.sort()).toThrow(TypeError)
  })

  it('новая версия записи кладётся как обычно, копия свободна', async () => {
    const client = connect()
    const first = await client.read(readNote)
    const copy = structuredClone(first)

    copy.tags.push('y')

    client.push(event(1, []))
    client.push(event(2, [{ collection: 'note', id: 1, record: { ...first, text: 'b' } }]))

    expect(copy.tags).toEqual(['x', 'y'])
    expect(peek(client, readNote)?.text).toBe('b')
  })

  it('в production записи не заморожены', async () => {
    const env = process.env.NODE_ENV

    process.env.NODE_ENV = 'production'

    try {
      const note = await connect().read((db) => db.note.get(1))

      expect(Object.isFrozen(note)).toBe(false)
    } finally {
      process.env.NODE_ENV = env
    }
  })
})
