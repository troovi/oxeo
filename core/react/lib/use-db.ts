/**
 * Привязка клиента oxeo к React — хук `useDb`. Чтение идёт только через него: `db` и значения представлений приходят
 * параметрами колбэка, поэтому прочитать мимо подписки нельзя. Компонент сам рисует своё состояние: заглушки и вида
 * ошибки у библиотеки нет.
 */
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { BindingClient, Read, Tracker } from '@oxeo/client'

export namespace DbStates {
  /** Полного результата ещё не было. */
  export interface Loading {
    stage: 'loading'
    data: undefined
  }

  /** Запрос отказал; `data` — последний полный результат, если он был. */
  export interface Failed<T> {
    stage: 'error'
    data: T | undefined
    /** Забыть отказ и запросить заново. */
    retry: () => void
  }

  /** `data` — последний полный результат; `isUpdating` — догружается новое, пока виден прежний. */
  export interface Success<T> {
    stage: 'success'
    data: T
    isUpdating: boolean
  }
}

export type DbState<T> = DbStates.Loading | DbStates.Failed<T> | DbStates.Success<T>

export interface UseDbOptions {
  /**
   * Разовое чтение: первый полный результат простыми записями без прокси, дальше хук не подписан. Для формы, которой нужна
   * запись на момент открытия: чтение полей через прокси подписало бы компонент на запись.
   */
  once?: boolean
}

/**
 * Хук чтения над клиентом приложения.
 *
 * Хук держит последний полный результат: пока догружается новое — смена фильтра, новая строка со ссылкой на незагруженную
 * запись, пересинхронизация, — стадия остаётся `success` с прежними данными и `isUpdating`. Другая запись — новый экземпляр
 * компонента (`key`): иначе до ответа виден прежний результат.
 *
 * ```tsx
 * export const useDb = createUseDb(client)
 *
 * const { data: worker } = useDb((db) => db.worker.get(workerId))
 * const { data: project } = useDb((db) => db.project.get(projectId), { once: true })
 * ```
 */
export const createUseDb = <Db, Views>(client: BindingClient<Db, Views>) => {
  return <R>(read: Read<Db, Views, R>, { once = false }: UseDbOptions = {}): DbState<R> => {
    const tracker = useTracker(client, once)

    const last = useRef<{ value: R } | null>(null)
    const [, rerender] = useState(0)

    const refresh = () => {
      rerender((count) => count + 1)
    }

    const pass = once && last.current ? null : tracker.run(read)

    if (pass && pass.isComplete) {
      last.current = { value: pass.value }
    }

    if (once && pass && pass.isComplete) {
      tracker.release()
    }

    const needs = [...tracker.needs.values()]
    const failures = [...tracker.failures.keys()]

    // след прохода действует с фиксации рендера: вызов, чей результат React выбросил, не отнимает у детей прежнего
    // рендера поля, которые они читают через прокси своего прохода
    useLayoutEffect(() => {
      if (pass) {
        tracker.commit(pass.trace)
      }
    })

    // новый монтаж запрашивает упавшее заново: иначе окно, открытое снова, осталось бы пустым до пересинхронизации
    useLayoutEffect(() => {
      if (failures.length > 0) {
        client.forgetFailures(failures)
        refresh()
      }
    }, [])

    useEffect(() => {
      if (needs.length > 0) {
        client.request(needs).catch(refresh)
      }
    })

    if (failures.length > 0) {
      const retry = () => {
        client.forgetFailures(failures)
        refresh()
      }

      return { stage: 'error', data: last.current?.value, retry }
    }

    if (last.current === null) {
      return { stage: 'loading', data: undefined }
    }

    return { stage: 'success', data: last.current.value, isUpdating: pass !== null && !pass.isComplete }
  }
}

/** Сборщик на весь срок жизни компонента: компонент перерисовывается только на изменения прочитанного проходом. */
const useTracker = <Db, Views>(client: BindingClient<Db, Views>, plain: boolean) => {
  const [tracker] = useState(() => client.createTracker({ plain }))
  const [{ subscribe, getSnapshot }] = useState(() => subscriptionOf(client, tracker))

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return tracker
}

/**
 * Подписка для `useSyncExternalStore`: снимок растёт только на изменения прочитанного проходом. React подписывается уже
 * после прохода, поэтому изменения между ними сверяются отдельно и перерисовывают компонент один раз.
 */
const subscriptionOf = <Db, Views>(client: BindingClient<Db, Views>, tracker: Tracker<Db, Views>) => {
  const snapshot = { version: 0 }

  return {
    subscribe: (onChange: () => void) => {
      const refresh = () => {
        snapshot.version += 1
        onChange()
      }

      const unsubscribe = client.subscribe((change) => {
        if (tracker.isAffected(change)) {
          refresh()
        }
      })

      if (tracker.hasMissedChanges()) {
        refresh()
      }

      return unsubscribe
    },
    getSnapshot: () => {
      return snapshot.version
    }
  }
}
