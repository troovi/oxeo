import type { z } from 'zod'

/**
 * Базовые коды ошибок домена: для программ — код, для людей — русское сообщение. Код выбирают по смыслу:
 * - `notFound` — записи с таким id нет;
 * - `forbidden` — вызывает не тот: роль (`@Allow`), служебная операция (`@System`), действие «от себя» — система;
 * - `invalidStage` — состояние записи, своей или по ссылке, не пускает сейчас: этап, статус;
 * - `invariant` — вход противоречит правилу, исправить нужно параметры: дата в будущем, не тот тип;
 * - `conflict` — значение занято другой записью или повторено в параметрах.
 *
 * Рантайм сам бросает `notFound` (операции или коллекции нет), `forbidden` (доступ) и `params` (`ParamsError`). Свои коды
 * проект добавляет наследником `DomainError`.
 */
export type DomainErrorCode = 'notFound' | 'forbidden' | 'invalidStage' | 'invariant' | 'conflict'

/**
 * Ошибка доменного слоя: `code` — для программ, `message` — для людей. По умолчанию код — один из базовых: опечатка в
 * коде не компилируется. Приложение расширяет коды наследником:
 * `class AppDomainError extends DomainError<DomainErrorCode | 'taskDecision'> {}`; рантайм и сервер узнают любого
 * наследника.
 */
export class DomainError<Code extends string = DomainErrorCode> extends Error {
  constructor(
    readonly code: Code,
    message: string
  ) {
    super(message)
    this.name = 'DomainError'
  }
}

/** Параметры вызова не прошли схему операции; `issues` — что именно не так. */
export class ParamsError extends DomainError<'params'> {
  constructor(readonly issues: z.core.$ZodIssue[]) {
    super('params', 'Параметры не прошли проверку')
    this.name = 'ParamsError'
  }
}

/** Отказ `notFound`: «Не найдено: <что>». */
export const notFound = (what: string) => {
  return new DomainError('notFound', `Не найдено: ${what.toLowerCase()}`)
}

/**
 * «Найти или отказать» одной строкой: запись из чтения (`this.collections.<коллекция>.get(id)`) или `notFound(what)`.
 * Свой загрузчик домену нужен, только когда кроме существования проверяется состояние записи.
 */
export const existing = async <T>(read: Promise<T | null>, what: string) => {
  const record = await read

  if (!record) {
    throw notFound(what)
  }

  return record
}

export interface ReasonsRefusal {
  code: DomainErrorCode
  /** Подводка отказа — перечень идёт после двоеточия. */
  lead: string
}

/** Отказ с перечнем причин: пусто — ничего, иначе `DomainError` «<lead>: причина; причина». */
export const assertNone = (reasons: string[], { code, lead }: ReasonsRefusal) => {
  if (reasons.length > 0) {
    throw new DomainError(code, `${lead}: ${reasons.join('; ')}`)
  }
}
