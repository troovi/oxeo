/** Порядок выборки: поле записи верхнего уровня и направление. При равных значениях — по id по возрастанию. */
export interface FindOrder<T = Record<string, unknown>> {
  field: keyof T & string
  direction: 'asc' | 'desc'
}

/** Опции `find`: порядок и предел — окно первых `limit` записей в этом порядке; предел без порядка — по id. */
export interface FindOptions<T = Record<string, unknown>> {
  order?: FindOrder<T>
  limit?: number
}

/**
 * Запись вместе с id: у клиента id хранится рядом с записью, драйвер берёт его из поля идентификатора. Тип id — свой, а
 * не `IType` ядра: вход `filter` публикуется без остальных исходников пакета.
 */
export type OrderedEntry = [string | number, object]

/** Ранг типа значения — как в Mongo: пустое (`null`, нет поля), числа, строки, остальное. */
const rankOf = (value: unknown) => {
  if (value === null || value === undefined) {
    return 0
  }

  if (typeof value === 'number') {
    return 1
  }

  if (typeof value === 'string') {
    return 2
  }

  return 3
}

/** Сравнение двух значений поля: сначала ранг типа, внутри — естественный порядок чисел и строк. */
const compareValues = (left: unknown, right: unknown) => {
  const rank = rankOf(left) - rankOf(right)

  if (rank !== 0) {
    return rank
  }

  if ((typeof left === 'number' || typeof left === 'string') && left !== right) {
    return left < (right as typeof left) ? -1 : 1
  }

  return 0
}

/**
 * Сравнение записей в порядке выборки: значение поля в направлении порядка, при равенстве и без порядка — id по
 * возрастанию. Одна функция для драйвера памяти и клиента; Mongo-драйвер повторяет её сортировкой `{ field: ±1, id: 1 }`.
 */
export const compareEntries = (
  order: FindOrder | undefined,
  left: OrderedEntry,
  right: OrderedEntry
) => {
  if (order) {
    const field = order.field as keyof object
    const byField = compareValues(left[1][field], right[1][field])

    if (byField !== 0) {
      return order.direction === 'asc' ? byField : -byField
    }
  }

  return compareValues(left[0], right[0])
}

/** Окно выборки: записи в порядке опций и первые `limit` из них; предел без порядка — по id; без опций — как есть. */
export const windowOf = <E extends OrderedEntry>(entries: E[], opts: FindOptions = {}) => {
  const { order, limit } = opts

  if (!order && limit === undefined) {
    return entries
  }

  const sorted = [...entries].sort((left, right) => compareEntries(order, left, right))

  return limit === undefined ? sorted : sorted.slice(0, limit)
}
