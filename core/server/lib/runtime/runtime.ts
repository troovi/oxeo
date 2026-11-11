/**
 * Рантайм доменов — серверная сторона. Вызовы выполняются строго по одному: актор и момент — в контексте, событие
 * получает ревизию, новые версии записей, которые тронула операция, и уходит всем клиентам. Пакеты запросов клиентов идут
 * мимо очереди вызовов; представления считаются по запросу и кэшируются до события, которое тронет прочитанные ими
 * коллекции. Транспорт, авторизацию и часовой пояс задаёт приложение через опции; фреймворк (NestJS и т. п.) остаётся
 * снаружи.
 */
import { hash, QueueManager } from '@companix/utils-js'
import { DomainError, ParamsError } from '@oxeo/scheme'
import type {
  CollectionScheme,
  DataScheme,
  DomainCall,
  DomainContext,
  DomainEvent,
  DomainRoutes,
  DomainsMap,
  DomainsParams,
  FindOptions,
  IType,
  ParamsSchema,
  Queries,
  Query,
  QueryAnswer,
  QueryBatch,
  QueryError,
  QueryResult,
  RecordVersion,
  ViewContext,
  ViewsMap,
  ViewsParams
} from '@oxeo/scheme'
import type { CollectionWrite } from '../core/data-processor'
import { getGuaranteedValueByAddress } from '../utils'
import { CounterCollection, CounterKey, createIdSource } from './ids'

// types

/** Чтения коллекции, которые нужны рантайму: новые версии записей и пакеты запросов. */
interface ReadableCollection {
  get(id: IType): Promise<object | null>
  findBy(filter: object, opts?: FindOptions): Promise<object[]>
  count(filter: object): Promise<number>
}

/** Экземпляр представлений глазами рантайма: методы вызываются по именам из запроса. */
interface ViewInstance {
  [method: string]: (params: unknown, ctx: ViewContext) => Promise<unknown>
}

/** Посчитанное представление: значение и коллекции, которые оно читало. */
interface ViewValue {
  value: unknown
  reads: string[]
}

/** Методы коллекции, которые меняют данные: представлению они недоступны. */
const WRITES = new Set(['create', 'update', 'remove', 'changeDiscriminator'])

/** Экземпляр домена глазами рантайма: методы вызываются по именам из запроса. */
interface DomainInstance {
  [method: string]: (params: unknown, ctx: DomainContext) => Promise<unknown>
}

/**
 * Источник данных рантайма — `DataSource` oxeo: коллекции для доменов и чтений рантайма, схема — для имён, id и связей,
 * слушатель записей — чтобы знать, что тронула операция.
 */
export interface RuntimeSource<C> {
  collections: C
  scheme: DataScheme<CollectionScheme>
  subscribeWrites(listener: (write: CollectionWrite) => void): unknown
}

/** Вызов упал после первой записи: часть изменений уже в базе — клиенты пересинхронизируются. */
export interface PartialWrite {
  call: DomainCall
  /** Записи, которые вызов успел тронуть (без счётчиков идентификаторов). */
  writes: number
  error: unknown
}

/** Отказ запроса пакета: сам запрос и ошибка, которую он бросил. */
export interface QueryFailure {
  query: Query
  error: unknown
}

export interface RuntimeOptions<
  T extends DomainsMap,
  C,
  Identity,
  Actor,
  V extends ViewsMap = ViewsMap
> {
  /** Реестр доменов: рантайм исполняет их методы над коллекциями источника. */
  domains: T
  /** Схемы параметров операций (`createDomainsParams`): рантайм проверяет ими каждый вызов. */
  params: DomainsParams<T>
  /** Реестр представлений: чтения, которые сервер считает и отдаёт клиенту значением. */
  views?: V
  /** Схемы параметров представлений (`createViewsParams`): рантайм проверяет ими каждый запрос значения. */
  viewParams?: ViewsParams<V>
  dataSource: RuntimeSource<C>
  /** Коллекция счётчиков числовых идентификаторов; её записи клиентам не уходят и частичной записью не считаются. */
  counterCollection: CounterKey<C>
  /**
   * Актор по идентичности из запроса (например, из JWT). Вызывается внутри очереди — права читаются уже после
   * предыдущих вызовов; бросает, если доступа нет. Идентичность `null` — система, актор `null`.
   */
  resolveActor: (identity: Identity) => Actor | Promise<Actor>
  /** Дата `YYYY-MM-DD` момента `at` в часовом поясе приложения. */
  today: (at: number) => string
  /** Рассылка события всем клиентам (включая вызывающего — он отбросит дубль по ревизии). */
  broadcast: (event: DomainEvent) => void
  /** Частичная запись: залогировать и разослать клиентам команду пересинхронизации. */
  onPartialWrite: (info: PartialWrite) => void
  /**
   * Отказ одного запроса пакета: клиент получит его результатом `{ error }`, остальные запросы отвечены. Здесь —
   * залогировать непредвиденное (упавшее представление); по умолчанию — ничего.
   */
  onQueryError?: (info: QueryFailure) => void
  /** Документ базы → вид для клиента (например, без служебных `_id`/`__v`). По умолчанию — как есть. */
  serialize?: <D extends object>(document: D) => D
}

export interface RunOptions {
  /** Момент вызова, мс; по умолчанию — сейчас. */
  at?: number
}

/** Версии записей ответа на пакет: запись, найденная двумя запросами или захваченная дважды, — одна. */
type AnswerVersions = Map<string, RecordVersion>

interface AddRecordsParams {
  versions: AnswerVersions
  collection: string
  records: object[]
}

interface ResolveViewParams<Identity, Actor> {
  item: Queries.View
  identity: Identity | null
  ctx: ViewContext<Actor>
}

/** Реестр схем глазами рантайма: имя → метод → схема. */
type ParamsRegistry = Record<string, Record<string, ParamsSchema>>

interface ParseWithParams {
  registry: ParamsRegistry
  name: string
  method: string
  params: unknown
  /** Что ищем — для текста отказа. */
  kind: 'Operation' | 'View'
}

/**
 * Параметры, разобранные схемой из реестра. Реестр — список публичных методов: TS-`private` в рантайме не виден, поэтому
 * метод без схемы — неизвестный. Ключи только собственные: унаследованный `toString` схемой не станет.
 */
const parseWith = ({ registry, name, method, params, kind }: ParseWithParams) => {
  const isKnown = hasOwn.call(registry, name) && hasOwn.call(registry[name], method)

  if (!isKnown) {
    throw new DomainError('notFound', `${kind} ${name}.${method} not found`)
  }

  const parsed = registry[name][method].safeParse(params)

  if (!parsed.success) {
    throw new ParamsError(parsed.error.issues)
  }

  return parsed.data
}

/** Отказ запроса для клиента: код и текст `DomainError`, у непредвиденной ошибки — `internal` без подробностей. */
const queryError = (error: unknown): QueryError => {
  if (error instanceof DomainError) {
    return { code: error.code, message: error.message }
  }

  return { code: 'internal', message: 'Запрос не выполнен' }
}

/** Связи, по которым ответ захватывает записи вместе с отданной: на один уровень, `HasMany` — нет. */
const CAPTURED = new Set(['reference-to', 'reference-set', 'belongs-to'])

const hasOwn = Object.prototype.hasOwnProperty

export class DomainRuntime<
  T extends DomainsMap,
  C extends ConstructorParameters<T[keyof T]>[0],
  Identity,
  Actor,
  V extends ViewsMap = ViewsMap
> {
  /** Идентификатор запуска: после перезапуска клиенты начинают заново. */
  readonly epoch = hash()

  // calls

  private lastRevision = 0
  private queue = new QueueManager()
  private services: { [domain: string]: DomainInstance } = {}
  /** Записи, которые тронул текущий вызов: модель и id; записи счётчиков не собираются. */
  private touched = new Map<string, CollectionWrite>()
  private isRecording = false

  // views

  /** Кэш значений представлений: ключ — представление, метод, параметры и идентичность. */
  private viewCache = new Map<string, ViewValue>()
  /** День, на который посчитаны значения кэша: с новым днём кэш пуст. */
  private cacheDay: string | null = null
  /** Номер изменения данных: растёт с каждой операцией, которая писала, и с удачной, и с упавшей. */
  private stamp = 0
  /** Номер последнего изменения коллекции: значение, посчитанное под изменение, в кэш не кладётся. */
  private changedAt = new Map<string, number>()

  // source

  private scheme: RuntimeSource<C>['scheme']
  private collections: Record<string, ReadableCollection>
  /** Модель схемы (`Worker`) → ключ коллекции протокола (`worker`). */
  private collectionOf: { [model: string]: string } = {}

  // options

  private options: RuntimeOptions<T, C, Identity, Actor, V>

  constructor(options: RuntimeOptions<T, C, Identity, Actor, V>) {
    const { domains, dataSource, counterCollection } = options
    const { scheme, collections } = dataSource
    const counter = collections[counterCollection] as unknown as CounterCollection<any>
    const ids = createIdSource(counter)

    this.options = options
    this.scheme = scheme
    this.collections = collections as unknown as Record<string, ReadableCollection>

    for (const name in domains) {
      this.services[name] = new domains[name](collections, ids) as DomainInstance
    }

    for (const collection in scheme.collectionsScheme) {
      this.collectionOf[scheme.collectionsScheme[collection].name] = collection
    }

    const counterModel = scheme.collectionsScheme[counterCollection as string].name

    dataSource.subscribeWrites((write) => {
      if (this.isRecording && write.model !== counterModel) {
        this.touched.set(`${write.model}:${write.id}`, write)
      }
    })
  }

  /** Последняя выданная ревизия. */
  get revision() {
    return this.lastRevision
  }

  // calls

  /**
   * Выполнить вызов от имени идентичности или системы (`null`); ответ — событие, оно же уходит всем. Параметры проверяет
   * схема операции ещё до очереди: операции нет — `notFound`, не прошли — `ParamsError`; дальше идёт разобранное значение.
   * `opts.at` — момент вызова вместо текущего (посев истории): от него же считается `today`. Упал после первой записи —
   * `onPartialWrite`.
   */
  async run<D extends keyof T & string, M extends keyof DomainRoutes<T>[D] & string>(
    call: { domain: D; method: M; params: DomainRoutes<T>[D][M]['params'] },
    identity: Identity | null,
    opts: RunOptions = {}
  ) {
    const params = this.parseParams(call)

    return this.queue.add(async () => {
      const actor = identity === null ? null : await this.options.resolveActor(identity)
      const at = opts.at ?? Date.now()
      const ctx: DomainContext<Actor> = { actor, at, today: this.options.today(at) }

      this.touched.clear()
      this.isRecording = true

      try {
        const result = await this.services[call.domain][call.method](params, ctx)

        this.isRecording = false

        const event: DomainEvent<DomainRoutes<T>[D][M]['answer']> = {
          epoch: this.epoch,
          revision: ++this.lastRevision,
          domain: call.domain,
          method: call.method,
          params,
          ctx,
          result: result as DomainRoutes<T>[D][M]['answer'],
          changes: await this.changesOf()
        }

        this.forgetViews(event.changes.map((version) => version.collection))
        this.options.broadcast(event)
        return event
      } catch (error) {
        this.isRecording = false

        if (this.touched.size > 0) {
          this.forgetViews([...this.touched.values()].map((write) => this.collectionOf[write.model]))
          this.options.onPartialWrite({ call, writes: this.touched.size, error })
        }

        throw error
      }
    })
  }

  /**
   * Параметры вызова, разобранные схемой операции. Реестр схем — список публичных операций: TS-`private` в рантайме не
   * виден, поэтому вызов без схемы — неизвестная операция. Ключи только собственные: унаследованный `toString` схемой не
   * станет.
   */
  private parseParams({ domain, method, params }: DomainCall) {
    const registry = this.options.params as unknown as ParamsRegistry

    return parseWith({ registry, name: domain, method, params, kind: 'Operation' })
  }

  /** Новые версии тронутых записей: каждая читается из базы после операции, нет в базе — удалена. */
  private async changesOf() {
    const changes: RecordVersion[] = []

    for (const { model, id } of this.touched.values()) {
      const collection = this.collectionOf[model]
      const record = await this.collections[collection].get(id)

      changes.push({ collection, id, record: record && this.serialize(record) })
    }

    return changes
  }

  // queries

  /**
   * Пакет запросов клиента — мимо очереди вызовов, поэтому чтение может застать операцию на середине: итоговые версии
   * принесёт её событие. Сначала каждый запрос пакета, затем захват записей, на которые ведут ссылки отданных записей,
   * на один уровень. Отказ запроса — его результат `{ error }`: остальные запросы пакета отвечены. Ответ несёт эпоху и
   * ревизию, последнюю выданную до начала расчёта: всё, что было до неё, ответ учёл, — по ней клиент склеивает ответ с
   * событиями, пришедшими в другом порядке.
   */
  async query({ queries }: QueryBatch, identity: Identity | null = null): Promise<QueryAnswer> {
    const revision = this.lastRevision
    const versions: AnswerVersions = new Map()
    const results: QueryResult[] = []
    const viewer = { ctx: null as ViewContext<Actor> | null }

    for (const item of queries) {
      try {
        if (item.kind === 'view') {
          viewer.ctx ??= await this.viewContext(identity)
          results.push(await this.resolveView({ item, identity, ctx: viewer.ctx }))
          continue
        }

        results.push(await this.resolve(item, versions))
      } catch (error) {
        this.options.onQueryError?.({ query: item, error })
        results.push({ error: queryError(error) })
      }
    }

    await this.capture(versions)

    return { epoch: this.epoch, revision, records: [...versions.values()], results }
  }

  /** Один запрос пакета: записи — в ответ, результат — их id или число. */
  private async resolve(
    item: Exclude<Query, Queries.View>,
    versions: AnswerVersions
  ): Promise<QueryResult> {
    const collection = this.collections[item.collection]

    if (!this.scheme.collectionsScheme[item.collection] || !collection) {
      throw new DomainError('notFound', `Collection ${item.collection} not found`)
    }

    if (item.kind === 'count') {
      const count = await collection.count(item.where ?? {})

      return { count }
    }

    if (item.kind === 'get') {
      const found = await this.findByIds(item.collection, item.ids)

      return { ids: this.addRecords({ versions, collection: item.collection, records: found }) }
    }

    const opts = { order: item.order, limit: item.limit }
    const found = await collection.findBy(item.where ?? {}, opts)

    return { ids: this.addRecords({ versions, collection: item.collection, records: found }) }
  }

  // views

  /** Контекст представлений пакета: актор по идентичности (`null` — без неё) и сегодняшний день. */
  private async viewContext(identity: Identity | null): Promise<ViewContext<Actor>> {
    const actor = identity === null ? null : await this.options.resolveActor(identity)

    return { actor, today: this.options.today(Date.now()) }
  }

  /**
   * Значение представления: из кэша или расчётом. Кэш — на день: ключ — представление, метод, параметры и идентичность.
   * Расчёт идёт над коллекциями, которые записывают прочитанное и не дают писать. Значение, посчитанное, пока операция
   * меняла прочитанные коллекции, отдаётся, но в кэш не кладётся.
   */
  private async resolveView({ item, identity, ctx }: ResolveViewParams<Identity, Actor>) {
    const registry = (this.options.viewParams ?? {}) as unknown as ParamsRegistry
    const params = parseWith({
      registry,
      name: item.view,
      method: item.method,
      params: item.params,
      kind: 'View'
    })
    const key = JSON.stringify([item.view, item.method, params, identity])

    if (this.cacheDay !== ctx.today) {
      this.viewCache.clear()
      this.cacheDay = ctx.today
    }

    const cached = this.viewCache.get(key)

    if (cached) {
      return cached
    }

    const startedAt = this.stamp
    const reads = new Set<string>()
    const ViewClass = (this.options.views as unknown as ViewsMap)[item.view]
    const instance = new ViewClass(this.readOnlyCollections(reads)) as ViewInstance
    const value = await instance[item.method](params, ctx)
    const result = { value: structuredClone(value), reads: [...reads] }
    const isStale = result.reads.some((collection) => (this.changedAt.get(collection) ?? 0) > startedAt)

    if (!isStale) {
      this.viewCache.set(key, result)
    }

    return result
  }

  /** Коллекции для расчёта представления: каждое обращение записывает коллекцию в `reads`, запись — отказ. */
  private readOnlyCollections(reads: Set<string>) {
    const collections = this.collections

    return new Proxy(collections, {
      get: (target, name) => {
        const collection = target[name as string]

        if (typeof name !== 'string' || !collection) {
          return collection
        }

        return new Proxy(collection, {
          get: (inner, method) => {
            const member = inner[method as keyof ReadableCollection]

            if (typeof member !== 'function') {
              return member
            }

            if (WRITES.has(method as string)) {
              throw new DomainError('forbidden', `View cannot write ${name}.${String(method)}`)
            }

            reads.add(name)
            return (member as (...args: unknown[]) => unknown).bind(inner)
          }
        })
      }
    })
  }

  /** Операция, которая писала, сбрасывает значения представлений, читавших тронутые ею коллекции. */
  private forgetViews(collections: string[]) {
    const touched = new Set(collections)

    this.stamp += 1
    touched.forEach((collection) => this.changedAt.set(collection, this.stamp))

    for (const [key, cached] of this.viewCache) {
      if (cached.reads.some((collection) => touched.has(collection))) {
        this.viewCache.delete(key)
      }
    }
  }

  /**
   * Захват по ссылкам: у каждой записи ответа — поля `ReferenceTo`, `ReferenceSet`, `BelongsTo` по карте связей схемы
   * (общей и её формы); цели, которых в ответе нет, читаются одним запросом на коллекцию. Захваченные записи сами дальше
   * не захватывают.
   */
  private async capture(versions: AnswerVersions) {
    const wanted = new Map<string, Set<IType>>()

    for (const { collection, record } of versions.values()) {
      const { name } = this.scheme.collectionsScheme[collection]
      const refs = this.scheme.referencesOf(name, record as object)

      for (const address in refs) {
        const ref = refs[address]
        const target = this.collectionOf[ref.model]

        if (!CAPTURED.has(ref.refType) || !target) {
          continue
        }

        const value = getGuaranteedValueByAddress(record as object, address) as IType | IType[] | null
        const ids = Array.isArray(value) ? value : [value]

        for (const id of ids) {
          if (id !== null && !versions.has(`${target}:${id}`)) {
            wanted.set(target, (wanted.get(target) ?? new Set<IType>()).add(id))
          }
        }
      }
    }

    for (const [collection, ids] of wanted) {
      const found = await this.findByIds(collection, [...ids])

      this.addRecords({ versions, collection, records: found })
    }
  }

  private findByIds(collection: string, ids: IType[]) {
    const idKey = this.scheme.collectionsScheme[collection].identifierKey as string

    return this.collections[collection].findBy({ [idKey]: { in: ids } })
  }

  /** Записи — в версии ответа; результат — их id. */
  private addRecords({ versions, collection, records }: AddRecordsParams) {
    const idKey = this.scheme.collectionsScheme[collection].identifierKey as string

    return records.map((record) => {
      const id = record[idKey as keyof object] as IType

      versions.set(`${collection}:${id}`, { collection, id, record: this.serialize(record) })
      return id
    })
  }

  /**
   * Документ для клиента — копией: in-memory драйвер отдаёт живые объекты, и следующая операция в очереди поменяла бы
   * событие или ответ раньше, чем они ушли по сети.
   */
  private serialize<D extends object>(document: D) {
    const { serialize } = this.options

    return structuredClone(serialize ? serialize(document) : document)
  }
}
