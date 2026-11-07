/**
 * Клиент — то, чем пользуется приложение: разовое чтение `read` и вызовы операций `DomainsAPI` над живой частью базы
 * `LiveStore`. `db` и значения представлений наружу не выходят: они живут только параметрами колбэка чтения. Домены и
 * представления клиент не исполняет, схема, домены и представления нужны ему только типами: в рантайме от `@oxeo/scheme`
 * он берёт лишь вход `filter`, а имена коллекций, представлений и операций получает прокси в момент обращения. Привязка к
 * React — `@oxeo/react`.
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
import { ClientChange, Read, Tracker, TrackerOptions } from './tracker'

// types

/**
 * Чтения коллекции — параметр колбэка чтения. Чтение подписывает и, если данных нет, записывает потребность и отдаёт
 * пустое того же вида (`null`, `[]`, `0`): колбэк идёт дальше, все независимые чтения уходят одним пакетом, а неполный
 * результат наружу не выходит.
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
}

/** Объект данных: `db.<collection>`, типы — из схемы. */
export type DbApi<Scheme extends CollectionScheme> = {
  [K in keyof Scheme]: CollectionReader<ExtractType<Scheme[K]['model']>, Scheme[K]['identifierType']>
}

/**
 * Значения представлений: `views.<view>.<method>(params)`, типы — из сигнатур методов класса. Чтение как у `db`: подписывает
 * и, если значения нет, записывает потребность (пустое — `null`, проход отбросится). Значение перезапрашивается, когда
 * событие тронет коллекции, которые представление читало.
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

/** Клиент глазами привязки к фреймворку: сборщик прохода, загрузка его потребностей, отказы, подписка на изменения. */
export interface BindingClient<Db, Views> {
  createTracker(options?: TrackerOptions): Tracker<Db, Views>
  request(queries: Query[]): Promise<void>
  forgetFailures(keys: string[]): void
  subscribe(listener: (change: ClientChange) => void): () => void
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

  const createTracker = (trackerOptions: TrackerOptions = {}) => {
    return new Tracker<DbApi<Scheme>, ViewsApi<Views>>({
      ...trackerOptions,
      store,
      createReaders: (read) => ({ db: createDb<Scheme>(read), views: createViews<Views>(read) })
    })
  }

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
    DomainsAPI,
    /**
     * Разовое чтение для обработчика: тот же колбэк, что у привязки, записи простые, подписки нет. Покрытое разрешается
     * сразу, зависимые чтения догружаются проходами. Прежний отказ не в счёт, новый отклоняет промис и в `onReadError` не
     * приходит: его показывает тот, кто ждёт. Пересинхронизация в пути — чтение запрашивает снова.
     */
    read: async <R>(read: Read<DbApi<Scheme>, ViewsApi<Views>, R>) => {
      const tracker = createTracker({ plain: true })
      const state = { pass: tracker.run(read) }

      if (tracker.failures.size > 0) {
        store.forgetFailures([...tracker.failures.keys()])
        state.pass = tracker.run(read)
      }

      while (!state.pass.isComplete) {
        const [failure] = tracker.failures.values()

        if (failure) {
          throw failure
        }

        await store.request([...tracker.needs.values()], { isQuiet: true })

        state.pass = tracker.run(read)
      }

      return state.pass.value
    },
    /** Событие из потока. */
    push: (event: DomainEvent) => {
      store.push(event)
    },
    /** Команда сервера или обрыв потока: забыть всё и начать заново. */
    resync: (reason: string) => {
      store.resync(reason)
    },
    /** Для привязки: сборщик прохода, загрузка его потребностей, отказы, подписка на изменения. */
    createTracker,
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

// helpers

type ReadQuery = (query: Query) => unknown

/** Объект данных сборщика: читатели коллекций заводятся при первом обращении. */
const createDb = <Scheme extends CollectionScheme>(read: ReadQuery) => {
  const readers = new Map<string, CollectionReader<object, IType>>()

  return new Proxy({} as DbApi<Scheme>, {
    get: (_, collection) => {
      if (!isMethodKey(collection)) {
        return undefined
      }

      if (!readers.has(collection)) {
        readers.set(collection, {
          get: (id) => {
            return read({ kind: 'get', collection, ids: [id] }) as object | null
          },
          find: (where, opts = {}) => {
            return read({ kind: 'find', collection, where, ...opts }) as object[]
          },
          all: () => {
            return read({ kind: 'find', collection, where: null }) as object[]
          },
          count: (where) => {
            return read({ kind: 'count', collection, where: where ?? null }) as number
          }
        })
      }

      return readers.get(collection)!
    }
  })
}

/** Значения представлений сборщика. */
const createViews = <Views extends ViewsMap>(read: ReadQuery) => {
  return new Proxy({} as ViewsApi<Views>, {
    get: (_, view) => {
      if (!isMethodKey(view)) {
        return undefined
      }

      return new Proxy({} as Record<string, unknown>, {
        get: (__, method) => {
          if (!isMethodKey(method)) {
            return undefined
          }

          return (params: unknown) => read({ kind: 'view', view, method, params })
        }
      })
    }
  })
}

/**
 * Не-строковые ключи и `then` не становятся коллекциями и вызовами: иначе `await` или возврат прокси из
 * `async`-функции превратился бы в чтение коллекции `then` или вызов `domains/<домен>/then`.
 */
const isMethodKey = (key: string | symbol): key is string => {
  return typeof key === 'string' && key !== 'then'
}
