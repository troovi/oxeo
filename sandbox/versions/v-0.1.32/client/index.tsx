import { useEffect } from 'react'
import { DomainsPanel, NetworkEntry, NetworkPanel, ResyncBanner, SandboxScreen } from '../../../app/kit'
import { DomainEvent } from '../lib'
import { App } from './App'
import { connect, resetBase } from './connect'
import { session } from './data'
import { domainForms } from './forms'

/**
 * Экран версии на каркасе kit: слева дашборд — операции доменов по формам версии и Networks, справа —
 * приложение версии на react-router. Реплика разошлась с сервером — плашка под шапкой.
 */
export const Screen = () => {
  const status = session.useStore((state) => state.status)

  useEffect(() => {
    connect().catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : String(error)

      session.set({ status: { kind: 'resync', reason } })
    })
  }, [])

  if (status.kind === 'connecting') {
    return <SandboxScreen.Message>Подключение к потоку и загрузка снимка…</SandboxScreen.Message>
  }

  return (
    <SandboxScreen
      version="v-0.1.32"
      onReset={resetBase}
      banner={status.kind === 'resync' && <ResyncBanner reason={status.reason} />}
      domains={<DomainsPanel groups={domainForms} />}
      network={<NetworkPanel summary={summaryOf} />}
      app={<App />}
    />
  )
}

/** Подпись записи Networks: событие журнала — ревизией и методом домена. */
const summaryOf = (entry: NetworkEntry) => {
  if (entry.kind === 'message' && entry.event === 'event') {
    const event = entry.data as DomainEvent

    return `#${event.revision} ${event.domain}.${event.method}`
  }

  return null
}
