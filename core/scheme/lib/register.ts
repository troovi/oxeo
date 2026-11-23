/**
 * Типы проекта — расширением `Register`, один раз на проект:
 *
 * ```ts
 * declare module '@oxeo/scheme' {
 *   interface Register {
 *     scheme: AppScheme
 *     actor: Actor
 *     counters: AppKey.CounterSource
 *     roles: AppKey.Position
 *   }
 * }
 * ```
 *
 * По ним библиотека типизирует токены `Collections` и `Ids`, контексты `DomainContext` и `ViewContext` и роли
 * `@Allow`. Без расширения типы широкие: любая схема, актор `unknown`, источники номеров и роли — строки.
 */
import type { CollectionScheme } from './core/data-scheme'

export interface Register {}

/** Схема проекта — `Register.scheme`. */
// prettier-ignore
export type RegisteredScheme = Register extends { scheme: infer S extends CollectionScheme } ? S : CollectionScheme

/** Актор вызова — `Register.actor`; `null` в контексте — система. */
export type RegisteredActor = Register extends { actor: infer A } ? A : unknown

/** Источники числовых идентификаторов — `Register.counters`. */
export type RegisteredCounter = Register extends { counters: infer C extends string } ? C : string

/** Роли актора для `@Allow` — `Register.roles`. */
export type RegisteredRole = Register extends { roles: infer R extends string } ? R : string
