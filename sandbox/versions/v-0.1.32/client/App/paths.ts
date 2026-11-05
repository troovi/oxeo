import { AppKey } from '../../core/keys'

/** Пути страниц приложения — после префикса версии: его добавляет `basename` роутера. */
export const paths = {
  home: '/',
  workers: '/workers',
  worker: (workerId: number) => `/workers/${workerId}`,
  clients: '/clients',
  client: (clientId: number) => `/clients/${clientId}`,
  projects: '/projects',
  project: (projectId: number) => `/projects/${projectId}`,
  shifts: '/shifts',
  /** Сегмент списка смен — смены одной стадии. */
  shiftsByStage: (stage: AppKey.ShiftStage) => `/shifts/${stage}`,
  shift: (shiftId: number) => `/shifts/${shiftId}`,
  dictionaries: '/dictionaries',
  dictionary: (dictionary: string) => `/dictionaries/${dictionary}`
}
