/**
 * Живая часть базы сервера на клиенте: версии записей и результаты запросов. Догружает недостающее пакетами с
 * повторами, применяет события журнала (новые версии записей), сверяя их с живыми запросами, и вызывает операции. Схемы
 * не знает: записи приходят вместе с коллекцией и id. Объект данных и вызовы операций над ним собирает `createClient`.
 */
import isEqual from 'fast-deep-equal'
import { matches } from '@oxeo/scheme/filter'
import type {
  DomainCall,
  DomainEvent,
  IType,
  Queries,
  Query,
  QueryAnswer,
  QueryBatch,
  QueryResult,
  RecordVersion
} from '@oxeo/scheme'
import { globalState } from './global-state'
import { ClientChange, Tracker, emptyChange } from './tracker'

// types

/** Обращения к серверу. Их задаёт приложение: адрес, заголовки, авторизация. */
export interface ClientTransport {
  /** Пакет запросов: `POST data/query` или как устроит приложение. */
  query(batch: QueryBatch): Promise<QueryAnswer>
  /** Вызов операции: ответ — событие журнала. */
  call(call: DomainCall): Promise<DomainEvent>
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

interface ApplyResultParams {
  query: Query
  result: QueryResult
  change: ClientChange
}

/** Записи по id внутри коллекции. */
type RecordEntry = [IType, object]

export class LiveStore {
  // store

  /** Версии записей по коллекциям; версия неизменяема — новая кладётся новым объектом. */
  private records = new Map<string, Map<IType, object>>()
  /** Известно, что записи нет: сервер её не нашёл или событие её удалило — `collection:id`. */
  private absent = new Set<string>()
  /** Коллекции, загруженные целиком: любой запрос к ним отвечается на месте. */
  private complete = new Set<string>()
  /** Живые запросы по ключу. */
  private finds = new Map<string, FindEntry>()
  private counts = new Map<string, CountEntry>()
  /** Запросы, загрузка которых не удалась после повторов. */
  private failures = new Set<string>()
  private listeners = new Set<(change: ClientChange) => void>()

  // loading

  /** Потребности, ещё не отправленные: уходят одним пакетом в конце такта. */
  private waiting = new Map<string, { query: Query; done: Deferred }>()
  /** Отправленные и ещё не отвеченные: повторная потребность ждёт их, а не шлёт снова. */
  private inflight = new Map<string, Promise<void>>()
  private isFlushScheduled = false
  private countTimers = new Map<string, ReturnType<typeof setTimeout>>()

  // stream

  /** Эпоха потока событий; `null` — первого события ещё не было. */
  private epoch: string | null = null
  /** Докуда дошёл поток: растёт только на его событиях. */
  private revision = 0

  // options

  private transport: ClientTransport
  private retries: number[]
  private countDelay: number
  private onResync: ClientOptions['onResync']

  constructor({ transport, retries = [300, 1000, 3000], countDelay = 300, onResync }: ClientOptions) {
    this.transport = transport
    this.retries = retries
    this.countDelay = countDelay
    this.onResync = onResync
  }

  // coverage

  /** Покрыт ли запрос: коллекция целиком, живой запрос с тем же ключом, запись по id есть или её точно нет. */
  private isCovered(query: Query) {
    if (this.complete.has(query.collection)) {
      return true
    }

    if (query.kind === 'get') {
      return query.ids.every((id) => this.isKnown(query.collection, id))
    }

    if (query.kind === 'find') {
      return this.finds.has(keyOf(query))
    }

    return this.counts.has(keyOf(query))
  }

  /** Записи покрытого `find`: по живому запросу или отбором из коллекции, загруженной целиком. */
  private entriesOf(query: Queries.Find): RecordEntry[] {
    const entry = this.finds.get(keyOf(query))
    const collection = this.records.get(query.collection) ?? new Map<IType, object>()

    if (entry) {
      return [...entry.ids].map((id): RecordEntry => [id, collection.get(id)!])
    }

    const all = [...collection.entries()]

    return query.where === null ? all : all.filter(([, record]) => matches(record, query.where!))
  }

  /** Число покрытого `count`: по живому счётчику или отбором из коллекции, загруженной целиком. */
  private countOf(query: Queries.Count) {
    const entry = this.counts.get(keyOf(query))

    if (entry) {
      return entry.value
    }

    return this.entriesOf({ kind: 'find', collection: query.collection, where: query.where }).length
  }

  // reads

  /**
   * Чтение: в проходе рендера — запомнить прочитанное и, если не покрыто, записать потребность (или отказ, если запрос
   * уже не удался) и отдать пустое; записи — через прокси сборщика. Вне рендера — только покрытое.
   */
  read(query: Query) {
    const tracker = globalState.currentTracker

    if (tracker === null) {
      return this.readCovered(query)
    }

    const key = keyOf(query)

    this.watch(tracker, query)

    if (!this.isCovered(query)) {
      if (this.failures.has(key)) {
        tracker.failures.add(key)
        return emptyOf(query)
      }

      tracker.needs.set(key, query)
      return emptyOf(query)
    }

    if (query.kind === 'get') {
      const record = this.recordOf(query.collection, query.ids[0])

      return record && tracker.track(`${query.collection}:${query.ids[0]}`, record)
    }

    if (query.kind === 'count') {
      return this.countOf(query)
    }

    const entries = this.entriesOf(query)

    return entries.map(([id, record]) => tracker.track(`${query.collection}:${id}`, record))
  }

  /** Явная загрузка для обработчика: непокрытое — с сервера, покрытое — сразу. */
  async load(query: Queries.Find) {
    if (!this.isCovered(query)) {
      await this.request([query])
    }

    return this.readCovered(query) as object[]
  }

  /** Чтение вне рендера: только покрытое. */
  private readCovered(query: Query) {
    if (!this.isCovered(query)) {
      throw new UncoveredReadError(keyOf(query))
    }

    if (query.kind === 'get') {
      return this.recordOf(query.collection, query.ids[0])
    }

    if (query.kind === 'count') {
      return this.countOf(query)
    }

    return this.entriesOf(query).map(([, record]) => record)
  }

  /** Запомнить в сборщике, от чего зависит проход: запись, состав запроса, коллекция целиком. */
  private watch(tracker: Tracker, query: Query) {
    if (query.kind === 'get') {
      tracker.fieldsOf(`${query.collection}:${query.ids[0]}`)
      return
    }

    tracker.queries.add(keyOf(query))

    if (query.where === null || this.complete.has(query.collection)) {
      tracker.collections.add(query.collection)
    }
  }

  // loading

  /** Загрузить запросы: промис разрешается, когда все покрыты, и отклоняется, если пакет не удался после повторов. */
  async request(queries: Query[]) {
    const promises = queries.map((query) => {
      const key = keyOf(query)
      const current = this.inflight.get(key) ?? this.waiting.get(key)?.done.promise

      if (current) {
        return current
      }

      const done = createDeferred()

      this.waiting.set(key, { query, done })
      return done.promise
    })

    if (!this.isFlushScheduled) {
      this.isFlushScheduled = true
      setTimeout(() => this.flush(), 0)
    }

    await Promise.all(promises)
  }

  /** Забыть отказ запросов перед повтором: следующий проход снова соберёт их как потребности. */
  forgetFailures(keys: string[]) {
    keys.forEach((key) => this.failures.delete(key))
  }

  /** Отправка накопленного одним пакетом; `get` одной коллекции склеиваются в один список id. */
  private async flush() {
    const items = [...this.waiting.values()]
    const batch: QueryBatch = { queries: mergeGets(items.map((item) => item.query)) }

    this.waiting.clear()
    this.isFlushScheduled = false

    items.forEach((item) => this.inflight.set(keyOf(item.query), item.done.promise))

    try {
      const answer = await withRetries(() => this.transport.query(batch), this.retries)

      this.applyAnswer(batch, answer)

      items.forEach((item) => {
        this.failures.delete(keyOf(item.query))
        item.done.resolve()
      })
    } catch (error) {
      items.forEach((item) => {
        this.failures.add(keyOf(item.query))
        item.done.reject(error)
      })
    } finally {
      items.forEach((item) => this.inflight.delete(keyOf(item.query)))
    }
  }

  /**
   * Ответ в хранилище. Склейка ответа с событиями, пришедшими в другом порядке, — известная проблема первой версии:
   * ответ кладётся как есть.
   */
  private applyAnswer(batch: QueryBatch, answer: QueryAnswer) {
    const change = emptyChange()

    answer.records.forEach((version) => this.put(version, change))
    batch.queries.forEach((query, i) => this.applyResult({ query, result: answer.results[i], change }))

    this.notify(change)
  }

  private applyResult({ query, result, change }: ApplyResultParams) {
    const key = keyOf(query)

    if (query.kind === 'get' && 'ids' in result) {
      const missing = query.ids.filter((id) => !result.ids.includes(id))

      missing.forEach((id) => {
        this.absent.add(`${query.collection}:${id}`)
        change.records.set(`${query.collection}:${id}`, null)
      })

      return
    }

    if (query.kind === 'count' && 'count' in result) {
      this.counts.set(key, { collection: query.collection, where: query.where, value: result.count })
      change.queries.add(key)
      return
    }

    if (query.kind === 'find' && 'ids' in result) {
      const { collection, where } = query

      if (where === null) {
        this.complete.add(collection)
        change.collections.add(collection)
      }

      if (where !== null) {
        this.finds.set(key, { collection, where, ids: new Set(result.ids) })
      }

      change.queries.add(key)
    }
  }

  // events

  /**
   * Событие из потока. Порядок задаёт только поток: события идут подряд, а первое задаёт эпоху и ревизию. Другая эпоха
   * или разрыв ревизий значат, что события потеряны, — клиент забывает всё.
   */
  push(event: DomainEvent) {
    const isNext = event.epoch === this.epoch && event.revision === this.revision + 1

    if (this.epoch !== null && !isNext) {
      this.resync('stream')
      return
    }

    this.epoch = event.epoch
    this.revision = event.revision
    this.applyEvent(event)
  }

  /**
   * Событие журнала. Новая версия записи кладётся, если запись у клиента есть или известно, что её нет, коллекция
   * загружена целиком или её ждёт живой запрос. Живые `find` пересчитываются фильтром, счётчики затронутых коллекций
   * перезапрашиваются с задержкой.
   */
  private applyEvent(event: DomainEvent) {
    const change = emptyChange()

    for (const version of event.changes) {
      const { collection, id, record } = version
      const entries = [...this.finds].filter(([, entry]) => entry.collection === collection)
      const isMatched = record !== null && entries.some(([, entry]) => matches(record, entry.where))

      if (isMatched || this.isKnown(collection, id) || this.complete.has(collection)) {
        this.put(version, change)
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

      this.scheduleCounts(collection)
    }

    this.notify(change)
  }

  // calls

  /**
   * Вызов операции: `transport.call` → событие журнала → результат. После `await` хранилище уже содержит изменения
   * вызова. Событие применяется сразу, только если поток до него ещё не дошёл: иначе его версии могут быть старше тех,
   * что принёс поток; ревизию оно не двигает, поток доставит его сам. Записи события собственного вызова клиент
   * сохраняет все — после `create` обычно открывают созданное: те, что применение не положило (их не ждал ни один
   * запрос), кладутся отдельно.
   */
  async call(operation: DomainCall) {
    const event = await this.transport.call(operation)

    if (event.revision > this.revision) {
      this.applyEvent(event)
    }

    const change = emptyChange()
    const unknown = event.changes.filter((version) => !this.isKnown(version.collection, version.id))

    unknown.forEach((version) => this.put(version, change))
    this.notify(change)

    return event.result
  }

  // counts

  private scheduleCounts(collection: string) {
    if (this.complete.has(collection) || this.countTimers.has(collection)) {
      return
    }

    const timer = setTimeout(() => this.refreshCounts(collection), this.countDelay)

    this.countTimers.set(collection, timer)
  }

  /** Перезапрос счётчиков коллекции мимо покрытия: числа заменяются новыми. */
  private async refreshCounts(collection: string) {
    this.countTimers.delete(collection)

    const entries = [...this.counts.values()].filter((entry) => entry.collection === collection)
    const queries: Query[] = entries.map((entry) => ({ kind: 'count', collection, where: entry.where }))

    if (queries.length === 0) {
      return
    }

    const batch = { queries }

    try {
      const answer = await withRetries(() => this.transport.query(batch), this.retries)

      this.applyAnswer(batch, answer)
    } catch {
      // прежнее число остаётся до следующего изменения коллекции
    }
  }

  // resync

  /**
   * Забыть всё и начать заново, без перезагрузки страницы: хранилище и запросы пусты, поток начинается с первого
   * события. Все подписчики получают изменение «всё»: смонтированные перерисовываются и перезапрашивают то, что читают.
   */
  resync(reason: string) {
    this.records.clear()
    this.absent.clear()
    this.complete.clear()
    this.finds.clear()
    this.counts.clear()
    this.failures.clear()

    this.countTimers.forEach((timer) => clearTimeout(timer))
    this.countTimers.clear()

    this.epoch = null
    this.revision = 0

    this.onResync?.(reason)
    this.notify({ ...emptyChange(), everything: true })
  }

  // store

  subscribe(listener: (change: ClientChange) => void) {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(change: ClientChange) {
    this.listeners.forEach((listener) => listener(change))
  }

  private recordOf(collection: string, id: IType) {
    return this.records.get(collection)?.get(id) ?? null
  }

  /** Запись есть у клиента или известно, что её нет. */
  private isKnown(collection: string, id: IType) {
    return this.recordOf(collection, id) !== null || this.absent.has(`${collection}:${id}`)
  }

  /** Версия записи на место прежней; какие поля изменились — для подписок. */
  private put({ collection, id, record }: RecordVersion, change: ClientChange) {
    const prev = this.recordOf(collection, id)
    const key = `${collection}:${id}`

    if (this.complete.has(collection)) {
      change.collections.add(collection)
    }

    if (record === null) {
      this.records.get(collection)?.delete(id)
      this.absent.add(key)
      change.records.set(key, null)
      return
    }

    if (!this.records.has(collection)) {
      this.records.set(collection, new Map())
    }

    this.records.get(collection)!.set(id, record)
    this.absent.delete(key)
    change.records.set(key, prev === null ? null : changedFields(prev, record))
  }
}

// helpers

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
