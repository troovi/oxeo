import { useState } from 'react'
import { Button, Segments } from '@companix/uikit'
import { attr } from '@companix/utils-browser'
import { Badge } from '../components/Badge'
import { JsonBlock } from '../components/JsonBlock'
import { Panel } from '../components/Panel'
import { format } from '../format'
import { NetworkEntries, NetworkEntry, network } from '../network'

type Filter = 'all' | NetworkEntry['kind']

interface NetworkPanelProps {
  /**
   * Короткая подпись записи в строке списка — версия знает свой протокол (ревизия и метод события). Без
   * подписи строка показывает тело запроса или данные сообщения компактным JSON.
   */
  summary?: (entry: NetworkEntry) => string | null
}

/**
 * Networks — все обмены версии с сервером, как вкладка Network браузера: запросы (метод, адрес, параметры,
 * статус, ответ, вес, время) и сообщения потока событий. Свежие сверху, строка раскрывается подробностями.
 */
export const NetworkPanel = ({ summary }: NetworkPanelProps) => {
  const entries = network.useEntries()

  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<number | null>(null)

  const visible = filter === 'all' ? entries : entries.filter((entry) => entry.kind === filter)

  return (
    <Panel
      title="Networks"
      aside={
        <Button size="sm" mode="minimal" onClick={network.clear}>
          Очистить
        </Button>
      }
    >
      <div className="network-filter">
        <Segments
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `Все ${entries.length}` },
            { value: 'request', label: 'Запросы' },
            { value: 'message', label: 'Поток' }
          ]}
        />
      </div>
      <div className="panel-scroll network">
        {visible.length === 0 && <p className="panel-hint">Обменов пока нет.</p>}
        {visible.map((entry) => (
          <NetworkRow
            key={`entry-${entry.id}`}
            entry={entry}
            summary={summary?.(entry) ?? null}
            isOpen={openId === entry.id}
            onToggle={() => setOpenId(openId === entry.id ? null : entry.id)}
          />
        ))}
      </div>
    </Panel>
  )
}

interface NetworkRowProps {
  entry: NetworkEntry
  summary: string | null
  isOpen: boolean
  onToggle: () => void
}

const NetworkRow = ({ entry, summary, isOpen, onToggle }: NetworkRowProps) => {
  const time = new Date(entry.at).toLocaleTimeString('ru-RU')
  const preview = summary ?? previewOf(entry)

  return (
    <div className="network-entry" data-open={attr(isOpen)}>
      <button type="button" className="network-entry-head" onClick={onToggle}>
        <span className="network-entry-line">
          {entry.kind === 'request' ? <RequestHead entry={entry} /> : <MessageHead entry={entry} />}
          <span className="network-entry-time">{time}</span>
        </span>
        {preview && <span className="network-entry-preview">{preview}</span>}
      </button>
      {isOpen && <NetworkDetails entry={entry} />}
    </div>
  )
}

const RequestHead = ({ entry }: { entry: NetworkEntries.Request }) => {
  const isFailed = entry.error !== null || (entry.status !== null && entry.status >= 400)
  const status = entry.error ? 'сбой' : (entry.status ?? '…')

  return (
    <>
      <Badge tone="neutral">{entry.method}</Badge>
      <span className="network-entry-path">{pathOf(entry.url)}</span>
      <span className="network-entry-meta" data-failed={attr(isFailed)}>
        {status}
        {entry.bytes !== null && ` · ${format.bytes(entry.bytes)}`}
        {entry.ms !== null && ` · ${Math.round(entry.ms)} мс`}
      </span>
    </>
  )
}

const MessageHead = ({ entry }: { entry: NetworkEntries.Message }) => {
  return (
    <>
      <Badge tone={entry.event === 'error' ? 'negative' : 'primary'}>SSE</Badge>
      <span className="network-entry-path">{pathOf(entry.url)}</span>
      <span className="network-entry-meta">
        {entry.event} · {format.bytes(entry.bytes)}
      </span>
    </>
  )
}

const NetworkDetails = ({ entry }: { entry: NetworkEntry }) => {
  if (entry.kind === 'message') {
    return (
      <div className="network-details">
        <div className="network-details-title">Данные события «{entry.event}»</div>
        <JsonBlock value={entry.data} />
      </div>
    )
  }

  return <RequestDetails entry={entry} />
}

type RequestTab = 'params' | 'response' | 'headers'

/** Подробности запроса — как в DevTools: параметры, ответ и заголовки вкладками; сразу — то, что ушло. */
const RequestDetails = ({ entry }: { entry: NetworkEntries.Request }) => {
  const [tab, setTab] = useState<RequestTab>(entry.body === null ? 'response' : 'params')

  return (
    <div className="network-details">
      <div className="network-details-title">
        {entry.method} {entry.url}
      </div>
      <div className="network-details-tabs">
        <Segments
          value={tab}
          onChange={setTab}
          options={[
            { value: 'params', label: 'Параметры' },
            { value: 'response', label: `Ответ ${entry.status ?? ''}` },
            { value: 'headers', label: 'Заголовки' }
          ]}
        />
      </div>
      <RequestTabContent entry={entry} tab={tab} />
    </div>
  )
}

interface RequestTabContentProps {
  entry: NetworkEntries.Request
  tab: RequestTab
}

const RequestTabContent = ({ entry, tab }: RequestTabContentProps) => {
  if (tab === 'params' && entry.body === null) {
    return <div className="network-details-empty">Запрос без тела</div>
  }

  if (tab === 'params') {
    return <JsonBlock value={entry.body} />
  }

  if (tab === 'headers' && Object.keys(entry.headers).length === 0) {
    return <div className="network-details-empty">Своих заголовков нет</div>
  }

  if (tab === 'headers') {
    return <JsonBlock value={entry.headers} />
  }

  if (entry.error) {
    return <div className="network-details-error">{entry.error}</div>
  }

  return <JsonBlock value={entry.response} />
}

/** Адрес без префикса прокси и версии: `/api/<version>/domains/shifts/create` → `domains/shifts/create`. */
const pathOf = (url: string) => {
  return url.replace(/^\/api\/[^/]+\//, '')
}

/** Строка-превью: тело запроса или данные сообщения компактным JSON. */
const previewOf = (entry: NetworkEntry) => {
  const value = entry.kind === 'request' ? entry.body : entry.data

  return value === null ? null : format.value(value)
}
