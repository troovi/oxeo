/**
 * `@oxeo/server` — всё, что исполняется на сервере: `DataSource` с целостностью схемы, журнал (`createServerShell`)
 * и договор драйвера. Конкретных драйверов здесь нет, они подключаются пакетами: `@oxeo-drivers/mongo`, `@oxeo-drivers/memory`.
 * Фреймворк остаётся снаружи: оболочку над журналом собирает приложение.
 */
export * from './core'
export * from './shell/helpers'
export * from './shell/ids'
export * from './shell/server'
export * from './utils'

export type { DomainEvent, Query, QueryAnswer, QueryBatch, RecordVersion } from '@oxeo/scheme'
