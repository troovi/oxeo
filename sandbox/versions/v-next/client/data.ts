/**
 * Слой данных клиента на oxeo 1.0: клиент держит живую часть базы сервера — то, что прочитали страницы, — и получает
 * изменения событиями. Схема и домены — только типами: ни декораторов, ни классов доменов в сборке клиента нет.
 * Читают данные только через `useDb`: `db` и значения представлений живут параметрами его колбэка. Запросы идут через
 * `network` kit — их видит панель Networks.
 */
import { createStore, network, toaster } from '../../../app/kit'
import { DomainEvent, QueryAnswer, createClient, createUseDb } from '../lib/client'
import type { AppDomains } from '../core/domains'
import type { AppScheme } from '../core/scheme'
import type { AppViews } from '../core/views'

export const BASE_URL = '/api/v-next'

/** Запрос к серверу версии; отказ сервера — ошибка с его текстом. */
const post = async <T>(url: string, body: unknown): Promise<T> => {
  const response = await network.fetch(`${BASE_URL}/${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload.message ?? response.statusText)
  }

  return payload
}

export namespace ConnectionStatuses {
  export interface Connecting {
    kind: 'connecting'
  }

  export interface Live {
    kind: 'live'
  }

  export interface Offline {
    kind: 'offline'
    reason: string
  }
}

export type ConnectionStatus =
  | ConnectionStatuses.Connecting
  | ConnectionStatuses.Live
  | ConnectionStatuses.Offline

export interface SessionState {
  status: ConnectionStatus
  /** Последняя пересинхронизация: клиент забыл всё и перезапросил то, что читают страницы. */
  resync: string | null
}

export const session = createStore<SessionState>({
  status: { kind: 'connecting' },
  resync: null
})

/**
 * Клиент версии: пакеты запросов — `POST data/query`, вызовы — `POST domains/<domain>/<method>` от имени системы (без
 * `x-worker-id`). Пересинхронизация мягкая: клиент забывает всё, смонтированные страницы перезапрашивают своё. Отказ
 * чтения виден тостом: мелкие части экрана вида ошибки не рисуют.
 */
export const client = createClient<AppScheme, AppDomains, AppViews>({
  transport: {
    query: (batch) => post<QueryAnswer>('data/query', batch),
    call: ({ domain, method, params }) => post<DomainEvent>(`domains/${domain}/${method}`, params)
  },
  onResync: (reason) => {
    session.set({ resync: reason })
  },
  onReadError: () => {
    toaster.danger('Не удалось загрузить данные')
  }
})

/** Вызовы операций: промис разрешается, когда событие применено у клиента. Разовое чтение — для обработчиков. */
export const { DomainsAPI, read: readDb } = client

/** Чтение в компонентах. */
export const useDb = createUseDb(client)
