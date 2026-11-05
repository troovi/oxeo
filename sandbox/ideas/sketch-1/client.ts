// @ts-nocheck
/* eslint-disable */

// Ядро клиента xeo 1.0, без React: хранилище версий записей, живые запросы, пакеты к серверу с повторами, применение
// событий, пересинхронизация, объект данных `data` и вызовы операций `DomainsAPI`. Схема клиенту нужна только типами:
// доменов, декораторов и `DataProcessor` в клиенте нет. Привязка к React — `react.tsx`

import isEqual from 'fast-deep-equal'
import type { CollectionScheme, ExtractType, IType } from '@companix/xeo-scheme'
import type { DomainsApi, DomainsMap } from '@companix/xeo-toolkit'
import { EventSync } from '@companix/xeo-toolkit'
import { matches } from './matcher'
import { JournalEvent, Query, QueryAnswer, QueryBatch, RecordVersion, Where } from './protocol'

// ------------------------------------------------ types -------------------------------------------------

/**
 * Чтения коллекции. Внутри обёртки `observer` чтение отслеживается: подписывает компонент и догружает недостающее,
 * отдавая до загрузки пустое (`null`, `[]`, `0`). Вне обёртки отдаёт только покрытое, непокрытое — ошибка.
 */
export interface CollectionReader<T, I extends IType> {
  /** Запись по id; `null` — записи нет. */
  get(id: I): T | null
  /** Записи по фильтру. */
  find(where: Where<T>): T[]
  /** Коллекция целиком. */
  all(): T[]
  /** Число записей по фильтру, без фильтра — всех; перезапрашивается при изменениях коллекции. */
  count(where?: Where<T>): number
  /** Явная загрузка для обработчика: непокрытое — с сервера, покрытое — сразу; без фильтра — коллекция целиком. */
  load(where?: Where<T>): Promise<T[]>
}

/** Объект данных: `data.<collection>`, типы — из схемы. */
export type DataApi<Scheme extends CollectionScheme> = {
  [K in keyof Scheme]: CollectionReader<ExtractType<Scheme[K]['model']>, Scheme[K]['identifierType']>
}

/** Обращения к серверу. Их задаёт приложение: адрес, заголовки, авторизация, запись в Networks песочницы. */
export interface ClientTransport {
  query(batch: QueryBatch): Promise<QueryAnswer>
  call(call: { domain: string; method: string; params: unknown }): Promise<JournalEvent>
}

export interface ClientOptions {
  transport: ClientTransport
  /** Паузы перед повторами неудавшегося пакета, мс: сколько пауз — столько повторов. */
  retries?: number[]
  /** Задержка перезапроса счётчиков после изменений коллекции, мс; события подряд дают один перезапрос. */
  countDelay?: number
  /** Клиент забыл всё и начинает заново: команда сервера, смена эпохи, разрыв ревизий. */
  onResync?: (reason: string) => void
}

/** Что изменилось у клиента — по этому обёртки решают, кого перерисовать. */
export interface ClientChange {
  /** Записи `collection:id` → изменённые поля; `null` — запись появилась или пропала. */
  records: Map<string, string[] | null>
  /** Ключи запросов, у которых изменился состав или число. */
  queries: Set<string>
  /** Коллекции, загруженные целиком, в которых что-то изменилось. */
  collections: Set<string>
  /** Клиент забыл всё — затронуты все. */
  everything: boolean
}

// ----------------------------------------------- tracking -----------------------------------------------

/**
 * Сборщик одного прохода рендера: что тело прочитало (для подписки) и чего не хватило (для загрузки). Обёртка ставит
 * его на время вызова тела; чтения видят его через `Tracker.current`.
 */
export class Tracker {
  static current: Tracker | null = null

  needs = new Map<string, Query>()
  records = new Map<string, Set<string>>()
  queries = new Set<string>()
  collections = new Set<string>()

  run<R>(body: () => R) {
    const prev = Tracker.current

    this.needs.clear()
    this.records.clear()
    this.queries.clear()
    this.collections.clear()

    Tracker.current = this

    try {
      return body()
    } finally {
      Tracker.current = prev
    }
  }

  /** Касается ли изменение прочитанного: поле прочитанной записи, состав прочитанного запроса или коллекции. */
  isAffected(change: ClientChange) {
    if (change.everything) {
      return true
    }

    for (const key of this.queries) {
      if (change.queries.has(key)) {
        return true
      }
    }

    for (const collection of this.collections) {
      if (change.collections.has(collection)) {
        return true
      }
    }

    for (const [key, fields] of change.records) {
      const read = this.records.get(key)

      if (read && (fields === null || read.size === 0 || fields.some((field) => read.has(field)))) {
        return true
      }
    }

    return false
  }
}

/** Чтение вне рендера того, что у клиента не покрыто. */
export class UncoveredReadError extends Error {
  constructor(query: Query) {
    super(`${keyOf(query)} не загружено: прочитайте это при рисовании в observer или загрузите через load`)
  }
}

// ------------------------------------------------ client ------------------------------------------------

/**
 * Клиент. Типы схемы и доменов — параметрами (`createClient<AppScheme, AppDomains>(…)`): в рантайме ни схемы, ни
 * доменов клиенту не нужно. Поток событий открывает приложение и передаёт сообщения в `push` и `resync`.
 */
export const createClient = <Scheme extends CollectionScheme, Domains extends DomainsMap>(options: ClientOptions) => {
  const { transport, retries = [300, 1000, 3000], countDelay = 300 } = options

  // store

  /** Версии записей по коллекциям; версия неизменяема — новая версия кладётся новым объектом. */
  const records = new Map<string, Map<IType, object>>()
  /** Известно, что записи нет: сервер не нашёл её или событие её удалило. */
  const absent = new Set<string>()
  /** Коллекции, загруженные целиком: любой запрос к ним отвечается на месте. */
  const complete = new Set<string>()
  /** Живые запросы `find` и `count` по ключу. */
  const finds = new Map<string, { collection: string; where: object; ids: Set<IType> }>()
  const counts = new Map<string, { collection: string; where: object | null; value: number }>()

  const listeners = new Set<(change: ClientChange) => void>()
  const own = new Set<number>()

  /** Очередь событий журнала из 0.1: порядок ревизий, разрывы, эпоха; применяет события, а не повторяет операции. */
  const createSync = () => {
    return new EventSync({
      apply: async (event) => applyEvent(event),
      resync: (reason) => resync(reason)
    })
  }

  let sync = createSync()

  const recordOf = (collection: string, id: IType) => {
    return records.get(collection)?.get(id) ?? null
  }

  /** Запись есть у клиента или известно, что её нет. */
  const isKnown = (collection: string, id: IType) => {
    return recordOf(collection, id) !== null || absent.has(`${collection}:${id}`)
  }

  const recordsOf = (collection: string) => {
    return [...(records.get(collection)?.values() ?? [])]
  }

  // coverage

  /** Покрыт ли запрос: коллекция целиком, живой запрос с тем же ключом, записи по id есть или известно, что их нет. */
  const isCovered = (query: Query) => {
    if (complete.has(query.collection)) {
      return true
    }

    if (query.kind === 'get') {
      return query.ids.every((id) => isKnown(query.collection, id))
    }

    if (query.kind === 'find') {
      return finds.has(keyOf(query))
    }

    return counts.has(keyOf(query))
  }

  /** Ответ на покрытый запрос из того, что есть у клиента. */
  const localOf = (query: Query) => {
    if (query.kind === 'get') {
      return recordOf(query.collection, query.ids[0])
    }

    const entry = finds.get(keyOf(query))
    const found = entry ? [...entry.ids].map((id) => recordOf(query.collection, id)) : null
    const items = found ?? recordsOf(query.collection).filter((record) => matches(record, query.where))

    if (query.kind === 'count') {
      return counts.get(keyOf(query))?.value ?? items.length
    }

    return items
  }

  // reads

  /**
   * Чтение: в рендере — отследить и, если не покрыто, записать потребность и отдать пустое; вне рендера — только
   * покрытое. Записи в рендере отдаются через прокси, который запоминает прочитанные поля.
   */
  const read = (query: Query) => {
    const tracker = Tracker.current

    if (tracker === null) {
      if (!isCovered(query)) {
        throw new UncoveredReadError(query)
      }

      return localOf(query)
    }

    watch(tracker, query)

    if (!isCovered(query)) {
      tracker.needs.set(keyOf(query), query)
      return emptyOf(query)
    }

    return tracked(tracker, query.collection, localOf(query))
  }

  const data = new Proxy({} as DataApi<Scheme>, {
    get: (_, collection: string) => ({
      get: (id: IType) => read({ kind: 'get', collection, ids: [id] }),
      find: (where: object) => read({ kind: 'find', collection, where }),
      all: () => read({ kind: 'find', collection, where: null }),
      count: (where: object | null = null) => read({ kind: 'count', collection, where }),
      load: async (where: object | null = null) => {
        const query: Query = { kind: 'find', collection, where }

        if (!isCovered(query)) {
          await request([query])
        }

        return localOf(query)
      }
    })
  })

  // loading

  /** Потребности, ещё не отправленные; уходят одним пакетом в конце такта. */
  const waiting = new Map<string, { query: Query; done: Deferred }>()
  /** Отправленные и ещё не отвеченные — повторная потребность ждёт их, а не шлёт снова. */
  const inflight = new Map<string, Promise<void>>()

  let isScheduled = false

  /** Загрузить запросы: промис разрешается, когда все покрыты, и отклоняется, если пакет не удался после повторов. */
  const request = (queries: Query[]) => {
    const promises = queries.map((query) => {
      const key = keyOf(query)
      const current = inflight.get(key) ?? waiting.get(key)?.done.promise

      if (current) {
        return current
      }

      const done = deferred()

      waiting.set(key, { query, done })
      return done.promise
    })

    if (!isScheduled) {
      isScheduled = true
      setTimeout(flush, 0)
    }

    return Promise.all(promises)
  }

  /** Отправка накопленного одним пакетом: `get` одной коллекции склеиваются в один список id. */
  const flush = async () => {
    const items = [...waiting.values()]
    const batch: QueryBatch = { queries: mergeGets(items.map((item) => item.query)) }

    waiting.clear()
    isScheduled = false

    items.forEach((item) => inflight.set(keyOf(item.query), item.done.promise))

    try {
      const answer = await withRetries(() => transport.query(batch), retries)

      applyAnswer(batch, answer)
      items.forEach((item) => item.done.resolve())
    } catch (error) {
      items.forEach((item) => item.done.reject(error))
    } finally {
      items.forEach((item) => inflight.delete(keyOf(item.query)))
    }
  }

  /**
   * Ответ в хранилище. Первый ответ запускает очередь событий с его эпохи и ревизии; события до неё отбрасываются.
   * Склейка ответа с событиями, пришедшими в другом порядке, — известная проблема первой версии (README).
   */
  const applyAnswer = (batch: QueryBatch, answer: QueryAnswer) => {
    const change = emptyChange()

    sync.start(answer)
    answer.records.forEach((version) => put(version, change))

    batch.queries.forEach((query, i) => {
      const result = answer.results[i]

      if (query.kind === 'get') {
        const missing = query.ids.filter((id) => !result.ids.includes(id))

        missing.forEach((id) => absent.add(`${query.collection}:${id}`))
        return
      }

      if (query.kind === 'count') {
        counts.set(keyOf(query), { collection: query.collection, where: query.where, value: result.count })
        change.queries.add(keyOf(query))
        return
      }

      if (query.where === null) {
        complete.add(query.collection)
        change.collections.add(query.collection)
        return
      }

      finds.set(keyOf(query), { collection: query.collection, where: query.where, ids: new Set(result.ids) })
      change.queries.add(keyOf(query))
    })

    notify(change)
  }

  // events

  /**
   * Событие журнала. Новая версия записи кладётся, если запись у клиента уже есть, коллекция загружена целиком, запрос
   * её ждёт, её id спрашивали, или событие — ответ на собственный вызов. Живые `find` пересчитываются по фильтру, а
   * счётчики затронутых коллекций перезапрашиваются с задержкой.
   */
  const applyEvent = (event: JournalEvent) => {
    const change = emptyChange()
    const isOwn = own.delete(event.revision)

    for (const version of event.changes) {
      const { collection, id, record } = version
      const entries = [...finds].filter(([, entry]) => entry.collection === collection)

      const isMatched = record !== null && entries.some(([, entry]) => matches(record, entry.where))

      if (record === null || isOwn || isMatched || isKnown(collection, id) || complete.has(collection)) {
        put(version, change)
      }

      for (const [key, entry] of entries) {
        const isMember = record !== null && matches(record, entry.where)

        if (isMember && !entry.ids.has(id)) {
          entry.ids.add(id)
          change.queries.add(key)
        }

        if (!isMember && entry.ids.has(id)) {
          entry.ids.delete(id)
          change.queries.add(key)
        }
      }

      scheduleCounts(collection)
    }

    notify(change)
  }

  /**
   * Вызовы операций: `POST domains/<domain>/<method>` → событие журнала → очередь → результат. После `await` хранилище
   * уже содержит изменения, а записи события собственного вызова клиент сохраняет все.
   */
  const DomainsAPI = new Proxy({} as DomainsApi<Domains>, {
    get: (_, domain: string) => {
      return new Proxy({}, {
        get: (_, method: string) => async (params: unknown) => {
          const event = await transport.call({ domain, method, params })

          own.add(event.revision)
          sync.push(event)
          await sync.whenApplied(event.revision)

          return event.result
        }
      })
    }
  })

  // counts

  const countTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const scheduleCounts = (collection: string) => {
    if (complete.has(collection) || countTimers.has(collection)) {
      return
    }

    countTimers.set(collection, setTimeout(() => refreshCounts(collection), countDelay))
  }

  /** Перезапрос счётчиков коллекции: тем же пакетом, мимо покрытия — числа заменяются новыми. */
  const refreshCounts = async (collection: string) => {
    countTimers.delete(collection)

    const entries = [...counts.values()].filter((entry) => entry.collection === collection)
    const queries: Query[] = entries.map((entry) => ({ kind: 'count', collection, where: entry.where }))

    if (queries.length > 0) {
      const batch = { queries }
      const answer = await withRetries(() => transport.query(batch), retries)

      applyAnswer(batch, answer)
    }
  }

  // resync

  /**
   * Забыть всё и начать заново, без перезагрузки страницы: хранилище и запросы пусты, очередь событий новая.
   * Смонтированные обёртки получают изменение «всё», перерисовываются и перезапрашивают то, что читают.
   */
  const resync = (reason: string) => {
    records.clear()
    absent.clear()
    complete.clear()
    finds.clear()
    counts.clear()
    own.clear()

    sync = createSync()

    options.onResync?.(reason)
    notify({ ...emptyChange(), everything: true })
  }

  // store writes

  /** Версия записи на место прежней; поля, которые изменились, — для подписок. */
  const put = ({ collection, id, record }: RecordVersion, change: ClientChange) => {
    const prev = recordOf(collection, id)
    const key = `${collection}:${id}`

    if (record === null) {
      records.get(collection)?.delete(id)
      absent.add(key)
      change.records.set(key, null)
      return
    }

    if (!records.has(collection)) {
      records.set(collection, new Map())
    }

    records.get(collection).set(id, record)
    absent.delete(key)
    change.records.set(key, prev === null ? null : changedFields(prev, record))

    if (complete.has(collection)) {
      change.collections.add(collection)
    }
  }

  const notify = (change: ClientChange) => {
    listeners.forEach((listener) => listener(change))
  }

  return {
    data,
    DomainsAPI,
    /** Сообщения потока: событие журнала. */
    push: (event: JournalEvent) => sync.push(event),
    /** Команда сервера или обрыв потока. */
    resync,
    /** Для привязки к React: загрузка потребностей прохода и подписка на изменения. */
    request,
    subscribe: (listener: (change: ClientChange) => void) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    }
  }
}

export type XeoClient = ReturnType<typeof createClient>

// ----------------------------------------------- helpers ------------------------------------------------

/** Ключ запроса: вид, коллекция и фильтр или id; одинаковые запросы разных компонентов — один ключ. */
const keyOf = (query: Query) => {
  if (query.kind === 'get') {
    return `get:${query.collection}:${query.ids.join(',')}`
  }

  return `${query.kind}:${query.collection}:${stableStringify(query.where)}`
}

const emptyOf = (query: Query) => {
  if (query.kind === 'get') {
    return null
  }

  return query.kind === 'count' ? 0 : []
}

/** Поля верхнего уровня, которые отличаются у двух версий. */
const changedFields = (prev: object, next: object) => {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)])

  return [...keys].filter((key) => !isEqual(prev[key], next[key]))
}

// watch(tracker, query) — запомнить в сборщике: `get` — запись `collection:id` (пустой набор полей: важна сама
// запись), `find`/`count` — ключ запроса, по покрытой целиком коллекции — коллекцию.
// tracked(tracker, collection, value) — записи через прокси, который кладёт прочитанные поля в
// `tracker.records`, как прокси `xeo-react` 0.1.
// mergeGets, withRetries, deferred, stableStringify, emptyChange — служебные.
