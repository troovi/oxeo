import { useSyncExternalStore } from 'react'

/**
 * Маленькое внешнее состояние экрана песочницы: `set` сливает патч, `useStore` подписывает компонент на
 * выборку.
 */
export const createStore = <T extends object>(initial: T) => {
  const listeners = new Set<() => void>()
  const current = { state: initial }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  }

  return {
    get: () => {
      return current.state
    },
    set: (patch: Partial<T>) => {
      current.state = { ...current.state, ...patch }
      listeners.forEach((listener) => listener())
    },
    useStore: <R>(select: (state: T) => R) => {
      return useSyncExternalStore(subscribe, () => select(current.state))
    }
  }
}
