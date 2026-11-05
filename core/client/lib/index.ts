/**
 * `@oxeo/client` — всё, что исполняется на клиенте: живая часть базы, чтения и пакеты запросов, события журнала,
 * вызовы операций. Схема и домены приходят только типами, поэтому в сборку клиента не попадают ни декораторы, ни zod,
 * ни реализация доменов.
 */
export * from './client'
export * from './tracker'

export { UncoveredReadError } from './live-store'
export type { ClientOptions, ClientTransport } from './live-store'
export type { DomainEvent, Query, QueryAnswer, QueryBatch, RecordVersion } from '@oxeo/scheme'
