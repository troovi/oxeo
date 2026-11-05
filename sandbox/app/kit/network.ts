/**
 * Запись обменов клиента с сервером — то, что показывает панель Networks вместо вкладки Network браузера.
 * Версия ходит на сервер через `network.fetch` и открывает поток событий через `network.stream`: запрос
 * записывается с методом, адресом, заголовками и телом, затем — статус, ответ, вес и время; поток — открытием,
 * обрывом и каждым сообщением перечисленных событий. На странице одна версия, поэтому запись одна на страницу.
 */
import { createStore } from './store'

export namespace NetworkEntries {
  export interface Request {
    kind: 'request'
    id: number
    method: string
    url: string
    headers: { [name: string]: string }
    /** Тело запроса — разобранный JSON; `null` — без тела. */
    body: unknown
    at: number
    /** `null` — ответа ещё нет или запрос не дошёл. */
    status: number | null
    response: unknown
    bytes: number | null
    ms: number | null
    error: string | null
  }

  export interface Message {
    kind: 'message'
    id: number
    url: string
    /** Имя события потока; `open` и `error` — открытие и обрыв самого потока. */
    event: string
    data: unknown
    bytes: number
    at: number
  }
}

export type NetworkEntry = NetworkEntries.Request | NetworkEntries.Message

const ENTRIES_LIMIT = 300

const store = createStore({ entries: [] as NetworkEntry[] })
const sequence = { id: 0 }

/** Текст — разобранным JSON, если он JSON; иначе как есть. */
const parse = (text: string) => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

const add = (entry: NetworkEntry) => {
  store.set({ entries: [entry, ...store.get().entries].slice(0, ENTRIES_LIMIT) })
}

const patchRequest = (id: number, patch: Partial<NetworkEntries.Request>) => {
  const entries = store.get().entries.map((entry) => {
    return entry.kind === 'request' && entry.id === id ? { ...entry, ...patch } : entry
  })

  store.set({ entries })
}

export const network = {
  /** Записи — свежие первыми. */
  useEntries: () => {
    return store.useStore((state) => state.entries)
  },
  clear: () => {
    store.set({ entries: [] })
  },
  /** `fetch` с записью обмена; ответ отдаётся нетронутым — тело читается из копии. */
  fetch: async (url: string, init: RequestInit = {}) => {
    const id = ++sequence.id
    const started = performance.now()
    const body = typeof init.body === 'string' ? parse(init.body) : null

    add({
      kind: 'request',
      id,
      method: init.method ?? 'GET',
      url,
      headers: Object.fromEntries(new Headers(init.headers).entries()),
      body,
      at: Date.now(),
      status: null,
      response: null,
      bytes: null,
      ms: null,
      error: null
    })

    try {
      const response = await fetch(url, init)
      const text = await response.clone().text()

      patchRequest(id, {
        status: response.status,
        response: parse(text),
        bytes: new Blob([text]).size,
        ms: performance.now() - started
      })

      return response
    } catch (error) {
      patchRequest(id, {
        ms: performance.now() - started,
        error: error instanceof Error ? error.message : String(error)
      })

      throw error
    }
  },
  /**
   * `EventSource` с записью открытия, обрыва и сообщений событий `events`. Свои обработчики версия вешает
   * на возвращённый поток; запись идёт раньше них.
   */
  stream: (url: string, events: string[]) => {
    const source = new EventSource(url)

    const addLifecycle = (event: string) => {
      add({ kind: 'message', id: ++sequence.id, url, event, data: null, bytes: 0, at: Date.now() })
    }

    source.addEventListener('open', () => addLifecycle('open'))
    source.addEventListener('error', () => addLifecycle('error'))

    for (const event of events) {
      source.addEventListener(event, (message: MessageEvent<string>) => {
        add({
          kind: 'message',
          id: ++sequence.id,
          url,
          event,
          data: parse(message.data),
          bytes: new Blob([message.data]).size,
          at: Date.now()
        })
      })
    }

    return source
  }
}
