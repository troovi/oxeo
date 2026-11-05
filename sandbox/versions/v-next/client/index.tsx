import { useEffect } from 'react'
import { DomainsPanel, NetworkEntry, NetworkPanel, SandboxScreen, StatusBanner } from '../../../app/kit'
import { DomainEvent, QueryBatch } from '../lib/client'
import { App } from './App'
import { connect, resetBase } from './connect'
import { session } from './data'
import { domainForms } from './forms'

/**
 * Экран версии на каркасе kit: слева дашборд — операции доменов по формам версии и Networks, справа — приложение
 * версии на react-router. Пока поток событий не открыт, приложение не рисуется; связь прервалась — плашка под шапкой.
 */
export const Screen = () => {
  const status = session.useStore((state) => state.status)

  useEffect(() => {
    connect()
  }, [])

  if (status.kind === 'connecting') {
    return <SandboxScreen.Message>Подключение к потоку событий…</SandboxScreen.Message>
  }

  return (
    <SandboxScreen
      version="v-next"
      onReset={resetBase}
      banner={
        status.kind === 'offline' && (
          <StatusBanner>
            Нет связи с сервером: {status.reason}. После переподключения клиент перезапросит то, что
            читают страницы.
          </StatusBanner>
        )
      }
      domains={<DomainsPanel groups={domainForms} />}
      network={<NetworkPanel summary={summaryOf} />}
      app={<App />}
    />
  )
}

/** Подпись записи Networks: событие журнала — ревизией и методом домена, пакет запросов — его запросами. */
const summaryOf = (entry: NetworkEntry) => {
  if (entry.kind === 'message' && entry.event === 'event') {
    const event = entry.data as DomainEvent

    return `#${event.revision} ${event.domain}.${event.method} · ${event.changes.length} зап.`
  }

  if (entry.kind === 'request' && entry.url.endsWith('/data/query')) {
    const batch = entry.body as QueryBatch
    const queries = batch.queries.map((query) => `${query.kind} ${query.collection}`)

    return `query · ${queries.join(', ')}`
  }

  return null
}
