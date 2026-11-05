import { describe, expect, it } from 'vitest'
import { DomainError } from '@oxeo/scheme'
import { createIdSource, initializeDomains, methodOf } from '../lib'
import { createJournal, domains, source } from './journal.fixture'

describe('выдача идентификаторов', () => {
  it('строки — hash, номера — по счётчику', async () => {
    const data = source()
    const ids = createIdSource(data.collections.counter)

    expect(ids.string('a')).not.toBe(ids.string('a'))
    expect(await ids.number('notes')).toBe(1)
    expect(await ids.number('notes')).toBe(2)
    expect(await ids.number('authors')).toBe(1)
    expect(data.collections.counter.get('notes')?.seq).toBe(2)
  })
})

describe('рантайм доменов', () => {
  it('вызывает только собственные методы домена', async () => {
    const data = source()
    const services = initializeDomains(domains, data.collections)
    const ctx = {
      actor: null,
      at: 0,
      today: '2026-01-01',
      ids: createIdSource(data.collections.counter)
    }
    const call = (domain: string, method: string) => () =>
      methodOf(services, { domain, method, params: {} })({}, ctx)

    expect(call('notes', 'toString')).toThrow(expect.objectContaining({ code: 'notFound' }))
    expect(call('notes', 'constructor')).toThrow(expect.objectContaining({ code: 'notFound' }))
    expect(call('notes', 'missing')).toThrow(expect.objectContaining({ code: 'notFound' }))
    expect(call('missing', 'add')).toThrow(expect.objectContaining({ code: 'notFound' }))
    expect(call('toString', 'call')).toThrow(expect.objectContaining({ code: 'notFound' }))
  })
})

describe('createServerShell', () => {
  it('событие несёт новые версии тронутых записей, без счётчиков', async () => {
    const { server, events } = createJournal()

    const authorEvent = await server.run(
      { domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } },
      'автор'
    )
    const noteEvent = await server.run(
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

    const removed = await server.run({ domain: 'notes', method: 'remove', params: { noteId: 1 } }, null)

    expect(removed.changes).toEqual([{ collection: 'note', id: 1, record: null }])
  })

  it('частичная запись — onPartialWrite; отказ до записи и чужой актор — без ревизии', async () => {
    const { server, events, partial } = createJournal()

    await server.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)

    const broken = server.run(
      { domain: 'notes', method: 'addBroken', params: { text: 'x', authorId: 1 } },
      null
    )

    await expect(broken).rejects.toThrow('after write')
    expect(partial).toHaveLength(1)
    expect(partial[0].writes).toBe(1)

    const missingAuthor = server.run(
      { domain: 'notes', method: 'add', params: { text: 'x', authorId: 9 } },
      null
    )

    await expect(missingAuthor).rejects.toBeTruthy()

    const forbidden = server.run({ domain: 'notes', method: 'whoami', params: {} }, 'чужой')

    await expect(forbidden).rejects.toBeInstanceOf(DomainError)
    expect(partial).toHaveLength(1)
    expect(server.revision).toBe(1)
    expect(events).toHaveLength(1)
  })

  it('пакет запросов: get, find с операторами, коллекция целиком, count и захват ссылок', async () => {
    const { server } = createJournal()

    await server.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)
    await server.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Боря' } }, null)
    await server.run({ domain: 'notes', method: 'add', params: { text: 'a', authorId: 1 } }, null, {
      at: 10
    })
    await server.run({ domain: 'notes', method: 'add', params: { text: 'b', authorId: 2 } }, null, {
      at: 20
    })
    await server.run({ domain: 'notes', method: 'publish', params: { noteId: 2 } }, null)

    const answer = await server.query({
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

    expect(answer.revision).toBe(5)
    expect(answer.results).toEqual([{ ids: [1] }, { ids: [2] }, { count: 1 }, { count: 2 }])

    // записи запросов и захваченные авторы — каждая один раз
    const keys = answer.records.map((version) => `${version.collection}:${version.id}`)

    expect(keys.sort()).toEqual(['author:1', 'author:2', 'note:1', 'note:2'])

    const unknown = server.query({ queries: [{ kind: 'find', collection: 'missing', where: null }] })

    await expect(unknown).rejects.toMatchObject({ code: 'notFound' })
  })
})
