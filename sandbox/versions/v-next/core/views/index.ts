import { StatsView } from './stats.view'

export * from './stats.view'

/** Реестр представлений: ключ — имя в запросе `view`. Схемы параметров — `@Params` на методах. */
export const appViews = {
  stats: StatsView
}

export type AppViews = typeof appViews
