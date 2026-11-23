/**
 * Поверхность библиотеки для `core` версии — роли классов `@Domain()`, `@Service()`, `@View()` из входа
 * `@oxeo/scheme/di`. Вход тянет полифил `reflect-metadata`; клиент берёт из `core` только типы, поэтому в его сборку
 * файл не попадает.
 */
export * from '@oxeo/scheme/di'
