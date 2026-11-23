/**
 * Актор песочницы и её отказы. Контекст вызова, токены окружения, `notFound` и `existing` — из библиотеки, типы проекта
 * для них — `core/register.ts`.
 */
import { DomainError } from '../../lib/scheme'

export interface Actor {
  workerId: number
}

/** Отказ бизнес-правила: вход противоречит правилу — код `invariant`. */
export const invariant = (message: string) => {
  return new DomainError('invariant', message)
}
