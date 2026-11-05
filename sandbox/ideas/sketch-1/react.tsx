// @ts-nocheck
/* eslint-disable */

// Привязка клиента к React — обёртка `observer`. Свои границы ошибок и Suspense у неё внутри, поэтому приложению их
// расставлять не нужно: заглушка загрузки и вид ошибки — опции обёртки с умолчаниями клиента

import { Component, Suspense, useEffect, useRef, useSyncExternalStore } from 'react'
import { Tracker, XeoClient } from './client'

export interface ObserverViews {
  /** Пока догружается то, что тело прочитало. */
  fallback: React.ReactNode
  /** Пакет не удался после повторов; `retry` отправляет непрошедшие запросы заново. */
  error: (props: { retry: () => void }) => React.ReactNode
}

/**
 * Обёртка с умолчаниями `fallback` и `error`, заданными один раз; каждая обёртка может переопределить их своими.
 *
 * ```tsx
 * export const observer = createObserver(client, { fallback: <Spinner />, error: (props) => <LoadError {...props} /> })
 * export const WorkerPage = observer(() => { … }, { fallback: <AppPage.Loading /> })
 * ```
 */
export const createObserver = (client: XeoClient, defaults: ObserverViews) => {
  return <P extends object>(body: (props: P) => React.ReactNode, views: Partial<ObserverViews> = {}) => {
    const fallback = views.fallback ?? defaults.fallback
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
  client: XeoClient
  body: (props: P) => React.ReactNode
  props: P
}

/**
 * Проход тела со сборщиком. Тело выполняется целиком: чтения, которым не хватило данных, отдают пустое и копят
 * потребности. После прохода:
 *
 * - есть потребности — бросить промис пакета: внутренняя граница Suspense покажет `fallback` и повторит проход, когда
 *   пакет придёт. Ошибку тела на пустых данных этот проход проглатывает — его результат и так выбрасывается;
 * - потребностей нет, но тело упало — настоящая ошибка, наверх;
 * - иначе — разметка тела.
 *
 * Хуки внутри тела — хуки этого компонента: каждый проход вызывает их все и в том же порядке, а проход, бросивший
 * промис, React отбрасывает целиком, поэтому счёт хуков не расходится.
 */
const Tracked = <P,>({ client, body, props }: TrackedProps<P>) => {
  const tracker = useRef(new Tracker()).current

  useSyncExternalStore(
    (onChange) => client.subscribe((change) => tracker.isAffected(change) && tracker.bump(onChange)),
    () => tracker.version
  )

  const pass = tracker.run(() => {
    try {
      return { output: body(props), thrown: null }
    } catch (thrown) {
      return { output: null, thrown }
    }
  })

  if (tracker.failures.size > 0) {
    throw new LoadError([...tracker.failures.keys()])
  }

  if (tracker.needs.size > 0) {
    throw client.request([...tracker.needs.values()])
  }

  if (pass.thrown !== null) {
    throw pass.thrown
  }

  return pass.output
}

/** Пакет не удался после повторов: ключи запросов, которые надо повторить. */
class LoadError extends Error {
  constructor(readonly keys: string[]) {
    super('xeo: загрузка не удалась')
  }
}

interface LoadErrorBoundaryProps {
  client: XeoClient
  render: ObserverViews['error']
  children: React.ReactNode
}

/**
 * Граница ошибок обёртки — класс, потому что React ловит ошибки рендера только так. Ловит только `LoadError`, другие
 * ошибки пропускает выше. `retry` забывает отказ этих запросов в клиенте и рисует обёртку заново: проход снова соберёт
 * их как потребности.
 */
class LoadErrorBoundary extends Component<LoadErrorBoundaryProps, { error: LoadError | null }> {
  state = { error: null }

  static getDerivedStateFromError(error: unknown) {
    if (error instanceof LoadError) {
      return { error }
    }

    throw error
  }

  retry = () => {
    this.props.client.forgetFailures(this.state.error.keys)
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return this.props.render({ retry: this.retry })
    }

    return this.props.children
  }
}

/**
 * Мост для кода, который вызывают чужие компоненты: `useOptions` поля formkit, колбэки списков uikit. Функция
 * выполняется со своим сборщиком в компоненте-хозяине — хозяин подписывается на прочитанное, недостающее догружается
 * после рендера. Заглушку рисовать негде, поэтому вместо неё `isLoading`; пока он истинен, `value` — то, что функция
 * вернула над пустыми чтениями. Отказ пакета после повторов — `isLoading` ложно, а `value` пустое: вид ошибки здесь —
 * забота хозяина, у селекта это пустой список.
 *
 * ```ts
 * const { value: workers, isLoading } = useData(() => data.worker.all())
 * ```
 */
export const createUseData = (client: XeoClient) => {
  return <R,>(read: () => R) => {
    const tracker = useRef(new Tracker()).current

    useSyncExternalStore(
      (onChange) => client.subscribe((change) => tracker.isAffected(change) && tracker.bump(onChange)),
      () => tracker.version
    )

    const value = tracker.run(read)
    const needs = [...tracker.needs.values()]

    useEffect(() => {
      if (needs.length > 0) {
        client.request(needs).catch(() => tracker.bump())
      }
    })

    return { value, isLoading: needs.length > 0 && tracker.failures.size === 0 }
  }
}

// Дополнения к ядру (`client.ts`), которых требует обёртка:
// - отказ пакета после повторов клиент помнит по ключам запросов; чтение в рендере, чей запрос отказал, кладёт ключ в
//   `tracker.failures`, а не в `tracker.needs` — иначе Suspense повторял бы проход и слал пакет без конца;
// - `client.forgetFailures(keys)` — забыть отказ перед повтором;
// - `tracker.version` и `tracker.bump(onChange)` — снимок для `useSyncExternalStore`: новое значение на каждое
//   изменение, которое касается прочитанного.
