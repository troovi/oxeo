import { StatsViews } from './stats.views'

export * from './stats.views'

/** Реестр представлений: ключ — имя в запросе `view`. Схемы параметров — `params.ts`, только серверу. */
export const appViews = {
  stats: StatsViews
}

export type AppViews = typeof appViews
