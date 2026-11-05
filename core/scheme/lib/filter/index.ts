/**
 * Язык фильтра: тип `Where` и сверка `matches`. Отдельный вход пакета `@oxeo/scheme/filter` — единственное, что
 * клиенту нужно от схемы в рантайме; вход не тянет за собой декораторы, метаданные и zod.
 */
export * from './filter.types'
export * from './matcher'
