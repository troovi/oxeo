/**
 * Контекст вызова домена песочницы: актор — сотрудник (или `null` — система), источники нумерации —
 * счётчики `counter`. Механика ленты идентификаторов — библиотека.
 */
import { DomainContext as XeoDomainContext, DomainError } from '../../lib'
import { AppKey } from '../keys'

export interface Actor {
  workerId: number
}

export type DomainContext = XeoDomainContext<Actor, AppKey.CounterSource>

export type DomainErrorCode = 'notFound' | 'invariant'

/** Ошибка бизнес-правила: бросается одинаково на сервере и при повторе на реплике. */
export class AppDomainError extends DomainError<DomainErrorCode> {}

export const notFound = (what: string) => {
  return new AppDomainError('notFound', `Не найдено: ${what}`)
}

export const invariant = (message: string) => {
  return new AppDomainError('invariant', message)
}
