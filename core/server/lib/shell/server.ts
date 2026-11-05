/**
 * Серверная сторона — журнал событий. Вызовы выполняются строго по одному: актор, момент и идентификаторы — в контексте,
 * событие получает ревизию, новые версии записей, которые тронула операция, и уходит всем клиентам. Пакеты запросов
 * клиентов идут мимо очереди вызовов. Транспорт, авторизацию и часовой пояс задаёт приложение через опции; фреймворк
 * (NestJS и т. п.) остаётся снаружи.
 */
import { hash, QueueManager } from '@companix/utils-js'
import { DomainError } from '@oxeo/scheme'
import type {
  CollectionScheme,
  DataScheme,
  DomainCall,
  DomainEvent,
  DomainRoutes,
  DomainsMap,
  EventContext,
  IType,
  Query,
  QueryBatch,
  QueryResult,
  RecordVersion
} from '@oxeo/scheme'
import type { CollectionWrite } from '../core/data-processor'
import { getGuaranteedValueByAddress } from '../utils'
import { initializeDomains, methodOf } from './helpers'
import { CounterCollection, CounterKey, createIdSource } from './ids'

/** Чтения коллекции, которые нужны журналу для пакета запросов: синхронные или асинхронные. */
interface ReadableCollection {
  getAll(): object[] | Promise<object[]>
  findBy(filter: object): object[] | Promise<object[]>
  count(filter?: object): number | Promise<number>
}

/**
 * Источник данных журнала — `DataSource` oxeo: коллекции для доменов и пакетов запросов, схема — для имён, id и связей,
 * драйвер — чтобы прочитать новую версию тронутой записи и захватить записи по ссылкам, слушатель записей — чтобы
 * знать, что тронула операция.
 */
export interface ServerShellSource<C> {
  collections: C
  scheme: DataScheme<CollectionScheme>
  driver: {
    get(params: { model: string; id: IType }): object | null | Promise<object | null>
    findBy(params: { model: string; filter: object }): object[] | Promise<object[]>
  }
  subscribeWrites(listener: (write: CollectionWrite) => void): unknown
}

/** Вызов упал после первой записи: часть изменений уже в базе — клиенты пересинхронизируются. */
export interface PartialWrite {
  call: DomainCall
  /** Записи, которые вызов успел тронуть (без счётчиков идентификаторов). */
  writes: number
  error: unknown
}

export interface ServerShellOptions<C, Identity, Actor> {
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

/** Связи, по которым ответ захватывает записи вместе с отданной: на один уровень, `HasMany` — нет. */
const CAPTURED = new Set(['reference-to', 'reference-set', 'belongs-to'])

export const createServerShell = <
  T extends DomainsMap,
  C extends ConstructorParameters<T[keyof T]>[0],
  Identity,
  Actor
>(
  domains: T,
  dataSource: ServerShellSource<C>,
  options: ServerShellOptions<C, Identity, Actor>
) => {
  /** Идентификатор запуска: после перезапуска клиенты начинают заново. */
  const epoch = hash()
  const queue = new QueueManager()
  const serializer = options.serialize ?? (<D extends object>(document: D) => document)

  /**
   * Документ для клиента — копией: in-memory драйвер отдаёт живые объекты, и следующая операция в очереди поменяла бы
   * событие или ответ раньше, чем они ушли по сети.
   */
  const serialize = <D extends object>(document: D) => structuredClone(serializer(document))

  const { scheme } = dataSource
  const collections = dataSource.collections as unknown as Record<string, ReadableCollection>
  const counter = dataSource.collections[options.counterCollection] as unknown as CounterCollection<any>
  const counterModel = scheme.collectionsScheme[options.counterCollection as string].name
  const services = initializeDomains(domains, dataSource.collections)

  // имена: модель схемы (`Worker`) ↔ ключ коллекции протокола (`worker`)
  const collectionOf: { [model: string]: string } = {}

  for (const collection in scheme.collectionsScheme) {
    collectionOf[scheme.collectionsScheme[collection].name] = collection
  }

  /** Записи, которые тронул текущий вызов: модель и id; записи счётчиков не собираются. */
  const touched = new Map<string, CollectionWrite>()
  const recording = { isActive: false }

  dataSource.subscribeWrites((write) => {
    if (recording.isActive && write.model !== counterModel) {
      touched.set(`${write.model}:${write.id}`, write)
    }
  })

  let revision = 0

  /** Новые версии тронутых записей: каждая читается из базы после операции, нет в базе — удалена. */
  const changesOf = async () => {
    const changes: RecordVersion[] = []

    for (const { model, id } of touched.values()) {
      const record = await dataSource.driver.get({ model, id })

      changes.push({ collection: collectionOf[model], id, record: record && serialize(record) })
    }

    return changes
  }

  /**
   * Выполнить вызов от имени идентичности или системы (`null`); ответ — событие журнала, оно же уходит всем. `opts.at` —
   * момент вызова вместо текущего (посев истории): от него же считается `today`. Упал после первой записи —
   * `onPartialWrite`.
   */
  const run = <D extends keyof T & string, M extends keyof DomainRoutes<T>[D] & string>(
    call: { domain: D; method: M; params: DomainRoutes<T>[D][M]['params'] },
    identity: Identity | null,
    opts: RunOptions = {}
  ) => {
    return queue.add(async () => {
      const actor = identity === null ? null : await options.resolveActor(identity)
      const at = opts.at ?? Date.now()
      const ctx: EventContext<Actor> = { actor, at, today: options.today(at) }

      touched.clear()
      recording.isActive = true

      try {
        const result = await methodOf(services, call)(call.params, {
          ...ctx,
          ids: createIdSource(counter)
        })

        recording.isActive = false

        const event: DomainEvent<DomainRoutes<T>[D][M]['answer']> = {
          epoch,
          revision: ++revision,
          domain: call.domain,
          method: call.method,
          params: call.params,
          ctx,
          result: result as DomainRoutes<T>[D][M]['answer'],
          changes: await changesOf()
        }

        options.broadcast(event)
        return event
      } catch (error) {
        recording.isActive = false

        if (touched.size > 0) {
          options.onPartialWrite({ call, writes: touched.size, error })
        }

        throw error
      }
    })
  }

  /** Ответ пакета: версии записей без повторов — запись, найденная двумя запросами или захваченная дважды, одна. */
  const createAnswer = () => {
    const versions = new Map<string, RecordVersion>()

    const add = (collection: string, records: object[]) => {
      const idKey = scheme.collectionsScheme[collection].identifierKey as string

      return records.map((record) => {
        const id = record[idKey as keyof object] as IType

        versions.set(`${collection}:${id}`, { collection, id, record: serialize(record) })
        return id
      })
    }

    return { versions, add }
  }

  type Answer = ReturnType<typeof createAnswer>

  /**
   * Пакет запросов клиента — мимо очереди вызовов, поэтому чтение может застать операцию на середине: итоговые версии
   * принесёт её событие. Сначала каждый запрос пакета, затем захват записей, на которые ведут ссылки отданных записей,
   * на один уровень.
   */
  const query = async ({ queries }: QueryBatch) => {
    const answer = createAnswer()
    const results: QueryResult[] = []

    for (const item of queries) {
      results.push(await resolve(item, answer))
    }

    await capture(answer)

    return { records: [...answer.versions.values()], results }
  }

  /** Один запрос пакета: записи — в ответ, результат — их id или число. */
  const resolve = async (item: Query, answer: Answer): Promise<QueryResult> => {
    const collection = collections[item.collection]

    if (!scheme.collectionsScheme[item.collection] || !collection) {
      throw new DomainError('notFound', `Collection ${item.collection} not found`)
    }

    if (item.kind === 'count') {
      const count = await collection.count(item.where ?? {})

      return { count }
    }

    if (item.kind === 'get') {
      const idKey = scheme.collectionsScheme[item.collection].identifierKey as string
      const found = await collection.findBy({ [idKey]: { in: item.ids } })

      return { ids: answer.add(item.collection, found) }
    }

    const found = item.where === null ? await collection.getAll() : await collection.findBy(item.where)

    return { ids: answer.add(item.collection, found) }
  }

  /**
   * Захват по ссылкам: у каждой записи ответа — поля `ReferenceTo`, `ReferenceSet`, `BelongsTo` по карте связей схемы
   * (общей и её формы); цели, которых в ответе нет, читаются одним `findBy` с `in` на модель. Захваченные записи сами
   * дальше не захватывают.
   */
  const capture = async (answer: Answer) => {
    const wanted = new Map<string, Set<IType>>()

    for (const { collection, record } of answer.versions.values()) {
      const refs = scheme.referencesOf(scheme.collectionsScheme[collection].name, record as object)

      for (const address in refs) {
        const ref = refs[address]
        const target = collectionOf[ref.model]

        if (!CAPTURED.has(ref.refType) || !target) {
          continue
        }

        const value = getGuaranteedValueByAddress(record as object, address) as IType | IType[] | null
        const ids = Array.isArray(value) ? value : [value]

        for (const id of ids) {
          if (id !== null && !answer.versions.has(`${target}:${id}`)) {
            wanted.set(ref.model, (wanted.get(ref.model) ?? new Set<IType>()).add(id))
          }
        }
      }
    }

    for (const [model, ids] of wanted) {
      const idKey = scheme.models[model].scheme.identifier.propertyKey
      const found = await dataSource.driver.findBy({ model, filter: { [idKey]: { in: [...ids] } } })

      answer.add(collectionOf[model], found)
    }
  }

  return {
    epoch,
    /** Последняя выданная ревизия. */
    get revision() {
      return revision
    },
    run,
    query
  }
}

/** Оболочка, собранная `createServerShell`, — тип для поля класса (например, сервиса NestJS). */
export type ServerShell<
  T extends DomainsMap,
  C extends ConstructorParameters<T[keyof T]>[0],
  Identity,
  Actor
> = ReturnType<typeof createServerShell<T, C, Identity, Actor>>
