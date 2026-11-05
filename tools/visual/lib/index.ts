/**
 * @oxeo/visual — интерактивная карта схемы данных oxeo. Модели, поля, embedded-блоки и связи берутся из
 * `DataScheme` и исходников схемы (JSDoc, декораторы, типы TS); проект задаёт только каркас: зоны и пояса.
 *
 * В проекте: `oxeo-visual.config.ts` с `defineConfig(...)` и скрипт `oxeo-visual dev` — сервер с картой в браузере,
 * пересборкой при изменении схемы и остановкой вместе со скриптом. `oxeo-visual build` пишет HTML и SVG.
 */
export * from './config'
export * from './model'
export * from './project'
export type { SchemeSource } from './scheme-meta'
export { extractScheme, type ExtractOptions } from './extract'
export { buildSchemeMap, type SchemeMapOptions, type SchemeMapResult } from './build'
