/**
 * `@oxeo/scheme` — всё, на чём пишется общий `core` проекта: схема на декораторах, домены (контекст, ошибка,
 * патчи), представления, параметры операций (`schemaOf`), язык фильтра и протокол. Сервер исполняет этот код, клиент
 * берёт отсюда только типы: в рантайме клиенту нужен лишь отдельный вход `@oxeo/scheme/filter`.
 */
export * from './decorators'
export * from './storages/metadata.storage'
export * from './core'
export * from './domains'
export * from './views'
export * from './filter'
export * from './protocol'
export * from './schema-of'
export * from './utils'
