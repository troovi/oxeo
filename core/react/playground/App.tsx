import { useEffect, useState } from 'react'
import { AppPlay } from './AppPlay'
import { bootstrap } from './bootstrap'

export const App = () => {
  const [initialized, setInitialize] = useState(false)

  useEffect(() => {
    if (!initialized) {
      bootstrap().then(() => {
        setInitialize(true)
      })
    }
  }, [initialized])

  if (initialized) {
    return <AppPlay />
  }

  return <div>Loading App</div>
}
