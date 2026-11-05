/**
 * Обёртка `observer` — привязка клиента oxeo к React. Внутри у неё свои границы ошибок и Suspense, поэтому приложению их
 * расставлять не нужно: заглушка загрузки и вид ошибки — опции обёртки с умолчаниями, заданными один раз.
 */
import { Component, Suspense } from 'react'
import { BindingClient, useTracker } from './use-tracker'

export interface ObserverViews {
  /** Пока догружается то, что тело прочитало. */
  fallback: React.ReactNode
  /** Пакет не удался после повторов; `retry` отправляет непрошедшие запросы заново. */
  error: (props: { retry: () => void }) => React.ReactNode
}

/**
 * Обёртка с умолчаниями `fallback` и `error`; каждая обёртка может переопределить их своими.
 *
 * ```tsx
 * export const observer = createObserver(client, { fallback: <Spinner />, error: (props) => <LoadError {...props} /> })
 * export const WorkerPage = observer(() => { … }, { fallback: <AppPage.Loading /> })
 * ```
 */
export const createObserver = (client: BindingClient, defaults: ObserverViews) => {
  return <P extends object>(
    body: (props: P) => React.ReactNode,
    views: Partial<ObserverViews> = {}
  ) => {
    const fallback = 'fallback' in views ? views.fallback : defaults.fallback
    const error = views.error ?? defaults.error

    const Observed = (props: P) => {
      return (
        <LoadErrorBoundary client={client} render={error}>
          <Suspense fallback={fallback}>
            <Tracked client={client} body={body} props={props} />
          </Suspense>
        </LoadErrorBoundary>
      )
    }

    return Observed
  }
}

interface TrackedProps<P> {
  client: BindingClient
  body: (props: P) => React.ReactNode
  props: P
}

/**
 * Проход тела со сборщиком. Тело выполняется целиком: чтения, которым не хватило данных, отдают пустое и копят
 * потребности. После прохода:
 *
 * - есть отказавшие запросы — `LoadError` в границу ошибок обёртки;
 * - есть потребности — промис пакета: граница Suspense покажет `fallback` и повторит проход, когда пакет придёт. Ошибку
 *   тела на пустых данных этот проход проглатывает — его результат и так выбрасывается;
 * - потребностей нет, а тело упало — настоящая ошибка, наверх;
 * - иначе — разметка тела.
 *
 * Хуки в теле — хуки этого компонента: каждый проход вызывает их все в том же порядке, а проход, бросивший промис,
 * React отбрасывает целиком, поэтому счёт хуков не расходится.
 */
const Tracked = <P,>({ client, body, props }: TrackedProps<P>) => {
  const tracker = useTracker(client)

  const pass = tracker.run(() => {
    try {
      return { output: body(props), isThrown: false, thrown: null as unknown }
    } catch (thrown) {
      return { output: null, isThrown: true, thrown }
    }
  })

  if (tracker.failures.size > 0) {
    throw new LoadError([...tracker.failures])
  }

  if (tracker.needs.size > 0) {
    throw client.request([...tracker.needs.values()])
  }

  if (pass.isThrown) {
    throw pass.thrown
  }

  return <>{pass.output}</>
}

/** Пакет не удался после повторов: ключи запросов, которые надо повторить. */
class LoadError extends Error {
  constructor(readonly keys: string[]) {
    super('oxeo: загрузка не удалась')
    this.name = 'LoadError'
  }
}

interface LoadErrorBoundaryProps {
  client: BindingClient
  render: ObserverViews['error']
  children: React.ReactNode
}

interface LoadErrorBoundaryState {
  error: unknown
}

/**
 * Граница ошибок обёртки — класс, потому что React ловит ошибки рендера только так. Свой вид рисует только для
 * `LoadError`, другие ошибки бросает дальше. `retry` забывает отказ запросов в клиенте и рисует обёртку заново: проход
 * снова соберёт их как потребности.
 */
class LoadErrorBoundary extends Component<LoadErrorBoundaryProps, LoadErrorBoundaryState> {
  state: LoadErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): LoadErrorBoundaryState {
    return { error }
  }

  retry = () => {
    if (this.state.error instanceof LoadError) {
      this.props.client.forgetFailures(this.state.error.keys)
    }

    this.setState({ error: null })
  }

  render() {
    const { error } = this.state

    if (error === null) {
      return this.props.children
    }

    if (error instanceof LoadError) {
      return this.props.render({ retry: this.retry })
    }

    throw error
  }
}
