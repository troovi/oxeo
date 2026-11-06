/**
 * Живая часть базы сервера на клиенте: версии записей, результаты запросов и значения представлений. Догружает
 * недостающее пакетами с повторами, применяет события (новые версии записей), сверяя их с живыми запросами, и вызывает
 * операции. Схемы не знает: записи приходят вместе с коллекцией и id. Объект данных и вызовы операций над ним собирает
 * `createClient`.
 */
import isEqual from 'fast-deep-equal'
import { compareEntries, matches, windowOf } from '@oxeo/scheme/filter'
import type {
  DomainCall,
  DomainEvent,
  IType,
  Queries,
  Query,
  QueryAnswer,
  QueryBatch,
  QueryError,
  QueryResult,
  QueryResults,
  RecordVersion
} from '@oxeo/scheme'
import { globalState } from './global-state'
import { ClientChange, Tracker, emptyChange } from './tracker'

// types

/** Обращения к серверу. Их задаёт приложение: адрес, заголовки, авторизация. */
export interface ClientTransport {
  /** Пакет запросов: `POST data/query` или как устроит приложение; представлениям сервер нужен с идентичностью. */
  query(batch: QueryBatch): Promise<QueryAnswer>
  /** Вызов операции: ответ — её событие. */
  call(call: DomainCall): Promise<DomainEvent>
}

export interface ClientOptions {
  transport: ClientTransport
  /** Паузы перед повторами неудавшегося пакета, мс: сколько пауз — столько повторов. */
  retries?: number[]
  /**
   * Задержка перезапроса после изменений, мс: счётчиков и представлений по тронутым коллекциям, окон `find`, которые
   * событие не может поправить на месте. События подряд дают один пакет перезапроса.
   */
  refreshDelay?: number
  /** Клиент забыл всё и начинает заново: команда сервера, смена эпохи, разрыв ревизий. */
  onResync?: (reason: string) => void
}

/** Сервер отказал запросу: коллекции нет, параметры не прошли схему, представление упало. */
export class QueryFailedError extends Error {
  constructor(
    readonly key: string,
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'QueryFailedError'
  }
}

/** Чтение вне рендера того, чего у клиента нет: прочитать при рисовании или загрузить явно (`load`). */
export class UncoveredReadError extends Error {
  constructor(key: string) {
    super(`oxeo: ${key} не загружено — прочитайте это при рисовании или загрузите через load`)
    this.name = 'UncoveredReadError'
  }
}

interface FindEntry {
  query: Queries.Find
  where: object
  ids: Set<IType>
}

interface CountEntry {
  query: Queries.Count
  value: number
}

interface ViewEntry {
  query: Queries.View
  value: unknown
  /** Коллекции, которые представление читало на сервере: их изменения перезапрашивают значение. */
  reads: string[]
}

/** Запросы, которые уйдут одним пакетом в конце такта; `done` — его итог. */
interface NextBatch {
  queries: Map<string, Query>
  done: Promise<void>
}

interface ApplyResultParams {
  query: Query
  result: Exclude<QueryResult, QueryResults.Failure>
  change: ClientChange
}

interface ApplyAnswerParams {
  batch: QueryBatch
  answer: QueryAnswer
  /** Исходные запросы пакета по ключам — до склейки `get`. */
  origins: Map<string, Query>
}

interface ApplyFailureParams {
  query: Query
  error: QueryError
  origins: Map<string, Query>
  change: ClientChange
}

interface ApplyMembershipParams {
  entry: FindEntry
  id: IType
  isMember: boolean
}

interface ApplyWindowParams extends ApplyMembershipParams {
  key: string
  /** Прежняя версия записи: сдвинул ли её порядок. */
  prev: object | null
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
  private views = new Map<string, ViewEntry>()
  /** Запросы, загрузка которых не удалась: пакет — после повторов, запрос — отказом сервера; значение — ошибка. */
  private failures = new Map<string, Error>()
  private listeners = new Set<(change: ClientChange) => void>()

  // loading

  private nextBatch: NextBatch | null = null
  /** Запросы в пути, отправленные и ещё нет: повторная потребность ждёт их, а не шлёт снова. */
  private inflight = new Map<string, Promise<void>>()
  /** Номер состояния: растёт с каждой пересинхронизацией, ответ на пакет прежнего состояния не кладётся. */
  private generation = 0
  /** Покрытые запросы, чьё значение устарело: уйдут одним пакетом перезапроса после задержки. */
  private stale = new Map<string, Query>()
  private staleTimer: ReturnType<typeof setTimeout> | null = null

  // stream

  /** Эпоха потока событий; `null` — первого события ещё не было. */
  private epoch: string | null = null
  /** Докуда дошёл поток: растёт только на его событиях. */
  private revision = 0

  // options

  private transport: ClientTransport
  private retries: number[]
  private refreshDelay: number
  private onResync: ClientOptions['onResync']

  constructor({ transport, retries = [300, 1000, 3000], refreshDelay = 300, onResync }: ClientOptions) {
    this.transport = transport
    this.retries = retries
    this.refreshDelay = refreshDelay
    this.onResync = onResync
  }

  // coverage

  /**
   * Покрыт ли запрос: значение представления есть, коллекция целиком, живой запрос с тем же ключом, запись по id есть или
   * её точно нет.
   */
  private isCovered(query: Query) {
    if (query.kind === 'view') {
      return this.views.has(keyOf(query))
    }

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

  /**
   * Записи покрытого `find` в порядке запроса: по живому запросу или отбором из коллекции, загруженной целиком, — тогда
   * окно считается на месте.
   */
  private entriesOf(query: Queries.Find): RecordEntry[] {
    const entry = this.finds.get(keyOf(query))
    const records = this.records.get(query.collection) ?? new Map<IType, object | null>()

    if (entry) {
      const members = [...entry.ids].map((id): RecordEntry => [id, records.get(id)!])

      return windowOf(members, { order: query.order, limit: query.limit })
    }

    const found = [...records].filter((item): item is RecordEntry => {
      return item[1] !== null && matches(item[1], query.where ?? {})
    })

    return windowOf(found, { order: query.order, limit: query.limit })
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

    return emptyOf(query)
  }

  /** Значение покрытого запроса; в проходе рендера записи идут через прокси сборщика. */
  private valueOf(query: Query, tracker: Tracker | null) {
    if (query.kind === 'view') {
      return this.views.get(keyOf(query))!.value
    }

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

  /**
   * Явная загрузка для обработчика: непокрытое — с сервера, покрытое — сразу; пересинхронизация в пути — снова. Прежний
   * отказ запроса забывается, новый — ошибка.
   */
  async load(query: Queries.Find) {
    const key = keyOf(query)

    this.failures.delete(key)

    while (!this.isCovered(query)) {
      await this.request([query])

      const failure = this.failures.get(key)

      if (failure) {
        throw failure
      }
    }

    return this.read(query) as object[]
  }

  /** Запомнить в сборщике, от чего зависит проход: запись, состав запроса, коллекция целиком, значение. */
  private watch(tracker: Tracker, query: Query) {
    if (query.kind === 'get') {
      tracker.fieldsOf(`${query.collection}:${query.ids[0]}`)
      return
    }

    tracker.queries.add(keyOf(query))

    if (query.kind !== 'view') {
      tracker.collections.add(query.collection)
    }
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

  /**
   * Отправка накопленного одним пакетом; `get` одной коллекции склеиваются в один список id. Итог пакета пишется в наборы
   * того состояния, в котором он ушёл: у нового состояния они свои. Отказ пакета — отказ всех его запросов; отказ
   * запроса сервером ставит ответ (`applyAnswer`).
   */
  private async flush(queries: Map<string, Query>) {
    const keys = [...queries.keys()]
    const batch: QueryBatch = { queries: mergeGets([...queries.values()]) }
    const { inflight, failures } = this

    this.nextBatch = null
    keys.forEach((key) => failures.delete(key))

    try {
      await this.send(batch, queries)
    } catch (error) {
      keys.forEach((key) => failures.set(key, error as Error))
      throw error
    } finally {
      keys.forEach((key) => inflight.delete(key))
    }
  }

  /**
   * Пакет на сервер с повторами и ответ в хранилище. Пока пакет шёл, клиент мог забыть всё: такой ответ снят с прежнего
   * состояния и не кладётся, а его отказ уже никому не нужен.
   */
  private async send(batch: QueryBatch, origins: Map<string, Query> = new Map()) {
    const { generation } = this

    try {
      const answer = await withRetries(() => this.transport.query(batch), this.retries)

      if (generation === this.generation) {
        this.applyAnswer({ batch, answer, origins })
      }
    } catch (error) {
      if (generation === this.generation) {
        throw error
      }
    }
  }

  /**
   * Ответ в хранилище. Склейка ответа с событиями, пришедшими в другом порядке, — известная проблема первой версии:
   * ответ кладётся как есть.
   */
  private applyAnswer({ batch, answer, origins }: ApplyAnswerParams) {
    const change = emptyChange()

    answer.records.forEach((version) => this.put(version, change))

    batch.queries.forEach((query, i) => {
      const result = answer.results[i]

      if ('error' in result) {
        this.applyFailure({ query, error: result.error, origins, change })
        return
      }

      this.applyResult({ query, result, change })
    })

    this.notify(change)
  }

  /**
   * Отказ запроса сервером: непокрытый запрос становится отказавшим — проход покажет вид ошибки обёртки, `load` бросит;
   * у покрытого (перезапрос устаревшего) остаётся прежнее значение. Склеенный `get` отказывает за все `get` своей
   * коллекции из пакета.
   */
  private applyFailure({ query, error, origins, change }: ApplyFailureParams) {
    const sources =
      query.kind === 'get' ? [...origins].filter(([, origin]) => isSameGet(origin, query)) : []
    const failed = query.kind === 'get' ? sources : [[keyOf(query), query] as const]

    for (const [key, origin] of failed) {
      if (!this.isCovered(origin)) {
        this.failures.set(key, new QueryFailedError(key, error.code, error.message))
        change.queries.add(key)
      }
    }
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

    if (query.kind === 'view' && 'value' in result) {
      this.views.set(key, { query, value: result.value, reads: result.reads })
      change.queries.add(key)
      return
    }

    if (query.kind === 'find' && 'ids' in result) {
      const { collection, where } = query

      if (where === null && query.limit === undefined) {
        this.complete.add(collection)
        change.collections.add(collection)
      }

      if (where !== null || query.limit !== undefined) {
        this.finds.set(key, { query, where: where ?? {}, ids: new Set(result.ids) })
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
   * загружена целиком или её ждёт живой запрос. Живые `find` пересчитываются фильтром, окна — ещё и порядком; счётчики и
   * представления тронутых коллекций перезапрашиваются с задержкой.
   */
  private applyEvent(event: DomainEvent) {
    const change = emptyChange()

    for (const version of event.changes) {
      const { collection, id, record } = version
      const prev = this.records.get(collection)?.get(id) ?? null
      const entries = [...this.finds].filter(([, entry]) => entry.query.collection === collection)
      const isMatched = record !== null && entries.some(([, entry]) => matches(record, entry.where))

      if (isMatched || this.isKnown(collection, id) || this.complete.has(collection)) {
        this.put(version, change)
      }

      for (const [key, entry] of entries) {
        const isMember = record !== null && matches(record, entry.where)
        const isChanged =
          entry.query.limit === undefined
            ? this.applyMembership({ entry, id, isMember })
            : this.applyWindow({ key, entry, id, isMember, prev })

        if (isChanged) {
          change.queries.add(key)
        }
      }

      this.markCollectionStale(collection)
    }

    this.notify(change)
  }

  /** Живой `find` без предела: запись входит в состав, если подходит под фильтр. Ответ — изменился ли состав. */
  private applyMembership({ entry, id, isMember }: ApplyMembershipParams) {
    if (isMember === entry.ids.has(id)) {
      return false
    }

    if (isMember) {
      entry.ids.add(id)
    } else {
      entry.ids.delete(id)
    }

    return true
  }

  /**
   * Окно — первые `limit` записей в порядке запроса. Неполное окно — это все подходящие записи: оно правится как
   * обычный `find`. В полном окне за худшим членом могут быть записи, которых у клиента нет, поэтому:
   *
   * - новая запись входит, только если она лучше худшего члена, — худший тогда выходит;
   * - член, ушедший из окна или сдвинутый порядком в худшие, означает, что окно с этой стороны неизвестно: оно
   *   перезапрашивается, а до ответа показывает прежний состав без ушедшего.
   *
   * Ответ — изменился ли состав.
   */
  private applyWindow({ key, entry, id, isMember, prev }: ApplyWindowParams) {
    const { query, ids } = entry
    const isFull = ids.size >= query.limit!

    if (!isFull) {
      return this.applyMembership({ entry, id, isMember })
    }

    if (!isMember) {
      if (ids.delete(id)) {
        this.markStale(key, query)
        return true
      }

      return false
    }

    const records = this.records.get(query.collection)!
    const members = [...ids].map((member): RecordEntry => [member, records.get(member)!])
    const worst = windowOf(members, { order: query.order, limit: query.limit }).at(-1)
    const record = records.get(id)!

    if (!worst) {
      return false
    }

    if (ids.has(id)) {
      const field = query.order?.field as keyof object | undefined
      const isMoved = field !== undefined && (prev === null || !isEqual(prev[field], record[field]))

      if (isMoved && worst[0] === id) {
        this.markStale(key, query)
      }

      return false
    }

    if (compareEntries(query.order, [id, record], worst) >= 0) {
      return false
    }

    ids.delete(worst[0])
    ids.add(id)
    return true
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

  // refresh

  /**
   * Коллекция изменилась: устарели её счётчики (у коллекции целиком они считаются на месте) и представления, которые её
   * читали.
   */
  private markCollectionStale(collection: string) {
    if (!this.complete.has(collection)) {
      this.counts.forEach((entry, key) => {
        if (entry.query.collection === collection) {
          this.markStale(key, entry.query)
        }
      })
    }

    this.views.forEach((entry, key) => {
      if (entry.reads.includes(collection)) {
        this.markStale(key, entry.query)
      }
    })
  }

  /** Запрос устарел: перезапрос уйдёт пакетом после задержки, вместе с другими устаревшими. */
  private markStale(key: string, query: Query) {
    this.stale.set(key, query)
    this.staleTimer ??= setTimeout(() => this.refreshStale(), this.refreshDelay)
  }

  /** Перезапрос устаревших мимо покрытия: значения заменяются новыми. */
  private async refreshStale() {
    const queries = [...this.stale.values()]

    this.stale.clear()
    this.staleTimer = null

    try {
      await this.send({ queries })
    } catch {
      // прежнее значение остаётся до следующего изменения
    }
  }

  // resync

  /**
   * Забыть всё и начать заново, без перезагрузки страницы: хранилище и запросы пусты, поток начинается с первого
   * события, пакеты в полёте больше не считаются. Все подписчики получают изменение «всё»: смонтированные
   * перерисовываются и перезапрашивают то, что читают.
   */
  resync(reason: string) {
    this.records.clear()
    this.complete.clear()
    this.finds.clear()
    this.counts.clear()
    this.views.clear()

    this.failures = new Map()
    this.inflight = new Map()
    this.generation += 1

    if (this.staleTimer) {
      clearTimeout(this.staleTimer)
    }

    this.stale.clear()
    this.staleTimer = null

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
    globalState.changes += 1
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

/**
 * Ключ запроса: вид, коллекция и фильтр, окно или id; у представления — имя, метод и параметры. Одинаковые запросы
 * разных компонентов — один ключ.
 */
const keyOf = (query: Query) => {
  if (query.kind === 'get') {
    return `get:${query.collection}:${query.ids.join(',')}`
  }

  if (query.kind === 'view') {
    return `view:${query.view}.${query.method}:${JSON.stringify(query.params ?? null)}`
  }

  if (query.kind === 'find' && (query.order || query.limit !== undefined)) {
    const window = JSON.stringify({ order: query.order, limit: query.limit })

    return `find:${query.collection}:${JSON.stringify(query.where)}:${window}`
  }

  return `${query.kind}:${query.collection}:${JSON.stringify(query.where)}`
}

/** Пустое значение непокрытого чтения в проходе рендера — того же вида, что ответ; проход всё равно отбросится. */
const emptyOf = (query: Query) => {
  if (query.kind === 'find') {
    return []
  }

  return query.kind === 'count' ? 0 : null
}

/** Поля верхнего уровня, которые отличаются у двух версий записи. */
const changedFields = (prev: object, next: object) => {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)])

  return [...keys].filter((key) => !isEqual(prev[key as keyof object], next[key as keyof object]))
}

/** Исходный `get` вошёл в склеенный: та же коллекция. */
const isSameGet = (origin: Query, merged: Queries.Get) => {
  return origin.kind === 'get' && origin.collection === merged.collection
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
