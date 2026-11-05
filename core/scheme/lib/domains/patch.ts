/**
 * Применение патча к черновику `update`: поля верхнего уровня присваиваются целиком (json
 * перезаписывается, как и требует oxeo), а перечисленные embedded-блоки правятся по полям рекурсивно.
 * `undefined` пропускается. json-поля верхнего уровня не сливаются по полям, а заменяются целиком.
 */
import { isPlainObject } from '@companix/utils-js'

/** Патч: поля необязательны, embedded-блоки могут быть частичными, json — целиком. */
export type Patch<T> = {
  [K in keyof T]?: T[K] extends (infer U)[] ? U[] : T[K] extends object ? Patch<T[K]> | T[K] : T[K]
}

export const applyPatch = <T extends object>(draft: T, patch: Patch<T>, embedded: (keyof T)[] = []) => {
  for (const key in patch) {
    const value = patch[key]

    if (value === undefined) {
      continue
    }

    if (embedded.includes(key) && isPlainObject(value) && isPlainObject(draft[key])) {
      applyEmbedded(draft[key] as object, value as object)
    } else {
      draft[key] = value as T[typeof key]
    }
  }
}

/** Внутри embedded-блока любой вложенный plain-объект — тоже embedded. */
const applyEmbedded = (target: object, source: object) => {
  for (const key in source) {
    const value = (source as Record<string, unknown>)[key]

    if (value === undefined) {
      continue
    }

    const current = (target as Record<string, unknown>)[key]

    if (isPlainObject(value) && isPlainObject(current)) {
      applyEmbedded(current as object, value as object)
    } else {
      ;(target as Record<string, unknown>)[key] = value
    }
  }
}

/** Глубокий клон прочитанной сущности для снимка в json-поле — до любого `update`, не из черновика. */
export const snapshot = <T>(value: T): T => JSON.parse(JSON.stringify(value))

/** Устойчивая сортировка по идентификатору — порядок `findBy/getAll` не гарантирован. */
export const sortById = <T>(items: T[], id: (item: T) => string | number) =>
  [...items].sort((a, b) => (id(a) < id(b) ? -1 : id(a) > id(b) ? 1 : 0))
