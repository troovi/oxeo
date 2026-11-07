/**
 * `@oxeo/client` — всё, что исполняется на клиенте: живая часть базы, чтения и пакеты запросов, события,
 * вызовы операций. Схема и домены приходят только типами, поэтому в сборку клиента не попадают ни декораторы, ни zod,
 * ни реализация доменов.
 */
export * from './client'
export * from './tracker'

export { QueryFailedError } from './live-store'
export type { ClientOptions, ClientTransport } from './live-store'
export type {
  DomainEvent,
  Query,
  QueryAnswer,
  QueryBatch,
  QueryError,
  RecordVersion
} from '@oxeo/scheme'
