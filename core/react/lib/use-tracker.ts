/**
 * Сборщик компонента и подписка React на него — общее для обёртки `observer` и моста `useData`. Сборщик и клиент о
 * React не знают: число для `useSyncExternalStore` живёт здесь.
 */
import { useState, useSyncExternalStore } from 'react'
import { Tracker } from '@oxeo/client'
import type { OxeoClient } from '@oxeo/client'

/** Клиент глазами привязки: загрузка потребностей прохода, отказы, подписка на изменения. */
export type BindingClient = Pick<OxeoClient, 'request' | 'forgetFailures' | 'subscribe'>

/** Сборщик на весь срок жизни компонента: компонент перерисовывается только на изменения прочитанного проходом. */
export const useTracker = (client: BindingClient) => {
  const [tracker] = useState(() => new Tracker())
  const [{ subscribe, getSnapshot }] = useState(() => subscriptionOf(client, tracker))

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return tracker
}

/**
 * Подписка для `useSyncExternalStore`: снимок растёт только на изменения прочитанного проходом. React подписывается уже
 * после прохода, поэтому изменения между ними сверяются отдельно и перерисовывают компонент один раз.
 */
const subscriptionOf = (client: BindingClient, tracker: Tracker) => {
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
