/**
 * Что сервер даёт домену. Выдача идентификаторов одна на все вызовы, поэтому она в окружении домена, рядом с коллекциями
 * (`createIdSource` пакета `@oxeo/server`). Контекст у каждого вызова свой — это второй аргумент метода.
 */
export interface IdSource<Source extends string = string> {
  /** Строковый id — `hash()`; метка нужна только для читаемости домена. */
  string(label: string): string
  /** Следующий номер счётчика `source`. */
  number(source: Source): Promise<number>
}

/** Контекст вызова: то, что у каждого вызова своё. Создаёт его только сервер, он же уходит в событие. */
export interface DomainContext<Actor = unknown> {
  /** `null` — система (посев, служебные вызовы сервера). */
  readonly actor: Actor | null
  /** Единый момент вызова, мс. */
  readonly at: number
  /** Дата `YYYY-MM-DD` момента `at` в часовом поясе приложения — вычисляет сервер. */
  readonly today: string
}
