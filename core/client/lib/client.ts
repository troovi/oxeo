/**
 * Клиент — то, чем пользуется приложение: объект данных `data` и вызовы операций `DomainsAPI` над живой частью базы
 * `LiveStore`. Домены клиент не исполняет, схема и домены нужны ему только типами: в рантайме от `@oxeo/scheme` он берёт
 * лишь вход `filter`, а имена коллекций и операций получает прокси в момент обращения. Привязка к React — `@oxeo/react`.
 */
import type {
  CollectionScheme,
  DomainEvent,
  DomainRoutes,
  DomainsMap,
  ExtractType,
  IType,
  Query,
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

/**
 * Клиент. Типы схемы и доменов — параметрами (`createClient<AppScheme, AppDomains>(…)`): в рантайме ни схемы, ни доменов
 * клиенту не нужно. Поток событий открывает приложение и передаёт сообщения в `push` и `resync`.
 */
export const createClient = <Scheme extends CollectionScheme, Domains extends DomainsMap>(
  options: ClientOptions
) => {
  const store = new LiveStore(options)
  const readers = new Map<string, CollectionReader<object, IType>>()

  const data = new Proxy({} as DataApi<Scheme>, {
    get: (_, collection) => {
      if (!isMethodKey(collection)) {
        return undefined
      }

      if (!readers.has(collection)) {
        readers.set(collection, {
          get: (id) => {
            return store.read({ kind: 'get', collection, ids: [id] }) as object | null
          },
          find: (where) => {
            return store.read({ kind: 'find', collection, where }) as object[]
          },
          all: () => {
            return store.read({ kind: 'find', collection, where: null }) as object[]
          },
          count: (where) => {
            return store.read({ kind: 'count', collection, where: where ?? null }) as number
          },
          load: (where) => {
            return store.load({ kind: 'find', collection, where: where ?? null })
          }
        })
      }

      return readers.get(collection)!
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
    data,
    DomainsAPI,
    /** Событие журнала из потока. */
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
