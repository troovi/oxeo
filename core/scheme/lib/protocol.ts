/**
 * Протокол между клиентом и сервером: запросы и их пакет, ответ на пакет, событие журнала. Фильтр запросов — `Where`
 * коллекций oxeo: сервер выполняет запрос через коллекции, клиент тем же фильтром сверяет записи событий (`matches`).
 */
import type { IType } from './core/types/collections.types'
import type { EventContext } from './domains/context'

// queries

export namespace Queries {
  /** Записи коллекции по id; отсутствующие id — «записи нет». */
  export interface Get {
    kind: 'get'
    collection: string
    ids: IType[]
  }

  /** Записи коллекции по фильтру; `where: null` — коллекция целиком. */
  export interface Find {
    kind: 'find'
    collection: string
    where: object | null
  }

  /** Число записей коллекции по фильтру; `where: null` — всех. */
  export interface Count {
    kind: 'count'
    collection: string
    where: object | null
  }
}

export type Query = Queries.Get | Queries.Find | Queries.Count

/** Пакет запросов — одно обращение к серверу. */
export interface QueryBatch {
  queries: Query[]
}

// answer

/** Версия записи: запись целиком; `record: null` — записи нет (удалена или не найдена). */
export interface RecordVersion {
  collection: string
  id: IType
  record: object | null
}

export namespace QueryResults {
  /** Результат `get` и `find` — id записей, которые под него подошли. */
  export interface Records {
    ids: IType[]
  }

  /** Результат `count`. */
  export interface Count {
    count: number
  }
}

export type QueryResult = QueryResults.Records | QueryResults.Count

/**
 * Ответ на пакет. Записи — и те, что подошли под запросы, и захваченные по ссылкам на один уровень, каждая один раз;
 * результаты — по порядку запросов пакета; ревизия — на которой сервер снял ответ в очереди журнала.
 */
export interface QueryAnswer {
  epoch: string
  revision: number
  records: RecordVersion[]
  results: QueryResult[]
}

// journal

/**
 * Событие журнала. Вызов (`domain`, `method`, `params`) и `ctx` — для журнала и подписчиков на сервере, `result` —
 * вызывающему, `changes` — новые версии всех записей, которые затронула операция: реплика применяет только их. `epoch`
 * — запуск сервера, `revision` — порядок.
 */
export interface DomainEvent<R = unknown> {
  epoch: string
  revision: number
  domain: string
  method: string
  params: unknown
  ctx: EventContext
  result: R
  changes: RecordVersion[]
}
