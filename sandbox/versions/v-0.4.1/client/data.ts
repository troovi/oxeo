/**
 * Слой данных клиента на oxeo 1.0: клиент держит живую часть базы сервера — то, что прочитали страницы, — и получает
 * изменения событиями. Схема и домены — только типами: ни декораторов, ни классов доменов в сборке клиента нет.
 * Компоненты, которые читают данные, — в обёртке `live`; код, который зовут чужие компоненты (`useOptions` formkit),
 * читает через мост `useData`. Запросы идут через `network` kit — их видит панель Networks.
 */
import { createElement } from 'react'
import { AppPage, createStore, network } from '../../../app/kit'
import { DomainEvent, QueryAnswer, createClient, createLive, createUseData } from '../lib/client'
import type { AppDomains } from '../core/domains'
import type { AppScheme } from '../core/scheme'
import type { AppViews } from '../core/views'

export const BASE_URL = '/api/v-0.4.1'

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
 * `x-worker-id`). Пересинхронизация мягкая: клиент забывает всё, смонтированные страницы перезапрашивают своё.
 */
export const client = createClient<AppScheme, AppDomains, AppViews>({
  transport: {
    query: (batch) => post<QueryAnswer>('data/query', batch),
    call: ({ domain, method, params }) => post<DomainEvent>(`domains/${domain}/${method}`, params)
  },
  onResync: (reason) => {
    session.set({ resync: reason })
  }
})

/**
 * Объект данных, значения представлений и вызовы операций: промис вызова разрешается, когда событие применено у
 * клиента.
 */
export const { db, views, DomainsAPI } = client

/** Обёртка компонентов, которые читают данные; умолчания — заглушка и вид ошибки страницы kit. */
export const live = createLive(client, {
  fallback: createElement(AppPage.Loading),
  error: ({ retry }) => createElement(AppPage.Failed, { onRetry: retry })
})

/** Мост для кода, который вызывают чужие компоненты: `useOptions` полей formkit. */
export const useData = createUseData(client)
