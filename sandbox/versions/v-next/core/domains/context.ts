/**
 * Контекст вызова домена песочницы: актор — сотрудник (или `null` — система), источники нумерации —
 * счётчики `counter`. Выдача идентификаторов — библиотека.
 */
import { DomainContext as OxeoDomainContext, DomainError } from '../../lib/scheme'
import { AppKey } from '../keys'

export interface Actor {
  workerId: number
}

export type DomainContext = OxeoDomainContext<Actor, AppKey.CounterSource>

export type DomainErrorCode = 'notFound' | 'invariant'

/** Ошибка бизнес-правила. */
export class AppDomainError extends DomainError<DomainErrorCode> {}

export const notFound = (what: string) => {
  return new AppDomainError('notFound', `Не найдено: ${what}`)
}

export const invariant = (message: string) => {
  return new AppDomainError('invariant', message)
}
