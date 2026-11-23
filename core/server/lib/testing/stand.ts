/**
 * Стенд доменов для тестов проекта: рантайм над базой в памяти (`@oxeo-drivers/memory`). `run` выполняет операцию так
 * же, как сервер: параметры проверяет схема `@Params`, доступ — декораторы `@Allow` и `@System`, контекст (актор, момент,
 * дата) создаёт рантайм, событие уходит в `events`. Чтения доменов отдают копии, как Mongo: домен, который полагается на
 * прочитанный объект после `update`, на стенде упадёт так же, как на сервере. Часы стенда свои: каждый `run` сдвигает
 * их на минуту.
 */
import { createMemoryDriver } from '@oxeo-drivers/memory'
import type {
  CollectionScheme,
  CollectionsOf,
  DataScheme,
  DomainEvent,
  DomainRoutes,
  DomainsMap,
  ExtractType,
  RegisteredActor,
  ViewsMap,
  Where
} from '@oxeo/scheme'
import { DataSource } from '../core'
import type { Token } from '../runtime/container'
import type { CounterKey } from '../runtime/ids'
import { DomainRuntime, PartialWrite, RuntimeAccess } from '../runtime/runtime'

/** Шаг часов стенда: каждый вызов — на минуту позже предыдущего. */
const STEP = 60_000

/** Чтения коллекции, которые стенд копирует. */
const READS = new Set(['get', 'getAll', 'findBy', 'findOneBy'])

type AnyMethod = (...args: unknown[]) => unknown

const clone = <T>(value: T): T => {
  return value === undefined ? value : JSON.parse(JSON.stringify(value))
}

/** Коллекции, чьи чтения отдают копии, как Mongo (`lean()`): драйвер памяти отдаёт живые объекты. */
export const cloningCollections = <C extends object>(collections: C) => {
  return new Proxy(collections, {
    get(target, name) {
      const collection = target[name as keyof C] as Record<string, unknown>

      return new Proxy(collection, {
        get(inner, method) {
          const member = inner[method as string]

          if (typeof member !== 'function') {
            return member
          }

          const call = member as AnyMethod

          if (READS.has(method as string)) {
            return async (...args: unknown[]) => {
              const value = await call.apply(inner, args)

              return clone(value)
            }
          }

          return call.bind(inner)
        }
      })
    }
  })
}

/** Вызов, который стенд повторяет после отказа: что вызывали и от чьего имени. */
export interface StandRetryCall {
  domain: string
  method: string
  params: object
  actor: RegisteredActor | null
}

export interface StandOptions<S extends CollectionScheme, T extends DomainsMap, V extends ViewsMap> {
  scheme: DataScheme<S>
  domains: T
  views?: V
  /** Коллекция счётчиков числовых идентификаторов; по умолчанию — `counter`. */
  counterCollection?: CounterKey<CollectionsOf<S>>
  /** Момент часов стенда, мс: первый вызов — на минуту позже; по умолчанию — сейчас. */
  clock?: number
  /** Дата `YYYY-MM-DD` момента в часовом поясе приложения — как у рантайма сервера. */
  today: (at: number) => string
  /** Посев мира проекта до первого вызова — прямо в коллекции базы. */
  seed?: (collections: CollectionsOf<S>) => Promise<void> | void
  /**
   * Повтор вызова после отказа: новые параметры — вызов повторяется с ними, `null` — отказ уходит тесту. Не зовётся,
   * если вызов успел записать, и у вызова с `retry: false`.
   */
  retry?: (error: unknown, call: StandRetryCall) => object | null | Promise<object | null>
  /** Доступ к операциям — как у рантайма сервера; без него `@Allow` доступен только системе. */
  access?: RuntimeAccess<RegisteredActor>
}

/** Вызов стенда: операция домена от имени актора. */
// prettier-ignore
export interface StandCall<T extends DomainsMap, D extends keyof T & string, M extends keyof DomainRoutes<T>[D] & string> {
  domain: D
  method: M
  params: DomainRoutes<T>[D][M]['params']
  /** По умолчанию `null` — система. */
  actor?: RegisteredActor | null
  /** Повторять ли вызов крючком `retry` стенда; по умолчанию — да. */
  retry?: boolean
}

type RecordOf<S extends CollectionScheme, K extends keyof S> = ExtractType<S[K]['model']>

/**
 * Стенд над схемой, реестрами и часами проекта. Базу засевает `seed`, рантайм собирает домены контейнером и пробно
 * собирает каждое представление, как на сервере.
 */
export const createStand = async <
  S extends CollectionScheme,
  T extends DomainsMap,
  V extends ViewsMap = {}
>(
  opts: StandOptions<S, T, V>
) => {
  const { scheme, domains, views, today, retry, access } = opts
  const source = new DataSource(scheme, { createDriver: createMemoryDriver })
  const events: DomainEvent[] = []
  const partialWrites: PartialWrite[] = []
  const clock = { now: opts.clock ?? Date.now() }

  await opts.seed?.(source.collections)

  const runtime = new DomainRuntime({
    domains,
    views,
    dataSource: {
      collections: cloningCollections(source.collections),
      scheme: source.scheme,
      subscribeWrites: (listener) => source.subscribeWrites(listener)
    },
    counterCollection: opts.counterCollection ?? ('counter' as CounterKey<CollectionsOf<S>>),
    // идентичность стенда — сам актор: его роли задаёт тест
    resolveActor: (actor: RegisteredActor) => actor,
    access,
    today,
    broadcast: (event) => {
      events.push(event)
    },
    onPartialWrite: (info) => {
      partialWrites.push(info)
    }
  })

  const runWith = (call: StandRetryCall) => {
    const { domain, method, params, actor } = call

    // имена домена и метода проверяет тип вызова стенда; рантайм ждёт их в своём виде
    return runtime.run({ domain, method, params } as never, actor, { at: clock.now })
  }

  return {
    /** Коллекции базы стенда — для посева и проверок теста; их чтения не копируются. */
    collections: source.collections,
    /** Рантайм стенда — для пакетов запросов и представлений (`runtime.query`). */
    runtime,
    /** Экземпляр из области рантайма — сервис тот же, что получают домены; его чтения, как у доменов, — копии. */
    get: <I>(Class: Token<I>) => {
      return runtime.get(Class)
    },
    /** События выполненных операций по порядку. */
    events,
    /** Операции, упавшие после первой записи. */
    partialWrites,
    /** Запись, которая обязана быть: нет — тест падает с именем коллекции. */
    record: async <K extends keyof S & string>(collection: K, id: S[K]['identifierType']) => {
      const record = await source.collections[collection].get(id)

      if (!record) {
        throw new Error(`stand: ${collection} ${id} не найдена`)
      }

      return record as RecordOf<S, K>
    },
    /** Единственная запись по фильтру, которая обязана быть. */
    recordBy: async <K extends keyof S & string>(collection: K, where: Where<RecordOf<S, K>>) => {
      const record = await source.collections[collection].findOneBy(where as never)

      if (!record) {
        throw new Error(`stand: ${collection} по ${JSON.stringify(where)} не найдена`)
      }

      return record as RecordOf<S, K>
    },
    /**
     * Операция от имени актора — ответ метода. Часы сдвигаются на минуту. Отказ без записи стенд отдаёт крючку
     * `retry`: новые параметры — повтор, `null` — отказ уходит тесту.
     */
    run: async <D extends keyof T & string, M extends keyof DomainRoutes<T>[D] & string>(
      call: StandCall<T, D, M>
    ) => {
      const first: StandRetryCall = {
        domain: call.domain,
        method: call.method,
        params: call.params as object,
        actor: call.actor ?? null
      }

      clock.now += STEP

      const writes = partialWrites.length
      const outcome = await runWith(first).catch((error: unknown) => ({ error }))

      if (!('error' in outcome)) {
        return outcome.result as DomainRoutes<T>[D][M]['answer']
      }

      const isRetried = retry && call.retry !== false && partialWrites.length === writes
      const params = isRetried ? await retry(outcome.error, first) : null

      if (params === null) {
        throw outcome.error
      }

      const event = await runWith({ ...first, params })

      return event.result as DomainRoutes<T>[D][M]['answer']
    },
    /** Момент следующего вызова, мс — для проверок штампов. */
    get now() {
      return clock.now + STEP
    },
    /** Дата следующего вызова. */
    get today() {
      return today(clock.now + STEP)
    },
    /** Сдвинуть часы стенда вперёд. */
    advance: (ms: number) => {
      clock.now += ms
    }
  }
}
