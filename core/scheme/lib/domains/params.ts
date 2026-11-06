/**
 * Схемы параметров операций — реестр, который проект передаёт `DomainRuntime`. Рантайм проверяет ими каждый вызов, а сам
 * реестр перечисляет публичные операции: вызов без схемы — неизвестная операция.
 */
import type { z } from 'zod'
import type { DomainRoutes, DomainsMap } from './domains.types'

export type ParamsSchema<P = unknown> = z.ZodType<P>

/** Схема на каждый публичный метод каждого домена: результат схемы — параметры метода. */
export type DomainsParams<T extends DomainsMap> = {
  [D in keyof T]: {
    [M in keyof DomainRoutes<T>[D]]: ParamsSchema<DomainRoutes<T>[D][M]['params']>
  }
}

/**
 * Реестр схем по типу доменов: компилятор не пропустит домен или метод без схемы, лишний метод и схему не того типа.
 *
 * ```ts
 * export const appParams = createDomainsParams<AppDomains>({
 *   notes: { add: NotesParams.Add }
 * })
 * ```
 */
export const createDomainsParams = <T extends DomainsMap>(params: DomainsParams<T>) => {
  return params
}
