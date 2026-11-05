/**
 * Контекст вызова домена — как его видит домен. Создаёт контекст только сервер: актор, единый момент `at`, календарная
 * дата `today` и выдача идентификаторов (`createIdSource` пакета `@oxeo/server`).
 */
export interface IdSource<Source extends string = string> {
  /** Строковый id — `hash()`; метка нужна только для читаемости домена. */
  string(label: string): string
  /** Следующий номер счётчика `source`. */
  number(source: Source): Promise<number>
}

export interface DomainContext<Actor = unknown, Source extends string = string> {
  /** `null` — система (посев, служебные вызовы сервера). */
  actor: Actor | null
  /** Единый момент вызова, мс. */
  at: number
  /** Дата `YYYY-MM-DD` момента `at` в часовом поясе приложения — вычисляет сервер. */
  today: string
  ids: IdSource<Source>
}

/** Контекст события журнала — то, что читают подписчики журнала на сервере. */
export interface EventContext<Actor = unknown> {
  actor: Actor | null
  at: number
  today: string
}
