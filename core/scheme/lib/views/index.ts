/**
 * Контракт представлений — чтений, которые исполняет сервер и отдаёт клиенту значением: агрегаты, сводки, выборки с
 * логикой, которую не выражает фильтр. Класс представлений получает только коллекции и не пишет; метод —
 * `(params, ctx)`, результат — значение (JSON). Параметры проверяет реестр схем, как у доменов.
 */
import type { DomainRoutes, DomainsParams } from '../domains'

/** Контекст расчёта: кто смотрит и какой сегодня день. Момента нет: значение кэшируется на день. */
export interface ViewContext<Actor = unknown> {
  /** `null` — без идентичности (система, проверки). */
  readonly actor: Actor | null
  /** Дата `YYYY-MM-DD` в часовом поясе приложения — вычисляет сервер. */
  readonly today: string
}

/** Реестр представлений: ключ — имя в запросе, значение — класс с конструктором `(collections)`. */
export interface ViewsMap {
  [view: string]: new (collections: any) => object
}

/** Методы представлений из сигнатур: метод → `{ params, answer }`. */
export type ViewRoutes<T extends ViewsMap> = DomainRoutes<T>

/** Схема на каждый публичный метод каждого класса представлений. */
export type ViewsParams<T extends ViewsMap> = DomainsParams<T>

/**
 * Реестр схем параметров представлений по типу реестра: компилятор не пропустит метод без схемы и схему не того типа.
 *
 * ```ts
 * export const appViewParams = createViewsParams<AppViews>({
 *   stats: { yearSummary: StatsViewParams.Year }
 * })
 * ```
 */
export const createViewsParams = <T extends ViewsMap>(params: ViewsParams<T>) => {
  return params
}
