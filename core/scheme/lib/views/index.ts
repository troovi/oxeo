/**
 * Контракт представлений — чтений, которые исполняет сервер и отдаёт клиенту значением: агрегаты, сводки, выборки с
 * логикой, которую не выражает фильтр. Класс представлений получает коллекции только на чтение и не пишет; метод —
 * `(params, ctx)`, результат — значение (JSON). Параметры проверяет схема `@Params`, как у доменов.
 */
import type { DomainRoutes } from '../domains'
import type { RegisteredActor } from '../register'

/**
 * Контекст расчёта с актором `Actor` — общая форма для рантайма: кто смотрит и какой сегодня день. Момента нет:
 * значение кэшируется на день.
 */
export interface ViewContextOf<Actor = unknown> {
  /** `null` — без идентичности (система, проверки). */
  readonly actor: Actor | null
  /** Дата `YYYY-MM-DD` в часовом поясе приложения — вычисляет сервер. */
  readonly today: string
}

/** Контекст расчёта представления проекта: актор — `Register.actor`. */
export interface ViewContext extends ViewContextOf<RegisteredActor> {}

/**
 * Реестр представлений: ключ — имя в запросе, значение — класс. Экземпляр собирает контейнер рантайма заново на каждый
 * расчёт, коллекции в нём — только на чтение; класс реестра — с ролью `@View()` из `@oxeo/scheme/di`.
 */
export interface ViewsMap {
  [view: string]: new (...args: any[]) => object
}

/** Методы представлений из сигнатур: метод → `{ params, answer }`. */
export type ViewRoutes<T extends ViewsMap> = DomainRoutes<T>
