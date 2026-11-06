/**
 * `@oxeo/server` — всё, что исполняется на сервере: `DataSource` с целостностью схемы, рантайм доменов (`DomainRuntime`)
 * и договор драйвера. Конкретных драйверов здесь нет, они подключаются пакетами: `@oxeo-drivers/mongo`, `@oxeo-drivers/memory`.
 * Фреймворк остаётся снаружи: маршруты и транспорт над рантаймом собирает приложение.
 */
export * from './core'
export * from './runtime/ids'
export * from './runtime/runtime'
export * from './utils'

export type { DomainEvent, Query, QueryAnswer, QueryBatch, RecordVersion } from '@oxeo/scheme'
