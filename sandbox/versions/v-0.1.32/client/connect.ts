/**
 * Старт — как в CRM: сначала поток событий (они копятся в очереди), затем снимок: `shell.load`
 * заполняет базу и запускает очередь с ревизии снимка, накопленное применяется. Поток и снимок идут
 * через `network` kit — их видит панель Networks.
 */
import { network } from '../../../app/kit'
import { DomainEvent, DomainsSnapshot } from '../lib'
import { BASE_URL, session, shell } from './data'

const connection = { stream: null as EventSource | null }

const openStream = () => {
  return new Promise<EventSource>((resolve, reject) => {
    const stream = network.stream(`${BASE_URL}/events`, ['event', 'resync'])

    stream.onopen = () => {
      // после открытия обрыв потока — разрыв ревизий: браузер переподключится, но события между
      // потеряны
      stream.onerror = () => {
        shell.sync.resync('поток событий прервался')
      }

      resolve(stream)
    }

    stream.onerror = () => {
      stream.close()
      reject(new Error('сервер песочницы не отвечает'))
    }

    stream.addEventListener('event', (message: MessageEvent<string>) => {
      shell.sync.push(JSON.parse(message.data) as DomainEvent)
    })

    stream.addEventListener('resync', (message: MessageEvent<string>) => {
      shell.sync.resync(`сервер: ${JSON.parse(message.data)}`)
    })
  })
}

export const connect = async () => {
  if (connection.stream) {
    return
  }

  connection.stream = await openStream()

  const response = await network.fetch(`${BASE_URL}/snapshot`)
  const snapshot: DomainsSnapshot = await response.json()

  shell.load(snapshot)
  session.set({ status: { kind: 'live' } })
}

/** Сброс базы сервера: пустая база и посев заново. Реплика после него начинает с перезагрузки страницы. */
export const resetBase = async () => {
  const response = await network.fetch(`${BASE_URL}/reset`, { method: 'POST' })

  if (!response.ok) {
    throw new Error(`Сброс базы не удался: ${response.status}`)
  }
}
