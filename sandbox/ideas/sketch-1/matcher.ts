// @ts-nocheck
/* eslint-disable */

// Сверка записи с фильтром — один код для in-memory драйвера (сервер песочницы, тесты доменов) и для клиента. Mongo-драйвер
// переводит тот же фильтр в запрос базы (`server.ts`), поэтому здесь повторена семантика Mongo, а не придумана своя

import isEqual from 'fast-deep-equal'

const OPERATORS = new Set(['gte', 'gt', 'lte', 'lt', 'in', 'ne'])

/**
 * Подходит ли запись под фильтр: каждое условие выполнено. `null` — коллекция целиком, подходит любая запись.
 * Условие-объект, все ключи которого — операторы, сравнивает; другой объект — вложенный фильтр embedded-блока.
 */
export const matches = (record: object, where: object | null) => {
  if (where === null) {
    return true
  }

  for (const key in where) {
    if (!matchesCondition(record[key], where[key])) {
      return false
    }
  }

  return true
}

const matchesCondition = (value: unknown, condition: unknown) => {
  if (condition === null || typeof condition !== 'object' || Array.isArray(condition)) {
    return equals(value, condition)
  }

  if (isOperators(condition)) {
    return matchesOperators(value, condition)
  }

  return value !== null && typeof value === 'object' && matches(value, condition)
}

/** Равенство как в Mongo: поле-массив (`ReferenceSet`, `enum`) совпадает со скаляром, если тот есть среди элементов. */
const equals = (value: unknown, condition: unknown) => {
  if (Array.isArray(value) && !Array.isArray(condition)) {
    return value.some((item) => isEqual(item, condition))
  }

  return isEqual(value, condition)
}

const isOperators = (condition: object) => {
  const keys = Object.keys(condition)

  return keys.length > 0 && keys.every((key) => OPERATORS.has(key))
}

const matchesOperators = (value: unknown, operators: object) => {
  for (const operator in operators) {
    if (!compare(operator, value, operators[operator])) {
      return false
    }
  }

  return true
}

/** Один оператор. Сравнение порядка — для чисел и строк (даты `YYYY-MM-DD`); с `null` порядок не выполняется. */
const compare = (operator: string, value: unknown, operand: unknown) => {
  if (operator === 'in') {
    return (operand as unknown[]).some((item) => equals(value, item))
  }

  if (operator === 'ne') {
    return !equals(value, operand)
  }

  if (value === null || value === undefined) {
    return false
  }

  if (operator === 'gte') {
    return value >= operand
  }

  if (operator === 'gt') {
    return value > operand
  }

  if (operator === 'lte') {
    return value <= operand
  }

  return value < operand
}
