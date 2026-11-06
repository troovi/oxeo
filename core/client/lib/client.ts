/**
 * Клиент — то, чем пользуется приложение: объект данных `db`, значения представлений `views` и вызовы операций
 * `DomainsAPI` над живой частью базы `LiveStore`. Домены и представления клиент не исполняет, схема, домены и
 * представления нужны ему только типами: в рантайме от `@oxeo/scheme` он берёт лишь вход `filter`, а имена коллекций,
 * представлений и операций получает прокси в момент обращения. Привязка к React — `@oxeo/react`.
 */
import type {
  CollectionScheme,
  DomainEvent,
  DomainRoutes,
  DomainsMap,
  ExtractType,
  FindOptions,
  IType,
  Query,
  ViewRoutes,
  ViewsMap,
  Where
} from '@oxeo/scheme'
import { ClientOptions, LiveStore } from './live-store'
import { ClientChange } from './tracker'

// types

/**
 * Чтения коллекции. В проходе рендера (привязка поставила сборщик) чтение подписывает и, если данных нет, записывает
 * потребность и отдаёт пустое того же вида (`null`, `[]`, `0`). Вне рендера отдаёт только покрытое, непокрытое —
 * `UncoveredReadError`.
 */
export interface CollectionReader<T, I extends IType> {
  /** Запись по id; `null` — записи нет. */
  get(id: I): T | null
  /**
   * Записи по фильтру. С опциями — окно: первые `limit` записей в порядке `order` (при равенстве — по id, предел без
   * порядка — по id); поле порядка — число или строка верхнего уровня.
   */
  find(where: Where<T>, opts?: FindOptions<T>): T[]
  /** Коллекция целиком. */
  all(): T[]
  /** Число записей по фильтру, без фильтра — всех; перезапрашивается при изменениях коллекции. */
  count(where?: Where<T>): number
  /** Явная загрузка для обработчика: непокрытое — с сервера, покрытое — сразу; без фильтра — коллекция целиком. */
  load(where?: Where<T>, opts?: FindOptions<T>): Promise<T[]>
}

/** Объект данных: `db.<collection>`, типы — из схемы. */
export type DbApi<Scheme extends CollectionScheme> = {
  [K in keyof Scheme]: CollectionReader<ExtractType<Scheme[K]['model']>, Scheme[K]['identifierType']>
}

/**
 * Значения представлений: `views.<view>.<method>(params)`, типы — из сигнатур методов класса. Чтение как у `db`: в
 * проходе рендера подписывает и, если значения нет, записывает потребность (пустое — `null`, проход отбросится), вне
 * рендера отдаёт только покрытое. Значение перезапрашивается, когда событие тронет коллекции, которые представление
 * читало.
 */
export type ViewsApi<T extends ViewsMap> = {
  [V in keyof T]: {
    [M in keyof ViewRoutes<T>[V]]: (
      params: ViewRoutes<T>[V][M]['params']
    ) => ViewRoutes<T>[V][M]['answer']
  }
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

/**
 * Клиент. Типы схемы, доменов и представлений — параметрами (`createClient<AppScheme, AppDomains, AppViews>(…)`): в
 * рантайме ни схемы, ни доменов, ни представлений клиенту не нужно. Поток событий открывает приложение и передаёт
 * сообщения в `push` и `resync`.
 */
export const createClient = <
  Scheme extends CollectionScheme,
  Domains extends DomainsMap,
  Views extends ViewsMap = {}
>(
  options: ClientOptions
) => {
  const store = new LiveStore(options)
  const readers = new Map<string, CollectionReader<object, IType>>()

  const db = new Proxy({} as DbApi<Scheme>, {
    get: (_, collection) => {
      if (!isMethodKey(collection)) {
        return undefined
      }

      if (!readers.has(collection)) {
        readers.set(collection, {
          get: (id) => {
            return store.read({ kind: 'get', collection, ids: [id] }) as object | null
          },
          find: (where, opts = {}) => {
            return store.read({ kind: 'find', collection, where, ...opts }) as object[]
          },
          all: () => {
            return store.read({ kind: 'find', collection, where: null }) as object[]
          },
          count: (where) => {
            return store.read({ kind: 'count', collection, where: where ?? null }) as number
          },
          load: (where, opts = {}) => {
            return store.load({ kind: 'find', collection, where: where ?? null, ...opts })
          }
        })
      }

      return readers.get(collection)!
    }
  })

  const views = new Proxy({} as ViewsApi<Views>, {
    get: (_, view) => {
      if (!isMethodKey(view)) {
        return undefined
      }

      return new Proxy({} as Record<string, unknown>, {
        get: (__, method) => {
          if (!isMethodKey(method)) {
            return undefined
          }

          return (params: unknown) => store.read({ kind: 'view', view, method, params })
        }
      })
    }
  })

  const DomainsAPI = new Proxy({} as DomainsApi<Domains>, {
    get: (_, domain) => {
      if (!isMethodKey(domain)) {
        return undefined
      }

      return new Proxy({} as Record<string, unknown>, {
        get: (__, method) => {
          if (!isMethodKey(method)) {
            return undefined
          }

          return (params: unknown) => store.call({ domain, method, params })
        }
      })
    }
  })

  return {
    db,
    views,
    DomainsAPI,
    /** Событие из потока. */
    push: (event: DomainEvent) => {
      store.push(event)
    },
    /** Команда сервера или обрыв потока: забыть всё и начать заново. */
    resync: (reason: string) => {
      store.resync(reason)
    },
    /** Для привязки: загрузка потребностей прохода, отказы, подписка на изменения. */
    request: (queries: Query[]) => {
      return store.request(queries)
    },
    forgetFailures: (keys: string[]) => {
      store.forgetFailures(keys)
    },
    subscribe: (listener: (change: ClientChange) => void) => {
      return store.subscribe(listener)
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
