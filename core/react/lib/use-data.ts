/**
 * Мост для кода, который вызывают чужие компоненты: `useOptions` поля formkit, колбэки списков uikit. Хозяин такого кода
 * не в обёртке `observer`, поэтому чтение идёт через хук.
 */
import { useEffect, useState } from 'react'
import { BindingClient, useTracker } from './use-tracker'

/**
 * Хук-мост: функция выполняется со своим сборщиком в компоненте-хозяине — хозяин подписывается на прочитанное,
 * недостающее догружается после рендера. Заглушку рисовать негде, поэтому вместо неё `isLoading`; пока он истинен,
 * `value` — то, что функция вернула над пустыми чтениями. Отказ пакета после повторов — `isLoading` ложно, а `value`
 * пустое: вид ошибки — забота хозяина, у селекта это пустой список.
 *
 * ```ts
 * export const useData = createUseData(client)
 *
 * const { value: workers, isLoading } = useData(() => data.worker.all())
 * ```
 */
export const createUseData = (client: BindingClient) => {
  return <R>(read: () => R) => {
    const tracker = useTracker(client)
    const [, setFailures] = useState(0)

    const value = tracker.run(read)
    const needs = [...tracker.needs.values()]

    useEffect(() => {
      if (needs.length > 0) {
        client.request(needs).catch(() => setFailures((count) => count + 1))
      }
    })

    return { value, isLoading: needs.length > 0 }
  }
}
