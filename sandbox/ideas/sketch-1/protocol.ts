// @ts-nocheck
/* eslint-disable */

// Протокол xeo 1.0 между клиентом и сервером: фильтр, запросы и их пакет, ответ, событие журнала, сообщения потока

import type { IType } from '@companix/xeo-scheme'

// filter

/** Операторы условия на поле; несколько операторов в одном условии — все должны выполниться. */
export interface Operators<V> {
  gte?: V
  gt?: V
  lte?: V
  lt?: V
  in?: V[]
  ne?: V
}

/** Условие на поле: значение — равенство, объект операторов — сравнение; embedded — вложенным фильтром. */
export type Condition<V> = V | Operators<V> | (V extends object ? Where<V> : never)

/**
 * Фильтр запроса — тот же, что у `findBy` коллекций xeo: поля записи с условиями, все условия должны выполниться.
 * Сервер переводит фильтр в запрос Mongo, in-memory драйвер и клиент сверяют записи одним кодом (`matcher.ts`).
 */
export type Where<T> = { [K in keyof T]?: Condition<T[K]> }

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

/** Пакет запросов — одно обращение к серверу: потребности всех обёрток одного такта или один `load`. */
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
 * Ответ на пакет. Записи — и те, что подошли под запросы, и захваченные по ссылкам на один уровень, каждая один раз.
 * Результаты — по порядку запросов пакета. Ревизия — на которой сервер снял ответ в очереди журнала.
 */
export interface QueryAnswer {
  epoch: string
  revision: number
  records: RecordVersion[]
  results: QueryResult[]
}

// journal

/** Контекст события — то, что читают подписчики журнала на сервере; ленты идентификаторов больше нет. */
export interface EventContext<Actor = unknown> {
  actor: Actor | null
  at: number
  today: string
}

/**
 * Событие журнала. Вызов (`domain`, `method`, `params`) и `ctx` — для журнала и подписчиков на сервере, `result` —
 * вызывающему, `changes` — новые версии всех записей, которые затронула операция; реплика применяет только их.
 */
export interface JournalEvent<R = unknown> {
  epoch: string
  revision: number
  domain: string
  method: string
  params: unknown
  ctx: EventContext
  result: R
  changes: RecordVersion[]
}

// stream

export namespace StreamMessages {
  export interface Event {
    type: 'event'
    data: JournalEvent
  }

  /** Реплика должна забыть всё: сброс базы, частичная запись. */
  export interface Resync {
    type: 'resync'
    data: string
  }
}

export type StreamMessage = StreamMessages.Event | StreamMessages.Resync
