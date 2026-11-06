/**
 * Живая часть базы сервера на клиенте: версии записей и результаты запросов. Догружает недостающее пакетами с
 * повторами, применяет события (новые версии записей), сверяя их с живыми запросами, и вызывает операции. Схемы
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
  /** Вызов операции: ответ — её событие. */
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
  query: Queries.Count
  value: number
}

/** Запросы, которые уйдут одним пакетом в конце такта; `done` — его итог. */
interface NextBatch {
  queries: Map<string, Query>
  done: Promise<void>
}

interface ApplyResultParams {
  query: Query
  result: QueryResult
  change: ClientChange
}

/** Запись вместе с id: схемы у клиента нет, и какое поле записи — id, он не знает. */
type RecordEntry = [IType, object]

export class LiveStore {
  // store

  /**
   * Версии записей по коллекциям; версия неизменяема — новая кладётся новым объектом. `null` — известно, что записи нет:
   * сервер её не нашёл или событие её удалило.
   */
  private records = new Map<string, Map<IType, object | null>>()
  /** Коллекции, загруженные целиком: любой запрос к ним отвечается на месте. */
  private complete = new Set<string>()
  /** Живые запросы по ключу. */
  private finds = new Map<string, FindEntry>()
  private counts = new Map<string, CountEntry>()
  /** Запросы, загрузка которых не удалась после повторов. */
  private failures = new Set<string>()
  private listeners = new Set<(change: ClientChange) => void>()

  // loading

  private nextBatch: NextBatch | null = null
  /** Запросы в пути, отправленные и ещё нет: повторная потребность ждёт их, а не шлёт снова. */
  private inflight = new Map<string, Promise<void>>()
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
    const records = this.records.get(query.collection) ?? new Map<IType, object | null>()

    if (entry) {
      return [...entry.ids].map((id): RecordEntry => [id, records.get(id)!])
    }

    return [...records].filter((item): item is RecordEntry => {
      return item[1] !== null && matches(item[1], query.where ?? {})
    })
  }

  /** Число покрытого `count`: отбором из коллекции, загруженной целиком, иначе — по живому счётчику. */
  private countOf(query: Queries.Count) {
    if (this.complete.has(query.collection)) {
      return this.entriesOf({ ...query, kind: 'find' }).length
    }

    return this.counts.get(keyOf(query))!.value
  }

  // reads

  /**
   * Чтение: в проходе рендера — запомнить прочитанное и, если не покрыто, записать потребность (или отказ, если запрос
   * уже не удался) и отдать пустое; записи — через прокси сборщика. Вне рендера — только покрытое.
   */
  read(query: Query) {
    const tracker = globalState.currentTracker

    if (tracker) {
      this.watch(tracker, query)
    }

    if (this.isCovered(query)) {
      return this.valueOf(query, tracker)
    }

    if (tracker === null) {
      throw new UncoveredReadError(keyOf(query))
    }

    const key = keyOf(query)

    if (this.failures.has(key)) {
      tracker.failures.add(key)
    }

    if (!this.failures.has(key)) {
      tracker.needs.set(key, query)
    }

    return query.kind === 'get' ? null : query.kind === 'count' ? 0 : []
  }

  /** Значение покрытого запроса; в проходе рендера записи идут через прокси сборщика. */
  private valueOf(query: Query, tracker: Tracker | null) {
    const track = (id: IType, record: object) => {
      return tracker ? tracker.track(`${query.collection}:${id}`, record) : record
    }

    if (query.kind === 'get') {
      const [id] = query.ids
      const record = this.records.get(query.collection)?.get(id) ?? null

      return record && track(id, record)
    }

    if (query.kind === 'count') {
      return this.countOf(query)
    }

    const entries = this.entriesOf(query)

    return entries.map(([id, record]) => track(id, record))
  }

  /** Явная загрузка для обработчика: непокрытое — с сервера, покрытое — сразу. */
  async load(query: Queries.Find) {
    if (!this.isCovered(query)) {
      await this.request([query])
    }

    return this.read(query) as object[]
  }

  /** Запомнить в сборщике, от чего зависит проход: запись, состав запроса, коллекция целиком. */
  private watch(tracker: Tracker, query: Query) {
    if (query.kind === 'get') {
      tracker.fieldsOf(`${query.collection}:${query.ids[0]}`)
      return
    }

    tracker.queries.add(keyOf(query))
    tracker.collections.add(query.collection)
  }

  // loading

  /** Загрузить запросы: промис разрешается, когда все покрыты, и отклоняется, если пакет не удался после повторов. */
  async request(queries: Query[]) {
    const promises = queries.map((query) => {
      const key = keyOf(query)
      const current = this.inflight.get(key)

      if (current) {
        return current
      }

      this.nextBatch ??= this.createBatch()
      this.nextBatch.queries.set(key, query)
      this.inflight.set(key, this.nextBatch.done)

      return this.nextBatch.done
    })

    await Promise.all(promises)
  }

  /** Новый пакет: копит запросы до конца такта, затем уходит. */
  private createBatch() {
    const queries = new Map<string, Query>()
    const tick = new Promise((resolve) => setTimeout(resolve, 0))

    return { queries, done: tick.then(() => this.flush(queries)) }
  }

  /** Забыть отказ запросов перед повтором: следующий проход снова соберёт их как потребности. */
  forgetFailures(keys: string[]) {
    keys.forEach((key) => this.failures.delete(key))
  }

  /** Отправка накопленного одним пакетом; `get` одной коллекции склеиваются в один список id. */
  private async flush(queries: Map<string, Query>) {
    const keys = [...queries.keys()]
    const batch: QueryBatch = { queries: mergeGets([...queries.values()]) }

    this.nextBatch = null

    try {
      const answer = await withRetries(() => this.transport.query(batch), this.retries)

      this.applyAnswer(batch, answer)
      keys.forEach((key) => this.failures.delete(key))
    } catch (error) {
      keys.forEach((key) => this.failures.add(key))
      throw error
    } finally {
      keys.forEach((key) => this.inflight.delete(key))
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
      const unknown = missing.filter((id) => !this.isKnown(query.collection, id))

      unknown.forEach((id) => this.put({ collection: query.collection, id, record: null }, change))
      return
    }

    if (query.kind === 'count' && 'count' in result) {
      this.counts.set(key, { query, value: result.count })
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
   * Применение события. Новая версия записи кладётся, если запись у клиента есть или известно, что её нет, коллекция
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
   * Вызов операции: `transport.call` → событие → результат. После `await` хранилище уже содержит изменения
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

    const entries = [...this.counts.values()].filter((entry) => entry.query.collection === collection)
    const queries = entries.map((entry) => entry.query)

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

  /** Запись есть у клиента или известно, что её нет. */
  private isKnown(collection: string, id: IType) {
    return this.records.get(collection)?.has(id) ?? false
  }

  /** Версия записи на место прежней; какие поля изменились — для подписок. */
  private put({ collection, id, record }: RecordVersion, change: ClientChange) {
    const records = this.records.get(collection) ?? new Map<IType, object | null>()
    const prev = records.get(id) ?? null

    records.set(id, record)
    this.records.set(collection, records)
    change.records.set(`${collection}:${id}`, prev && record && changedFields(prev, record))

    if (this.complete.has(collection)) {
      change.collections.add(collection)
    }
  }
}

// helpers

/** Ключ запроса: вид, коллекция и фильтр или id; одинаковые запросы разных компонентов — один ключ. */
const keyOf = (query: Query) => {
  if (query.kind === 'get') {
    return `get:${query.collection}:${query.ids.join(',')}`
  }

  return `${query.kind}:${query.collection}:${JSON.stringify(query.where)}`
}

/** Поля верхнего уровня, которые отличаются у двух версий записи. */
const changedFields = (prev: object, next: object) => {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)])

  return [...keys].filter((key) => !isEqual(prev[key as keyof object], next[key as keyof object]))
}

/** `get` одной коллекции — в один запрос со списком id. */
const mergeGets = (queries: Query[]) => {
  const gets = queries.filter((query): query is Queries.Get => query.kind === 'get')
  const others = queries.filter((query) => query.kind !== 'get')
  const collections = new Set(gets.map((query) => query.collection))

  const merged = [...collections].map((collection): Query => {
    const sameCollection = gets.filter((query) => query.collection === collection)

    return { kind: 'get', collection, ids: sameCollection.flatMap((query) => query.ids) }
  })

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
