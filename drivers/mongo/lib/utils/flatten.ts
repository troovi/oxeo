import { isPlainObject } from '@companix/utils-js'
import { isFilterOperators } from '@oxeo/scheme'

/**
 * Фильтр oxeo (`Where`) в фильтр Mongo: embedded — путями через точку, объект операторов (`gte`, `in`, …) — те же
 * операторы с `$` на своём пути. Семантика совпадает со сверкой `matches` базового драйвера и клиента.
 */
export const buildFlattenMap = (filter: object): Record<string, unknown> => {
  const out: Record<string, unknown> = {}

  const walk = (node: unknown, prefix: string) => {
    if (node === undefined) {
      return
    }

    if (node === null || typeof node !== 'object' || Array.isArray(node) || !isPlainObject(node)) {
      if (prefix !== '') {
        out[prefix] = node
      }

      return
    }

    if (prefix !== '' && isFilterOperators(node)) {
      const operators: Record<string, unknown> = {}

      for (const operator in node) {
        operators[`$${operator}`] = node[operator as keyof object]
      }

      out[prefix] = operators
      return
    }

    const keys = Object.keys(node)

    if (keys.length === 0) {
      if (prefix !== '') {
        out[prefix] = node
      }

      return
    }

    for (const key of keys) {
      const path = prefix ? `${prefix}.${key}` : key

      walk((node as Record<string, unknown>)[key], path)
    }
  }

  walk(filter, '')

  return out
}
