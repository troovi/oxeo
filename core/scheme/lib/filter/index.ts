/**
 * Язык фильтра: тип `Where`, сверка `matches` и порядок выборки `windowOf`. Отдельный вход пакета `@oxeo/scheme/filter`
 * — единственное, что клиенту нужно от схемы в рантайме; вход не тянет за собой декораторы, метаданные и zod.
 */
export * from './filter.types'
export * from './matcher'
export * from './order'
