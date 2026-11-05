import { ClientsDomain } from './clients/clients.domain'
import { DictionaryDomain } from './dictionary/dictionary.domain'
import { ProjectsDomain } from './projects/projects.domain'
import { ShiftsDomain } from './shifts/shifts.domain'
import { WorkersDomain } from './workers/workers.domain'

export * from './context'
export * from './clients/clients.domain'
export * from './dictionary/dictionary.domain'
export * from './projects/projects.domain'
export * from './shifts/shifts.domain'
export * from './workers/workers.domain'

/**
 * Реестр доменов: ключ — имя в маршруте `domains/<key>/<method>`. Схемы параметров — `params.ts`,
 * только серверу.
 */
export const appDomains = {
  dictionary: DictionaryDomain,
  workers: WorkersDomain,
  clients: ClientsDomain,
  projects: ProjectsDomain,
  shifts: ShiftsDomain
}

export type AppDomains = typeof appDomains
