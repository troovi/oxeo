/** Элемент поля-массива или само значение. */
type ItemOf<V> = V extends readonly (infer I)[] ? I : V

/** Операторы условия на поле; несколько операторов в одном условии должны выполниться все. */
export interface FilterOperators<V> {
  gte?: V
  gt?: V
  lte?: V
  lt?: V
  in?: V[]
  ne?: V
}

/**
 * Условие на поле: значение — равенство (у поля-массива — значение среди элементов, как в Mongo), объект операторов —
 * сравнение, объект полей — вложенный фильтр embedded-блока.
 */
// prettier-ignore
export type FilterCondition<V> = V | ItemOf<V> | FilterOperators<ItemOf<V>> | (V extends readonly unknown[] ? never : V extends object ? Where<V> : never)

/**
 * Фильтр коллекции: поля записи с условиями, выполниться должны все. Один язык для всех: Mongo-драйвер переводит его в
 * запрос базы, базовый драйвер и клиент сверяют записи `matches`.
 */
export type Where<T> = { [K in keyof T]?: FilterCondition<T[K]> }
