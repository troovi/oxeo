/**
 * Рантайм доменов — серверная сторона. Вызовы выполняются строго по одному: актор и момент — в контексте, событие
 * получает ревизию, новые версии записей, которые тронула операция, и уходит всем клиентам. Пакеты запросов клиентов идут
 * мимо очереди вызовов. Транспорт, авторизацию и часовой пояс задаёт приложение через опции; фреймворк (NestJS и т. п.)
 * остаётся снаружи.
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
  IType,
  ParamsSchema,
  Query,
  QueryBatch,
  QueryResult,
  RecordVersion
} from '@oxeo/scheme'
import type { CollectionWrite } from '../core/data-processor'
import { getGuaranteedValueByAddress } from '../utils'
import { CounterCollection, CounterKey, createIdSource } from './ids'

// types

/** Чтения коллекции, которые нужны рантайму: новые версии записей и пакеты запросов. */
interface ReadableCollection {
  get(id: IType): Promise<object | null>
  findBy(filter: object): Promise<object[]>
  count(filter: object): Promise<number>
}

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

export interface RuntimeOptions<T extends DomainsMap, C, Identity, Actor> {
  /** Реестр доменов: рантайм исполняет их методы над коллекциями источника. */
  domains: T
  /** Схемы параметров операций (`createDomainsParams`): рантайм проверяет ими каждый вызов. */
  params: DomainsParams<T>
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

/** Связи, по которым ответ захватывает записи вместе с отданной: на один уровень, `HasMany` — нет. */
const CAPTURED = new Set(['reference-to', 'reference-set', 'belongs-to'])

const hasOwn = Object.prototype.hasOwnProperty

export class DomainRuntime<
  T extends DomainsMap,
  C extends ConstructorParameters<T[keyof T]>[0],
  Identity,
  Actor
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

  // source

  private scheme: RuntimeSource<C>['scheme']
  private collections: Record<string, ReadableCollection>
  /** Модель схемы (`Worker`) → ключ коллекции протокола (`worker`). */
  private collectionOf: { [model: string]: string } = {}

  // options

  private options: RuntimeOptions<T, C, Identity, Actor>

  constructor(options: RuntimeOptions<T, C, Identity, Actor>) {
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

        this.options.broadcast(event)
        return event
      } catch (error) {
        this.isRecording = false

        if (this.touched.size > 0) {
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
    const registry = this.options.params as Record<string, Record<string, ParamsSchema>>
    const isKnown = hasOwn.call(registry, domain) && hasOwn.call(registry[domain], method)

    if (!isKnown) {
      throw new DomainError('notFound', `Operation ${domain}.${method} not found`)
    }

    const parsed = registry[domain][method].safeParse(params)

    if (!parsed.success) {
      throw new ParamsError(parsed.error.issues)
    }

    return parsed.data
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
   * на один уровень.
   */
  async query({ queries }: QueryBatch) {
    const versions: AnswerVersions = new Map()
    const results: QueryResult[] = []

    for (const item of queries) {
      results.push(await this.resolve(item, versions))
    }

    await this.capture(versions)

    return { records: [...versions.values()], results }
  }

  /** Один запрос пакета: записи — в ответ, результат — их id или число. */
  private async resolve(item: Query, versions: AnswerVersions): Promise<QueryResult> {
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

    const found = await collection.findBy(item.where ?? {})

    return { ids: this.addRecords({ versions, collection: item.collection, records: found }) }
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
