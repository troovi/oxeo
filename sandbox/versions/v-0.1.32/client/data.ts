/**
 * Слой данных клиента — как в CRM: локальная база на in-memory драйвере, хуки над ней, клиентская
 * оболочка xeo-toolkit (повтор событий, очередь, снимок) и API вызовов поверх `fetch`. Запросы идут через
 * `network` kit — их видит панель Networks. Рядом — состояние подключения.
 */
import { createStore, network } from '../../../app/kit'
import { DataSource, DomainsTransport, createBaseDriver, createClientShell } from '../lib'
import { createDataSourceHooks } from '../lib/react'
import { appDomains } from '../core/domains'
import { dataScheme } from '../core/scheme'

export const BASE_URL = '/api/v-0.1.32'

export const dataSource = new DataSource(dataScheme, {
  createDriver: createBaseDriver
})

export const { useAll, useEntity, useEntities, useFindBy } = createDataSourceHooks(dataSource)

export namespace ConnectionStatuses {
  export interface Connecting {
    kind: 'connecting'
  }

  export interface Live {
    kind: 'live'
  }

  export interface Resync {
    kind: 'resync'
    reason: string
  }
}

export type ConnectionStatus =
  ConnectionStatuses.Connecting | ConnectionStatuses.Live | ConnectionStatuses.Resync

export interface SessionState {
  status: ConnectionStatus
}

export const session = createStore<SessionState>({
  status: { kind: 'connecting' }
})

export const shell = createClientShell(appDomains, dataSource, {
  counterCollection: 'counter',
  resync: (reason) => {
    session.set({ status: { kind: 'resync', reason } })
  }
})

/** Вызовы доменов по HTTP от имени системы (без `x-worker-id`); отказ сервера — ошибка с его текстом. */
const transport: DomainsTransport = {
  request: async ({ url, body }) => {
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
}

/**
 * Промис разрешается, когда событие сервера применено локально, — после `await` хуки уже видят
 * изменения.
 */
export const DomainsAPI = shell.createApi(transport)
