/**
 * Живая часть базы сервера на клиенте: версии записей, результаты запросов и значения представлений. Догружает
 * недостающее пакетами с повторами, применяет события (новые версии записей), сверяя их с живыми запросами, и вызывает
 * операции. Схемы не знает: записи приходят вместе с коллекцией и id. Читают его только сборщики (`Tracker`), разовое
 * чтение и вызовы операций над ним собирает `createClient`.
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
  /**
   * Чтение компонента не удалось: пакет — после повторов, запрос — отказом сервера. Один вызов на пакет: так приложение
   * показывает отказ там, где компонент его не рисует. Разовое чтение получает отказ промисом и сюда не приходит.
   */
  onReadError?: (error: Error) => void
}

export interface RequestOptions {
  /** Отказ получит тот, кто ждёт промис: `onReadError` не нужен. */
  isQuiet?: boolean
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

interface FindEntry {
  query: Queries.Find
  where: object
  ids: Set<IType>
  /** Ревизия ответа, который задал состав: события не новее неё он уже учёл. */
  revision: number
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
  /** В пакете есть чтения компонентов: его отказ уйдёт в `onReadError`. */
  isReported: boolean
  done: Promise<void>
}

interface ApplyResultParams {
  query: Query
  result: Exclude<QueryResult, QueryResults.Failure>
  change: ClientChange
  /**
   * Ревизия ответа (`answeredAt`; у ответа без ревизии — докуда дошёл поток): ею помечаются состав `find`, коллекция
   * целиком и записи, которых нет.
   */
  revision: number
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
  /** Прежняя версия записи: сдвинул ли её порядок; `null` — неизвестно, считается сдвинутой. */
  prev: object | null
}

interface ApplyVersionParams {
  version: RecordVersion
  /** Ревизия события, которое принесло версию. */
  revision: number
  change: ClientChange
  /** Ключи запросов, чей состав пересчитать; без них — всех живых `find`. */
  keys?: Set<string>
}

interface ReplayParams {
  batch: QueryBatch
  /** Ревизия ответа: события не новее неё он уже учёл. */
  revision: number
  change: ClientChange
}

interface PutParams {
  version: RecordVersion
  change: ClientChange
  /** Ревизия события, которое принесло версию, или ответа (`answeredAt`). */
  revision: number
}

/** Пакет в пути: докуда дошёл поток, когда пакет ушёл. */
interface BatchTicket {
  revision: number
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
  /**
   * Ревизии версий записей: событие какой ревизии или ответ с какой ревизией положил версию (или узнал, что записи нет).
   * Версия старше известной не кладётся — так ответ и события склеиваются в любом порядке прихода.
   */
  private revisions = new Map<string, Map<IType, number>>()
  /**
   * Коллекции, загруженные целиком, и ревизия ответа, который их загрузил: любой запрос к ним отвечается на месте, а
   * событие не новее этой ревизии новой записи не добавит — ответ его уже учёл.
   */
  private complete = new Map<string, number>()
  /** Живые запросы по ключу. */
  private finds = new Map<string, FindEntry>()
  private counts = new Map<string, CountEntry>()
  private views = new Map<string, ViewEntry>()
  /** Запросы, загрузка которых не удалась: пакет — после повторов, запрос — отказом сервера; значение — ошибка. */
  private failures = new Map<string, Error>()
  private listeners = new Set<(change: ClientChange) => void>()
  /** Сколько раз менялись данные: сборщик сверяет его, когда подписка появляется позже прохода. */
  changes = 0

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
  /** Докуда дошёл поток: растёт только на его событиях; `0` — событий ещё не было. */
  private revision = 0
  /** Пакеты в пути: событий новее их ревизий потока ответ мог не учесть. */
  private batches = new Set<BatchTicket>()
  /**
   * События, пришедшие, пока пакеты в пути: ответ, снятый раньше события, заново применяет его к своим запросам. Пустеет,
   * когда пакетов в пути нет.
   */
  private journal: DomainEvent[] = []

  // options

  private transport: ClientTransport
  private retries: number[]
  private refreshDelay: number
  private onResync: ClientOptions['onResync']
  private onReadError: ClientOptions['onReadError']

  constructor(options: ClientOptions) {
    const {
      transport,
      retries = [300, 1000, 3000],
      refreshDelay = 300,
      onResync,
      onReadError
    } = options

    this.transport = transport
    this.retries = retries
    this.refreshDelay = refreshDelay
    this.onResync = onResync
    this.onReadError = onReadError
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
   * Чтение прохода: запомнить прочитанное и, если не покрыто, записать потребность (или отказ, если запрос уже не удался)
   * и отдать пустое; записи — через сборщик.
   */
  read(query: Query, tracker: Tracker) {
    this.watch(tracker, query)

    if (this.isCovered(query)) {
      return this.valueOf(query, tracker)
    }

    const key = keyOf(query)
    const failure = this.failures.get(key)

    if (failure) {
      tracker.failures.set(key, failure)
    }

    if (!failure) {
      tracker.needs.set(key, query)
    }

    return emptyOf(query)
  }

  /** Значение покрытого запроса; записи идут через сборщик. */
  private valueOf(query: Query, tracker: Tracker) {
    if (query.kind === 'view') {
      return this.views.get(keyOf(query))!.value
    }

    const track = (id: IType, record: object) => {
      return tracker.track(`${query.collection}:${id}`, record)
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
   * Запомнить в сборщике, от чего зависит проход: запись, состав запроса, коллекция целиком, значение. Ключ `get` нужен
   * ради отказа: изменение несёт его среди запросов.
   */
  private watch(tracker: Tracker, query: Query) {
    tracker.queries.add(keyOf(query))

    if (query.kind === 'get') {
      tracker.fieldsOf(`${query.collection}:${query.ids[0]}`)
      return
    }

    if (query.kind !== 'view') {
      tracker.collections.add(query.collection)
    }
  }

  // loading

  /** Загрузить запросы: промис разрешается, когда все покрыты, и отклоняется, если пакет не удался после повторов. */
  async request(queries: Query[], { isQuiet = false }: RequestOptions = {}) {
    const promises = queries.map((query) => {
      const key = keyOf(query)
      const current = this.inflight.get(key)

      if (current) {
        return current
      }

      this.nextBatch ??= this.createBatch()
      this.nextBatch.queries.set(key, query)
      this.nextBatch.isReported ||= !isQuiet
      this.inflight.set(key, this.nextBatch.done)

      return this.nextBatch.done
    })

    await Promise.all(promises)
  }

  /** Новый пакет: копит запросы до конца такта, затем уходит. */
  private createBatch() {
    const tick = new Promise((resolve) => setTimeout(resolve, 0))
    const batch: NextBatch = {
      queries: new Map(),
      isReported: false,
      done: tick.then(() => this.flush(batch))
    }

    return batch
  }

  /** Забыть отказ запросов перед повтором: следующий проход снова соберёт их как потребности. */
  forgetFailures(keys: string[]) {
    keys.forEach((key) => this.failures.delete(key))
  }

  /**
   * Отправка накопленного одним пакетом; `get` одной коллекции склеиваются в один список id. Итог пакета пишется в наборы
   * того состояния, в котором он ушёл: у нового состояния они свои. Отказ пакета — отказ всех его запросов; отказ
   * запроса сервером ставит ответ (`applyAnswer`). Итог с отказом уходит в `onReadError` один раз на пакет.
   */
  private async flush({ queries, isReported }: NextBatch) {
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

      const failure = keys.map((key) => failures.get(key)).find(Boolean)

      if (failure && isReported) {
        this.onReadError?.(failure)
      }
    }
  }

  /**
   * Пакет на сервер с повторами и ответ в хранилище. Пока пакет шёл, клиент мог забыть всё: такой ответ снят с прежнего
   * состояния и не кладётся, а его отказ уже никому не нужен. Пока пакет в пути, события копятся в журнале.
   */
  private async send(batch: QueryBatch, origins: Map<string, Query> = new Map()) {
    const { generation, batches } = this
    const ticket: BatchTicket = { revision: this.revision }

    batches.add(ticket)

    try {
      const answer = await withRetries(() => this.transport.query(batch), this.retries)

      if (generation === this.generation) {
        this.applyAnswer({ batch, answer, origins })
      }
    } catch (error) {
      if (generation === this.generation) {
        throw error
      }
    } finally {
      batches.delete(ticket)
      this.trimJournal()
    }
  }

  /**
   * Ответ в хранилище, склеенный с событиями. Ответ отражает базу не раньше своей ревизии: версия записи, которую клиент
   * знает от события новее, остаётся, а события новее ответа, пришедшие, пока пакет был в пути, применяются к его
   * запросам заново, — так запись, которую событие принесло раньше, чем её ждал запрос, не теряется. Ответ другой эпохи
   * значит, что сервер перезапущен: клиент забывает всё. Ответ без ревизии (сервер прежней версии) кладётся как есть.
   */
  private applyAnswer({ batch, answer, origins }: ApplyAnswerParams) {
    const isTracked = typeof answer.revision === 'number'

    if (isTracked && !this.adoptEpoch(answer.epoch)) {
      this.resync('epoch')
      return
    }

    const revision = isTracked ? answeredAt(answer.revision) : this.revision
    const change = emptyChange()

    for (const version of answer.records) {
      if (!isTracked || !this.isOutdated(version, revision)) {
        this.put({ version, change, revision })
      }
    }

    batch.queries.forEach((query, i) => {
      const result = answer.results[i]

      if ('error' in result) {
        this.applyFailure({ query, error: result.error, origins, change })
        return
      }

      this.applyResult({ query, result, change, revision })
    })

    if (isTracked) {
      this.replay({ batch, revision: answer.revision, change })
    }

    this.notify(change)
  }

  /**
   * События новее ответа, пришедшие, пока пакет был в пути, — заново к его запросам: версии записей кладутся по тем же
   * правилам, что у события, состав `find` пакета пересчитывается, его счётчики и представления, чьи коллекции событие
   * тронуло, устаревают.
   */
  private replay({ batch, revision, change }: ReplayParams) {
    const keys = new Set(batch.queries.map(keyOf))
    const events = this.journal.filter((event) => event.revision > revision)
    const touched = new Set<string>()

    events.sort((a, b) => a.revision - b.revision)

    for (const event of events) {
      for (const version of event.changes) {
        this.applyVersion({ version, revision: event.revision, change, keys })
        touched.add(version.collection)
      }
    }

    for (const key of keys) {
      const count = this.counts.get(key)
      const view = this.views.get(key)

      if (count && touched.has(count.query.collection) && !this.complete.has(count.query.collection)) {
        this.markStale(key, count.query)
      }

      if (view && view.reads.some((collection) => touched.has(collection))) {
        this.markStale(key, view.query)
      }
    }
  }

  /** Журнал нужен только пакетам в пути, и только события новее ревизии потока, с которой пакет ушёл. */
  private trimJournal() {
    if (this.batches.size === 0) {
      this.journal = []
      return
    }

    const oldest = Math.min(...[...this.batches].map((ticket) => ticket.revision))

    this.journal = this.journal.filter((event) => event.revision > oldest)
  }

  /** Эпоха ответа: первая известная принимается, другая значит, что сервер перезапущен. */
  private adoptEpoch(epoch: string) {
    this.epoch ??= epoch

    return this.epoch === epoch
  }

  /**
   * Отказ запроса сервером: непокрытый запрос становится отказавшим — проход отдаст его сборщику, разовое чтение бросит;
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

  private applyResult({ query, result, change, revision }: ApplyResultParams) {
    const key = keyOf(query)

    if (query.kind === 'get' && 'ids' in result) {
      const missing = query.ids.filter((id) => !result.ids.includes(id))
      const unknown = missing.filter((id) => !this.isKnown(query.collection, id))

      for (const id of unknown) {
        this.put({ version: { collection: query.collection, id, record: null }, change, revision })
      }

      return
    }

    if (query.kind === 'count' && 'count' in result) {
      this.counts.set(key, { query, value: result.count })
      change.queries.add(key)
      return
    }

    if (query.kind === 'view' && 'value' in result) {
      this.views.set(key, { query, value: freezeInDev(result.value), reads: result.reads })
      change.queries.add(key)
      return
    }

    if (query.kind === 'find' && 'ids' in result) {
      const { collection, where } = query

      if (where === null && query.limit === undefined) {
        this.complete.set(collection, revision)
        change.collections.add(collection)
      }

      if (where !== null || query.limit !== undefined) {
        this.finds.set(key, { query, where: where ?? {}, ids: new Set(result.ids), revision })
      }

      change.queries.add(key)
    }
  }

  // events

  /**
   * Событие из потока. Порядок задаёт только поток: события идут подряд, а первое задаёт ревизию. Другая эпоха — потока
   * или уже принятого ответа — или разрыв ревизий значат, что события потеряны, — клиент забывает всё.
   */
  push(event: DomainEvent) {
    const isFirst = this.revision === 0
    const isSameEpoch = this.epoch === null || event.epoch === this.epoch
    const isNext = isFirst ? isSameEpoch : isSameEpoch && event.revision === this.revision + 1

    if (!isNext) {
      this.resync('stream')
      return
    }

    this.epoch = event.epoch
    this.revision = event.revision
    this.applyEvent(event)
  }

  /**
   * Применение события: каждая версия — по правилам `applyVersion`; счётчики и представления тронутых коллекций
   * перезапрашиваются с задержкой. Пока пакеты в пути, событие ложится в журнал: ответ, снятый раньше него, применит его
   * к своим запросам заново.
   */
  private applyEvent(event: DomainEvent) {
    const change = emptyChange()

    if (this.batches.size > 0) {
      this.journal.push(event)
    }

    for (const version of event.changes) {
      this.applyVersion({ version, revision: event.revision, change })
      this.markCollectionStale(version.collection)
    }

    this.notify(change)
  }

  /**
   * Версия записи из события кладётся, если клиент не знает версии новее, а запись у него есть или известно, что её нет,
   * коллекция загружена целиком или её ждёт живой запрос — загруженные ответом раньше события. Состав живых `find` (при
   * повторе после ответа — только запросов его пакета), которые событие ещё не учли, пересчитывается по той версии, что
   * у клиента в итоге; окна — ещё и порядком.
   */
  private applyVersion({ version, revision, change, keys }: ApplyVersionParams) {
    const { collection, id, record } = version
    const finds = [...this.finds].filter(([, entry]) => {
      return entry.query.collection === collection && entry.revision < revision
    })
    const prev = this.records.get(collection)?.get(id) ?? null
    const loadedAt = this.complete.get(collection)
    const isMatched = record !== null && finds.some(([, entry]) => matches(record, entry.where))
    const isComplete = loadedAt !== undefined && loadedAt < revision
    const isWanted = isMatched || this.isKnown(collection, id) || isComplete

    if (isWanted && !this.isOutdated(version, revision)) {
      this.put({ version, change, revision })
    }

    const current = this.records.get(collection)?.get(id) ?? null
    const scoped = keys ? finds.filter(([key]) => keys.has(key)) : finds

    for (const [key, entry] of scoped) {
      const isMember = current !== null && matches(current, entry.where)
      const isChanged =
        entry.query.limit === undefined
          ? this.applyMembership({ entry, id, isMember })
          : this.applyWindow({ key, entry, id, isMember, prev: keys ? null : prev })

      if (isChanged) {
        change.queries.add(key)
      }
    }
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

    for (const version of unknown) {
      this.put({ version, change, revision: event.revision })
    }

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
    this.revisions.clear()
    this.complete.clear()
    this.finds.clear()
    this.counts.clear()
    this.views.clear()

    this.failures = new Map()
    this.inflight = new Map()
    this.batches = new Set()
    this.journal = []
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
    this.changes += 1
    this.listeners.forEach((listener) => listener(change))
  }

  /** Запись есть у клиента или известно, что её нет. */
  private isKnown(collection: string, id: IType) {
    return this.records.get(collection)?.has(id) ?? false
  }

  /** Клиент знает версию записи новее: от события или ответа более поздней ревизии. */
  private isOutdated({ collection, id }: RecordVersion, revision: number) {
    const known = this.revisions.get(collection)?.get(id)

    return known !== undefined && known > revision
  }

  /** Версия записи на место прежней с ревизией, которая её принесла; какие поля изменились — для подписок. */
  private put({ version, change, revision }: PutParams) {
    const { collection, id, record } = version
    const records = this.records.get(collection) ?? new Map<IType, object | null>()
    const revisions = this.revisions.get(collection) ?? new Map<IType, number>()
    const prev = records.get(id) ?? null

    records.set(id, freezeInDev(record))
    revisions.set(id, revision)
    this.records.set(collection, records)
    this.revisions.set(collection, revisions)
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

/**
 * Записи и значения представлений отдаются без копии, поэтому правка на месте молча испортила бы хранилище. В разработке
 * такая правка падает сразу; в сборке production сборщик приложения эту ветку вырезает.
 */
const freezeInDev = <T>(value: T) => {
  if (process.env.NODE_ENV !== 'production') {
    deepFreeze(value)
  }

  return value
}

const deepFreeze = (value: unknown) => {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return
  }

  Object.freeze(value)
  Object.values(value).forEach(deepFreeze)
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

/**
 * Ревизия, которой помечается положенное ответом. Ответ учёл всё до своей ревизии `R` включительно и, может быть, часть
 * следующей операции, поэтому он «после `R`»: событие `R`, пришедшее позже ответа, его не затирает, событие `R + 1` —
 * затирает.
 */
const answeredAt = (revision: number) => {
  return revision + 0.5
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
