import type { z } from 'zod'

/**
 * Ошибка доменного слоя: `code` — для программ, `message` — для людей. Приложение сужает коды наследником:
 * `class AppDomainError extends DomainError<AppCode> {}`. Рантайм сам бросает код `notFound`: операции или коллекции нет
 * в реестре.
 */
export class DomainError<Code extends string = string> extends Error {
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
