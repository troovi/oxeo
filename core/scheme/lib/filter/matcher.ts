import isEqual from 'fast-deep-equal'

const OPERATORS = new Set(['gte', 'gt', 'lte', 'lt', 'in', 'ne'])

/** Объект условия — операторы, если он не пуст и все его ключи — операторы фильтра. */
export const isFilterOperators = (condition: object) => {
  const keys = Object.keys(condition)

  return keys.length > 0 && keys.every((key) => OPERATORS.has(key))
}

/**
 * Подходит ли запись под фильтр: выполнено каждое условие. Семантика повторяет Mongo, потому что тот же фильтр Mongo-
 * драйвер переводит в запрос базы: поле-массив совпадает со скаляром, если тот есть среди элементов; сравнение порядка с
 * `null` не выполняется. Пустой фильтр подходит под любую запись.
 */
export const matches = (record: unknown, where: object) => {
  for (const key in where) {
    const value =
      record !== null && typeof record === 'object' ? record[key as keyof object] : undefined

    if (!matchesCondition(value, where[key as keyof object])) {
      return false
    }
  }

  return true
}

const matchesCondition = (value: unknown, condition: unknown) => {
  if (condition === null || typeof condition !== 'object' || Array.isArray(condition)) {
    return equals(value, condition)
  }

  if (isFilterOperators(condition)) {
    return matchesOperators(value, condition)
  }

  return value !== null && typeof value === 'object' && matches(value, condition)
}

const equals = (value: unknown, condition: unknown) => {
  if (Array.isArray(value) && !Array.isArray(condition)) {
    return value.some((item) => isEqual(item, condition))
  }

  return isEqual(value, condition)
}

const matchesOperators = (value: unknown, operators: object) => {
  for (const operator in operators) {
    if (!compare(operator, value, operators[operator as keyof object])) {
      return false
    }
  }

  return true
}

/** Один оператор. Порядок сравнивается у чисел и строк (даты `YYYY-MM-DD`); у поля-массива — любой элемент. */
const compare = (operator: string, value: unknown, operand: unknown): boolean => {
  if (operator === 'in') {
    return (operand as unknown[]).some((item) => equals(value, item))
  }

  if (operator === 'ne') {
    return !equals(value, operand)
  }

  if (Array.isArray(value)) {
    return value.some((item) => compare(operator, item, operand))
  }

  if (value === null || value === undefined || operand === null || operand === undefined) {
    return false
  }

  const left = value as number | string
  const right = operand as number | string

  if (operator === 'gte') {
    return left >= right
  }

  if (operator === 'gt') {
    return left > right
  }

  if (operator === 'lte') {
    return left <= right
  }

  return left < right
}
