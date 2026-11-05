/**
 * `@oxeo/client` — всё, что исполняется на клиенте: живая часть базы, чтения и пакеты запросов, очередь событий,
 * вызовы операций. Схема и домены приходят только типами, поэтому в сборку клиента не попадают ни декораторы, ни zod,
 * ни реализация доменов.
 */
export * from './client'
export * from './sync'
export * from './tracker'

export type { DomainEvent, Query, QueryAnswer, QueryBatch, RecordVersion } from '@oxeo/scheme'
