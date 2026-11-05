/** Типы реестра доменов и его маршрутов: по ним сервер вызывает методы, а клиент типизирует `DomainsAPI`. */
import type { DomainEvent } from '../protocol'

export interface DomainCall {
  domain: string
  method: string
  params: unknown
}

/** Реестр доменов: ключ — имя в маршруте, значение — класс с конструктором `(collections)`. */
export interface DomainsMap {
  [domain: string]: new (collections: any) => object
}

export type DomainServices<T extends DomainsMap> = { [K in keyof T]: InstanceType<T[K]> }

/** Маршруты доменов из сигнатур: метод → `{ params, answer }`, контекст в маршрут не входит. */
export type DomainRoutes<T extends DomainsMap> = {
  [D in keyof T]: {
    [M in keyof InstanceType<T[D]>]: InstanceType<T[D]>[M] extends (
      params: infer P,
      ...args: any[]
    ) => infer A
      ? { params: P; answer: Awaited<A> }
      : never
  }
}

/** Маршруты HTTP: ответ сервера — событие журнала с результатом метода. */
export type DomainApiRoutes<T extends DomainsMap> = {
  [D in keyof T]: {
    [M in keyof DomainRoutes<T>[D]]: {
      params: DomainRoutes<T>[D][M]['params']
      answer: DomainEvent<DomainRoutes<T>[D][M]['answer']>
    }
  }
}
