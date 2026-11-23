/**
 * Типы проекта для библиотеки — расширение `Register`: по ним типизированы токены `Collections` и `Ids`, контексты
 * `DomainContext` и `ViewContext` и роли `@Allow`. Расширяется сам модуль `@oxeo/scheme`, а не `lib/scheme`:
 * расширение реэкспорта TypeScript с исходным объявлением не сливает.
 */
import type { Actor } from './domains/context'
import type { AppKey } from './keys'
import type { AppScheme } from './scheme'

declare module '@oxeo/scheme' {
  interface Register {
    scheme: AppScheme
    actor: Actor
    counters: AppKey.CounterSource
    roles: AppKey.Position
  }
}
