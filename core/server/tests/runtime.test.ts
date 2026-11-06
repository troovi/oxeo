import { describe, expect, it } from 'vitest'
import { DomainError, ParamsError, createDomainsParams } from '@oxeo/scheme'
import { createIdSource } from '../lib'
import { createRuntime, domains, params, source, viewRuns } from './runtime.fixture'

describe('выдача идентификаторов', () => {
  it('строки — hash, номера — по счётчику', async () => {
    const data = source()
    const ids = createIdSource(data.collections.counter)

    expect(ids.string('a')).not.toBe(ids.string('a'))
    expect(await ids.number('notes')).toBe(1)
    expect(await ids.number('notes')).toBe(2)
    expect(await ids.number('authors')).toBe(1)

    const counter = await data.collections.counter.get('notes')

    expect(counter?.seq).toBe(2)
  })
})

describe('DomainRuntime', () => {
  it('событие несёт новые версии тронутых записей, без счётчиков', async () => {
    const { runtime, events } = createRuntime()

    const authorEvent = await runtime.run(
      { domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } },
      'автор'
    )
    const noteEvent = await runtime.run(
      { domain: 'notes', method: 'add', params: { text: 'первая', authorId: 1 } },
      'автор',
      { at: 42 }
    )

    expect(events.map((event) => event.revision)).toEqual([1, 2])
    expect(authorEvent.changes).toEqual([
      { collection: 'author', id: 1, record: { authorId: 1, name: 'Аня' } }
    ])
    expect(noteEvent.result).toBe(1)
    expect(noteEvent.ctx).toEqual({ actor: { name: 'автор' }, at: 42, today: '2026-01-01' })
    expect(noteEvent.changes).toEqual([
      {
        collection: 'note',
        id: 1,
        record: { noteId: 1, text: 'первая', status: 'draft', createdAt: 42, authorId: 1 }
      }
    ])

    const removed = await runtime.run(
      { domain: 'notes', method: 'remove', params: { noteId: 1 } },
      null
    )

    expect(removed.changes).toEqual([{ collection: 'note', id: 1, record: null }])
  })

  it('параметры: отказ схемы — ParamsError без ревизии, в домен и событие идёт разобранное', async () => {
    const { runtime, events } = createRuntime()

    const invalid = runtime.run(
      { domain: 'notes', method: 'addAuthor', params: { name: 1 } as never },
      null
    )

    await expect(invalid).rejects.toBeInstanceOf(ParamsError)
    await expect(invalid).rejects.toMatchObject({ code: 'params', issues: [{ path: ['name'] }] })
    expect(runtime.revision).toBe(0)

    const event = await runtime.run(
      { domain: 'notes', method: 'addAuthor', params: { name: 'Аня', extra: 1 } as never },
      null
    )

    expect(event.params).toEqual({ name: 'Аня' })
    expect(events[0].params).toEqual({ name: 'Аня' })
  })

  it('операции без схемы нет: private-помощник и унаследованные ключи — notFound', async () => {
    const { runtime } = createRuntime()

    const calls = [
      ['notes', 'hidden'],
      ['notes', 'toString'],
      ['notes', 'constructor'],
      ['notes', 'missing'],
      ['toString', 'call'],
      ['missing', 'add']
    ]

    for (const [domain, method] of calls) {
      const call = runtime.run({ domain, method, params: {} } as never, null)

      await expect(call).rejects.toMatchObject({ code: 'notFound' })
    }
  })

  it('реестр схем проверяет компилятор: метод без схемы, лишний метод, схема не того типа', () => {
    const { whoami, ...withoutWhoami } = params.notes

    // @ts-expect-error нет схемы метода whoami
    createDomainsParams<typeof domains>({ notes: withoutWhoami })
    // @ts-expect-error схема другого метода: у publish параметры другие
    createDomainsParams<typeof domains>({ notes: { ...params.notes, publish: params.notes.addAuthor } })
    // @ts-expect-error такого метода у домена нет
    createDomainsParams<typeof domains>({ notes: { ...params.notes, extra: whoami } })
  })

  it('частичная запись — onPartialWrite; отказ до записи и чужой актор — без ревизии', async () => {
    const { runtime, events, partial } = createRuntime()

    await runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)

    const broken = runtime.run(
      { domain: 'notes', method: 'addBroken', params: { text: 'x', authorId: 1 } },
      null
    )

    await expect(broken).rejects.toThrow('after write')
    expect(partial).toHaveLength(1)
    expect(partial[0].writes).toBe(1)

    const missingAuthor = runtime.run(
      { domain: 'notes', method: 'add', params: { text: 'x', authorId: 9 } },
      null
    )

    await expect(missingAuthor).rejects.toBeTruthy()

    const forbidden = runtime.run({ domain: 'notes', method: 'whoami', params: {} }, 'чужой')

    await expect(forbidden).rejects.toBeInstanceOf(DomainError)
    expect(partial).toHaveLength(1)
    expect(runtime.revision).toBe(1)
    expect(events).toHaveLength(1)
  })

  it('пакет запросов: get, find с операторами, коллекция целиком, count и захват ссылок', async () => {
    const { runtime } = createRuntime()

    await runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)
    await runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Боря' } }, null)
    await runtime.run({ domain: 'notes', method: 'add', params: { text: 'a', authorId: 1 } }, null, {
      at: 10
    })
    await runtime.run({ domain: 'notes', method: 'add', params: { text: 'b', authorId: 2 } }, null, {
      at: 20
    })
    await runtime.run({ domain: 'notes', method: 'publish', params: { noteId: 2 } }, null)

    const answer = await runtime.query({
      queries: [
        { kind: 'get', collection: 'note', ids: [1, 99] },
        {
          kind: 'find',
          collection: 'note',
          where: { createdAt: { gte: 15 }, status: { in: ['published'] } }
        },
        { kind: 'count', collection: 'note', where: { status: 'draft' } },
        { kind: 'count', collection: 'author', where: null }
      ]
    })

    expect(answer.results).toEqual([{ ids: [1] }, { ids: [2] }, { count: 1 }, { count: 2 }])

    // записи запросов и захваченные авторы — каждая один раз
    const keys = answer.records.map((version) => `${version.collection}:${version.id}`)

    expect(keys.sort()).toEqual(['author:1', 'author:2', 'note:1', 'note:2'])

    // отказ запроса — его результат, соседние запросы пакета отвечены
    const partial = await runtime.query({
      queries: [
        { kind: 'find', collection: 'missing', where: null },
        { kind: 'count', collection: 'author', where: null }
      ]
    })

    expect(partial.results).toEqual([
      { error: { code: 'notFound', message: expect.any(String) } },
      { count: 2 }
    ])
  })
})

describe('окна find и представления', () => {
  /** Автор и три заметки с разным временем создания: 30, 10, 20. */
  const seed = async (runtime: ReturnType<typeof createRuntime>['runtime']) => {
    await runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)

    for (const at of [30, 10, 20]) {
      await runtime.run(
        { domain: 'notes', method: 'add', params: { text: `${at}`, authorId: 1 } },
        null,
        {
          at
        }
      )
    }
  }

  it('find с порядком и пределом: окно в порядке поля, предел без порядка — по id', async () => {
    const { runtime } = createRuntime()

    await seed(runtime)

    const answer = await runtime.query({
      queries: [
        {
          kind: 'find',
          collection: 'note',
          where: {},
          order: { field: 'createdAt', direction: 'desc' },
          limit: 2
        },
        {
          kind: 'find',
          collection: 'note',
          where: {},
          order: { field: 'createdAt', direction: 'asc' }
        },
        { kind: 'find', collection: 'note', where: null, limit: 2 }
      ]
    })

    expect(answer.results).toEqual([{ ids: [1, 3] }, { ids: [2, 3, 1] }, { ids: [1, 2] }])
  })

  it('значение и прочитанные коллекции; кэш до события, тронувшего прочитанное', async () => {
    const { runtime } = createRuntime()
    const summary = { kind: 'view', view: 'notes', method: 'summary', params: { authorId: 1 } } as const

    await seed(runtime)

    const runs = viewRuns.count
    const first = await runtime.query({ queries: [summary] }, 'автор')

    expect(first.results).toEqual([
      { value: { author: 'Аня', drafts: 3, published: 0, viewer: 'автор' }, reads: ['note', 'author'] }
    ])
    expect(first.records).toEqual([])

    // повтор — из кэша; другая идентичность — свой расчёт
    await runtime.query({ queries: [summary] }, 'автор')
    expect(viewRuns.count).toBe(runs + 1)

    const anonymous = await runtime.query({ queries: [summary] })

    expect(anonymous.results[0]).toMatchObject({ value: { viewer: null } })
    expect(viewRuns.count).toBe(runs + 2)

    // событие тронуло заметки — значение считается заново
    await runtime.run({ domain: 'notes', method: 'publish', params: { noteId: 1 } }, null)

    const next = await runtime.query({ queries: [summary] }, 'автор')

    expect(next.results[0]).toMatchObject({ value: { drafts: 2, published: 1 } })
    expect(viewRuns.count).toBe(runs + 3)

    // упавшая операция, успевшая записать, тоже сбрасывает значение
    await expect(
      runtime.run({ domain: 'notes', method: 'addBroken', params: { text: 'x', authorId: 1 } }, null)
    ).rejects.toThrow('after write')

    const afterBroken = await runtime.query({ queries: [summary] }, 'автор')

    expect(afterBroken.results[0]).toMatchObject({ value: { drafts: 3 } })
  })

  it('отказы представлений — результатами: не пишет, неизвестное, параметры, упавшее', async () => {
    const { runtime, queryErrors } = createRuntime()

    await seed(runtime)

    const answer = await runtime.query({
      queries: [
        { kind: 'view', view: 'notes', method: 'broken', params: { noteId: 1 } },
        { kind: 'view', view: 'notes', method: 'toString', params: {} },
        { kind: 'view', view: 'notes', method: 'summary', params: { authorId: 'один' } },
        { kind: 'view', view: 'notes', method: 'crash', params: {} },
        { kind: 'view', view: 'notes', method: 'summary', params: { authorId: 1 } }
      ]
    })

    expect(answer.results.map((result) => ('error' in result ? result.error.code : 'ok'))).toEqual([
      'forbidden',
      'notFound',
      'params',
      'internal',
      'ok'
    ])
    // непредвиденная ошибка не уходит клиенту, а попадает в onQueryError
    expect(answer.results[3]).toEqual({ error: { code: 'internal', message: 'Запрос не выполнен' } })
    expect(queryErrors.map(({ error }) => (error as Error).name)).toEqual([
      'DomainError',
      'DomainError',
      'ParamsError',
      'TypeError'
    ])
  })
})
