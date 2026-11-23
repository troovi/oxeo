/**
 * Что сервер даёт домену. Выдача идентификаторов одна на все вызовы, поэтому она в окружении домена, рядом с коллекциями
 * (`createIdSource` пакета `@oxeo/server`). Контекст у каждого вызова свой — это второй аргумент метода.
 */
import type { RegisteredActor } from '../register'
import { DomainError } from './error'

export interface IdSource<Source extends string = string> {
  /** Строковый id — `hash()`; метка нужна только для читаемости домена. */
  string(label: string): string
  /** Следующий номер счётчика `source`. */
  number(source: Source): Promise<number>
}

/**
 * Контекст вызова с актором `Actor` — общая форма для рантайма и протокола. Создаёт его только сервер, он же уходит в
 * событие.
 */
export interface DomainContextOf<Actor = unknown> {
  /** `null` — система (посев, служебные вызовы сервера). */
  readonly actor: Actor | null
  /** Единый момент вызова, мс. */
  readonly at: number
  /** Дата `YYYY-MM-DD` момента `at` в часовом поясе приложения — вычисляет сервер. */
  readonly today: string
}

/** Контекст вызова домена проекта: актор — `Register.actor`. */
export interface DomainContext extends DomainContextOf<RegisteredActor> {}

/** Контекст с актором — вызова домена или расчёта представления. */
interface ActorContext {
  readonly actor: RegisteredActor | null
}

/** Вызывает система: посев, планировщик, сервер после своей проверки. */
export const isSystem = (ctx: ActorContext) => {
  return ctx.actor === null
}

/**
 * Актор вызова, а не система, — для операций «от себя»; у системы — отказ `forbidden`. Тип ответа записан явно:
 * выведенный при сборке, он попал бы в `.d.ts` без расширения `Register` (`{} | undefined`).
 */
export const requireActor = (ctx: ActorContext): RegisteredActor => {
  if (ctx.actor === null) {
    throw new DomainError('forbidden', 'Действие требует вход пользователя')
  }

  return ctx.actor
}
