/**
 * `@oxeo/scheme` — всё, на чём пишется общий `core` проекта: схема на декораторах, типы проекта (`Register`), домены
 * (контекст, токены окружения, ошибки, доступ, описания, патчи), представления, параметры операций (`schemaOf`,
 * `@Params`), язык фильтра и протокол. Сервер исполняет этот код, клиент берёт отсюда только типы: в рантайме клиенту
 * нужен лишь отдельный вход `@oxeo/scheme/filter`. Роли классов (`@Domain`, `@Service`, `@View`) — в отдельном входе
 * `@oxeo/scheme/di`: он тянет полифил `reflect-metadata`, клиенту не нужный.
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
export * from './register'
