/**
 * Клиент — живая часть базы сервера. Держит версии записей и результаты запросов, догружает недостающее пакетами с
 * повторами, применяет события журнала (новые версии записей), сверяя их с живыми запросами, и вызывает операции.
 * Домены клиент не исполняет, схема и домены нужны ему только типами: в рантайме от `@oxeo/scheme` он берёт лишь вход
 * `filter`. Привязка к React — `@oxeo/react`.
 */
import isEqual from 'fast-deep-equal'
import { matches } from '@oxeo/scheme/filter'
import type {
  CollectionScheme,
  DomainEvent,
  DomainRoutes,
  DomainsMap,
  ExtractType,
  IType,
  Queries,
  Query,
  QueryAnswer,
  QueryBatch,
  QueryResult,
  RecordVersion,
  Where
} from '@oxeo/scheme'
import { EventSync } from './sync'
import { ClientChange, Tracker, emptyChange } from './tracker'

// types

/**
 * Чтения коллекции. В проходе рендера (привязка поставила сборщик) чтение подписывает и, если данных нет, записывает
 * потребность и отдаёт пустое того же вида (`null`, `[]`, `0`). Вне рендера отдаёт только покрытое, непокрытое —
 * `UncoveredReadError`.
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

/**
 * Типы вызовов — из сигнатур методов домена: параметры — первый аргумент метода, ответ — результат. Схема
 * параметров не должна менять форму значения (без `.default()`/`.transform()`).
 */
export type DomainsApi<T extends DomainsMap> = {
  [D in keyof T]: {
    [M in keyof DomainRoutes<T>[D]]: (
      params: DomainRoutes<T>[D][M]['params']
    ) => Promise<DomainRoutes<T>[D][M]['answer']>
  }
}

/** Обращения к серверу. Их задаёт приложение: адрес, заголовки, авторизация. */
export interface ClientTransport {
  /** Пакет запросов: `POST data/query` или как устроит приложение. */
  query(batch: QueryBatch): Promise<QueryAnswer>
  /** Вызов операции: ответ — событие журнала. */
  call(call: { domain: string; method: string; params: unknown }): Promise<DomainEvent>
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

/** Чтение вне рендера того, чего у клиента нет: прочитать при рисовании или загрузить явно (`load`). */
export class UncoveredReadError extends Error {
  constructor(key: string) {
    super(`oxeo: ${key} не загружено — прочитайте это при рисовании или загрузите через load`)
    this.name = 'UncoveredReadError'
  }
}

interface FindEntry {
  collection: string
  where: object
  ids: Set<IType>
}

interface CountEntry {
  collection: string
  where: object | null
  value: number
}

interface Deferred {
  promise: Promise<void>
  resolve: () => void
  reject: (error: unknown) => void
}

/** Записи по id внутри коллекции. */
type RecordEntry = [IType, object]

/**
 * Клиент. Типы схемы и доменов — параметрами (`createClient<AppScheme, AppDomains>(…)`): в рантайме ни схемы, ни доменов
 * клиенту не нужно. Поток событий открывает приложение и передаёт сообщения в `push` и `resync`.
 */
export const createClient = <Scheme extends CollectionScheme, Domains extends DomainsMap>(
  options: ClientOptions
) => {
  const { transport, retries = [300, 1000, 3000], countDelay = 300 } = options

  // store

  /** Версии записей по коллекциям; версия неизменяема — новая кладётся новым объектом. */
  const records = new Map<string, Map<IType, object>>()
  /** Известно, что записи нет: сервер её не нашёл или событие её удалило — `collection:id`. */
  const absent = new Set<string>()
  /** Коллекции, загруженные целиком: любой запрос к ним отвечается на месте. */
  const complete = new Set<string>()
  /** Живые запросы по ключу. */
  const finds = new Map<string, FindEntry>()
  const counts = new Map<string, CountEntry>()
  /** Запросы, загрузка которых не удалась после повторов. */
  const failures = new Set<string>()

  const listeners = new Set<(change: ClientChange) => void>()

  const createSync = () => {
    return new EventSync({
      apply: async (event) => applyEvent(event),
      resync: (reason) => resync(reason)
    })
  }

  /** Очередь событий журнала: порядок ревизий, разрывы, эпоха. Пересинхронизация заводит новую. */
  const journal = { sync: createSync() }

  const recordOf = (collection: string, id: IType) => {
    return records.get(collection)?.get(id) ?? null
  }

  /** Запись есть у клиента или известно, что её нет. */
  const isKnown = (collection: string, id: IType) => {
    return recordOf(collection, id) !== null || absent.has(`${collection}:${id}`)
  }

  const notify = (change: ClientChange) => {
    listeners.forEach((listener) => listener(change))
  }

  // coverage

  /** Покрыт ли запрос: коллекция целиком, живой запрос с тем же ключом, запись по id есть или её точно нет. */
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

  /** Записи покрытого `find`: по живому запросу или отбором из коллекции, загруженной целиком. */
  const entriesOf = (query: Queries.Find): RecordEntry[] => {
    const entry = finds.get(keyOf(query))
    const collection = records.get(query.collection) ?? new Map<IType, object>()

    if (entry) {
      return [...entry.ids].map((id): RecordEntry => [id, collection.get(id)!])
    }

    const all = [...collection.entries()]

    return query.where === null ? all : all.filter(([, record]) => matches(record, query.where!))
  }

  /** Число покрытого `count`: по живому счётчику или отбором из коллекции, загруженной целиком. */
  const countOf = (query: Queries.Count) => {
    const entry = counts.get(keyOf(query))

    if (entry) {
      return entry.value
    }

    return entriesOf({ kind: 'find', collection: query.collection, where: query.where }).length
  }

  // reads

  /** Чтение вне рендера: только покрытое. */
  const readCovered = (query: Query) => {
    if (!isCovered(query)) {
      throw new UncoveredReadError(keyOf(query))
    }

    if (query.kind === 'get') {
      return recordOf(query.collection, query.ids[0])
    }

    if (query.kind === 'count') {
      return countOf(query)
    }

    return entriesOf(query).map(([, record]) => record)
  }

  /**
   * Чтение: в проходе рендера — запомнить прочитанное и, если не покрыто, записать потребность (или отказ, если запрос
   * уже не удался) и отдать пустое; записи — через прокси сборщика. Вне рендера — только покрытое.
   */
  const read = (query: Query) => {
    const tracker = Tracker.current

    if (tracker === null) {
      return readCovered(query)
    }

    const key = keyOf(query)

    watch(tracker, query, key)

    if (!isCovered(query)) {
      if (failures.has(key)) {
        tracker.failures.add(key)
        return emptyOf(query)
      }

      tracker.needs.set(key, query)
      return emptyOf(query)
    }

    if (query.kind === 'get') {
      const record = recordOf(query.collection, query.ids[0])

      return record && tracker.track(`${query.collection}:${query.ids[0]}`, record)
    }

    if (query.kind === 'count') {
      return countOf(query)
    }

    return entriesOf(query).map(([id, record]) => tracker.track(`${query.collection}:${id}`, record))
  }

  /** Запомнить в сборщике, от чего зависит проход: запись, состав запроса, коллекция целиком. */
  const watch = (tracker: Tracker, query: Query, key: string) => {
    if (query.kind === 'get') {
      tracker.fieldsOf(`${query.collection}:${query.ids[0]}`)
      return
    }

    tracker.queries.add(key)

    if (query.where === null || complete.has(query.collection)) {
      tracker.collections.add(query.collection)
    }
  }

  const readers = new Map<string, CollectionReader<object, IType>>()

  const readerOf = (collection: string) => {
    if (!readers.has(collection)) {
      readers.set(collection, {
        get: (id) => read({ kind: 'get', collection, ids: [id] }) as object | null,
        find: (where) => read({ kind: 'find', collection, where }) as object[],
        all: () => read({ kind: 'find', collection, where: null }) as object[],
        count: (where) => read({ kind: 'count', collection, where: where ?? null }) as number,
        load: async (where) => {
          const query: Query = { kind: 'find', collection, where: where ?? null }

          if (!isCovered(query)) {
            await request([query])
          }

          return readCovered(query) as object[]
        }
      })
    }

    return readers.get(collection)!
  }

  const data = new Proxy({} as DataApi<Scheme>, {
    get: (_, collection) => {
      return isMethodKey(collection) ? readerOf(collection) : undefined
    }
  })

  // loading

  /** Потребности, ещё не отправленные: уходят одним пакетом в конце такта. */
  const waiting = new Map<string, { query: Query; done: Deferred }>()
  /** Отправленные и ещё не отвеченные: повторная потребность ждёт их, а не шлёт снова. */
  const inflight = new Map<string, Promise<void>>()
  const flushing = { isScheduled: false }

  /** Загрузить запросы: промис разрешается, когда все покрыты, и отклоняется, если пакет не удался после повторов. */
  const request = async (queries: Query[]) => {
    const promises = queries.map((query) => {
      const key = keyOf(query)
      const current = inflight.get(key) ?? waiting.get(key)?.done.promise

      if (current) {
        return current
      }

      const done = createDeferred()

      waiting.set(key, { query, done })
      return done.promise
    })

    if (!flushing.isScheduled) {
      flushing.isScheduled = true
      setTimeout(flush, 0)
    }

    await Promise.all(promises)
  }

  /** Отправка накопленного одним пакетом; `get` одной коллекции склеиваются в один список id. */
  const flush = async () => {
    const items = [...waiting.values()]
    const batch: QueryBatch = { queries: mergeGets(items.map((item) => item.query)) }

    waiting.clear()
    flushing.isScheduled = false

    items.forEach((item) => inflight.set(keyOf(item.query), item.done.promise))

    try {
      const answer = await withRetries(() => transport.query(batch), retries)

      applyAnswer(batch, answer)

      items.forEach((item) => {
        failures.delete(keyOf(item.query))
        item.done.resolve()
      })
    } catch (error) {
      items.forEach((item) => {
        failures.add(keyOf(item.query))
        item.done.reject(error)
      })
    } finally {
      items.forEach((item) => inflight.delete(keyOf(item.query)))
    }
  }

  /** Забыть отказ запросов перед повтором: следующий проход снова соберёт их как потребности. */
  const forgetFailures = (keys: string[]) => {
    keys.forEach((key) => failures.delete(key))
  }

  /**
   * Ответ в хранилище. Первый ответ или событие запускает очередь событий со своей эпохи и ревизии; ответ другой эпохи
   * — пересинхронизация. Склейка ответа с событиями, пришедшими в другом порядке, — известная проблема первой версии:
   * ответ кладётся как есть.
   */
  const applyAnswer = (batch: QueryBatch, answer: QueryAnswer) => {
    if (!journal.sync.isStarted) {
      journal.sync.start(answer)
    }

    if (journal.sync.startedEpoch !== answer.epoch) {
      resync('epoch')
      return
    }

    const change = emptyChange()

    answer.records.forEach((version) => put(version, change))
    batch.queries.forEach((query, i) => applyResult(query, answer.results[i], change))

    notify(change)
  }

  const applyResult = (query: Query, result: QueryResult, change: ClientChange) => {
    const key = keyOf(query)

    if (query.kind === 'get' && 'ids' in result) {
      const missing = query.ids.filter((id) => !result.ids.includes(id))

      missing.forEach((id) => {
        absent.add(`${query.collection}:${id}`)
        change.records.set(`${query.collection}:${id}`, null)
      })

      return
    }

    if (query.kind === 'count' && 'count' in result) {
      counts.set(key, { collection: query.collection, where: query.where, value: result.count })
      change.queries.add(key)
      return
    }

    if (query.kind === 'find' && 'ids' in result) {
      if (query.where === null) {
        complete.add(query.collection)
        change.collections.add(query.collection)
      }

      if (query.where !== null) {
        finds.set(key, { collection: query.collection, where: query.where, ids: new Set(result.ids) })
      }

      change.queries.add(key)
    }
  }

  // events

  /** Событие из потока или ответ собственного вызова. Первое сообщение запускает очередь событий. */
  const push = (event: DomainEvent) => {
    if (!journal.sync.isStarted) {
      journal.sync.start({ epoch: event.epoch, revision: event.revision - 1 })
    }

    journal.sync.push(event)
  }

  /**
   * Событие журнала. Новая версия записи кладётся, если запись у клиента есть или известно, что её нет, коллекция
   * загружена целиком или её ждёт живой запрос. Живые `find` пересчитываются фильтром, счётчики затронутых коллекций
   * перезапрашиваются с задержкой.
   */
  const applyEvent = (event: DomainEvent) => {
    const change = emptyChange()

    for (const version of event.changes) {
      const { collection, id, record } = version
      const entries = [...finds].filter(([, entry]) => entry.collection === collection)
      const isMatched = record !== null && entries.some(([, entry]) => matches(record, entry.where))

      if (isMatched || isKnown(collection, id) || complete.has(collection)) {
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
   * Вызовы операций: `transport.call` → событие журнала → очередь → результат. После `await` хранилище уже содержит
   * изменения. Записи события собственного вызова клиент сохраняет все — после `create` обычно открывают созданное:
   * те, что очередь не положила (их не ждал ни один запрос), кладутся после применения события. Событие могло прийти
   * потоком раньше ответа — поэтому не при применении, а после.
   */
  const call = async (domain: string, method: string, params: unknown) => {
    const event = await transport.call({ domain, method, params })

    push(event)
    await journal.sync.whenApplied(event.revision)

    const change = emptyChange()
    const unknown = event.changes.filter((version) => !isKnown(version.collection, version.id))

    unknown.forEach((version) => put(version, change))
    notify(change)

    return event.result
  }

  const DomainsAPI = new Proxy({} as DomainsApi<Domains>, {
    get: (_, domain) => {
      if (!isMethodKey(domain)) {
        return undefined
      }

      return new Proxy({} as Record<string, unknown>, {
        get: (__, method) => {
          return isMethodKey(method) ? (params: unknown) => call(domain, method, params) : undefined
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

    countTimers.set(
      collection,
      setTimeout(() => refreshCounts(collection), countDelay)
    )
  }

  /** Перезапрос счётчиков коллекции мимо покрытия: числа заменяются новыми. */
  const refreshCounts = async (collection: string) => {
    countTimers.delete(collection)

    const entries = [...counts.values()].filter((entry) => entry.collection === collection)
    const queries: Query[] = entries.map((entry) => ({ kind: 'count', collection, where: entry.where }))

    if (queries.length === 0) {
      return
    }

    const batch = { queries }

    try {
      const answer = await withRetries(() => transport.query(batch), retries)

      applyAnswer(batch, answer)
    } catch {
      // прежнее число остаётся до следующего изменения коллекции
    }
  }

  // resync

  /**
   * Забыть всё и начать заново, без перезагрузки страницы: хранилище и запросы пусты, очередь событий новая. Все
   * подписчики получают изменение «всё»: смонтированные перерисовываются и перезапрашивают то, что читают.
   */
  const resync = (reason: string) => {
    records.clear()
    absent.clear()
    complete.clear()
    finds.clear()
    counts.clear()
    failures.clear()

    countTimers.forEach((timer) => clearTimeout(timer))
    countTimers.clear()

    journal.sync = createSync()

    options.onResync?.(reason)
    notify({ ...emptyChange(), everything: true })
  }

  // store writes

  /** Версия записи на место прежней; какие поля изменились — для подписок. */
  const put = ({ collection, id, record }: RecordVersion, change: ClientChange) => {
    const prev = recordOf(collection, id)
    const key = `${collection}:${id}`

    if (complete.has(collection)) {
      change.collections.add(collection)
    }

    if (record === null) {
      records.get(collection)?.delete(id)
      absent.add(key)
      change.records.set(key, null)
      return
    }

    if (!records.has(collection)) {
      records.set(collection, new Map())
    }

    records.get(collection)!.set(id, record)
    absent.delete(key)
    change.records.set(key, prev === null ? null : changedFields(prev, record))
  }

  return {
    data,
    DomainsAPI,
    /** Событие журнала из потока. */
    push,
    /** Команда сервера или обрыв потока: забыть всё и начать заново. */
    resync,
    /** Для привязки: загрузка потребностей прохода, отказы, подписка на изменения. */
    request,
    forgetFailures,
    subscribe: (listener: (change: ClientChange) => void) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    }
  }
}

export type OxeoClient = ReturnType<typeof createClient>

// helpers

/**
 * Не-строковые ключи и `then` не становятся коллекциями и вызовами: иначе `await` или возврат прокси из
 * `async`-функции превратился бы в чтение коллекции `then` или вызов `domains/<домен>/then`.
 */
const isMethodKey = (key: string | symbol): key is string => {
  return typeof key === 'string' && key !== 'then'
}

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

/** JSON с ключами по алфавиту: одинаковый фильтр с разным порядком полей — один ключ. */
const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }

  const keys = Object.keys(value).sort()
  const fields = keys.map(
    (key) => `${JSON.stringify(key)}:${stableStringify(value[key as keyof object])}`
  )

  return `{${fields.join(',')}}`
}

/** Поля верхнего уровня, которые отличаются у двух версий записи. */
const changedFields = (prev: object, next: object) => {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)])

  return [...keys].filter((key) => !isEqual(prev[key as keyof object], next[key as keyof object]))
}

/** `get` одной коллекции — в один запрос со списком id без повторов. */
const mergeGets = (queries: Query[]) => {
  const gets = new Map<string, Set<IType>>()
  const others = queries.filter((query) => query.kind !== 'get')

  for (const query of queries) {
    if (query.kind === 'get') {
      const ids = gets.get(query.collection) ?? new Set<IType>()

      query.ids.forEach((id) => ids.add(id))
      gets.set(query.collection, ids)
    }
  }

  const merged = [...gets].map(([collection, ids]): Query => ({
    kind: 'get',
    collection,
    ids: [...ids]
  }))

  return [...merged, ...others]
}

/** Попытка и повторы после пауз; последняя попытка бросает свою ошибку. */
const withRetries = async <R>(attempt: () => Promise<R>, delays: number[]) => {
  for (const delay of delays) {
    try {
      return await attempt()
    } catch {
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  return attempt()
}

/** Промис с ручками; отказ помечен обработанным — его получает тот, кто ждёт `promise`. */
const createDeferred = (): Deferred => {
  const handlers = { resolve: () => {}, reject: (_: unknown) => {} }
  const promise = new Promise<void>((resolve, reject) => {
    handlers.resolve = resolve
    handlers.reject = reject
  })

  promise.catch(() => {})

  return { promise, ...handlers }
}
