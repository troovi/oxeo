/**
 * Протокол между клиентом и сервером: запросы и их пакет, ответ на пакет, событие. Фильтр запросов — `Where`
 * коллекций oxeo: сервер выполняет запрос через коллекции, клиент тем же фильтром сверяет записи событий (`matches`).
 */
import type { IType } from './core/types/collections.types'
import type { DomainContext } from './domains/context'
import type { FindOrder } from './filter'

// queries

export namespace Queries {
  /** Записи коллекции по id; отсутствующие id — «записи нет». */
  export interface Get {
    kind: 'get'
    collection: string
    ids: IType[]
  }

  /**
   * Записи коллекции по фильтру; `where: null` — коллекция целиком. С `order` и `limit` — окно: первые `limit` записей в
   * порядке `order` (при равенстве — по id).
   */
  export interface Find {
    kind: 'find'
    collection: string
    where: object | null
    order?: FindOrder
    limit?: number
  }

  /** Число записей коллекции по фильтру; `where: null` — всех. */
  export interface Count {
    kind: 'count'
    collection: string
    where: object | null
  }

  /** Значение представления: метод класса представлений, который исполняет сервер. */
  export interface View {
    kind: 'view'
    view: string
    method: string
    params: unknown
  }
}

export type Query = Queries.Get | Queries.Find | Queries.Count | Queries.View

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

  /** Результат `view`: значение и коллекции, которые представление читало, — по ним клиент знает, когда перезапросить. */
  export interface Value {
    value: unknown
    reads: string[]
  }

  /**
   * Отказ одного запроса: коллекции нет, параметры представления не прошли схему, представление упало. Остальные запросы
   * пакета отвечены как обычно; код — `DomainError.code`, у непредвиденной ошибки — `internal`.
   */
  export interface Failure {
    error: QueryError
  }
}

/** Отказ запроса: код и текст. */
export interface QueryError {
  code: string
  message: string
}

export type QueryResult =
  | QueryResults.Records
  | QueryResults.Count
  | QueryResults.Value
  | QueryResults.Failure

/**
 * Ответ на пакет. Записи — и те, что подошли под запросы, и захваченные по ссылкам на один уровень, каждая один раз;
 * результаты — по порядку запросов пакета.
 */
export interface QueryAnswer {
  records: RecordVersion[]
  results: QueryResult[]
}

// events

/**
 * Событие операции. Вызов (`domain`, `method`, `params`) и `ctx` — для подписчиков на сервере, `result` — вызывающему,
 * `changes` — новые версии всех записей, которые затронула операция: реплика применяет только их. `epoch` — запуск
 * сервера, `revision` — порядок.
 */
export interface DomainEvent<R = unknown> {
  epoch: string
  revision: number
  domain: string
  method: string
  params: unknown
  ctx: DomainContext
  result: R
  changes: RecordVersion[]
}
