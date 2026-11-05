/**
 * Старт без снимка: только поток событий. Пока он не открыт, приложение не рисуется — иначе ответ на первый пакет мог бы
 * прийти раньше потока, и события между ними клиент бы пропустил. Дальше страницы сами догружают то, что читают; первое
 * сообщение — ответ или событие — запускает очередь событий клиента. Поток идёт через `network` kit — его видит Networks.
 */
import { network } from '../../../app/kit'
import { DomainEvent } from '../lib/client'
import { BASE_URL, client, session } from './data'

const connection = { stream: null as EventSource | null, wasOpen: false }

/**
 * Поток событий: события — в клиент, команда сервера — мягкая пересинхронизация. Обрыв — состояние «нет связи»;
 * браузер переподключится сам, но события между обрывом и переподключением потеряны — после него клиент забывает всё
 * и перезапрашивает то, что читают страницы.
 */
export const connect = () => {
  if (connection.stream) {
    return
  }

  const stream = network.stream(`${BASE_URL}/events`, ['event', 'resync'])

  connection.stream = stream

  stream.onopen = () => {
    if (connection.wasOpen) {
      client.resync('поток событий переподключился')
    }

    connection.wasOpen = true
    session.set({ status: { kind: 'live' } })
  }

  stream.onerror = () => {
    session.set({ status: { kind: 'offline', reason: 'поток событий прервался' } })
  }

  stream.addEventListener('event', (message: MessageEvent<string>) => {
    client.push(JSON.parse(message.data) as DomainEvent)
  })

  stream.addEventListener('resync', (message: MessageEvent<string>) => {
    client.resync(`сервер: ${JSON.parse(message.data)}`)
  })
}

/** Сброс базы сервера: пустая база и посев заново; после него kit перезагружает страницу. */
export const resetBase = async () => {
  const response = await network.fetch(`${BASE_URL}/reset`, { method: 'POST' })

  if (!response.ok) {
    throw new Error(`Сброс базы не удался: ${response.status}`)
  }
}
