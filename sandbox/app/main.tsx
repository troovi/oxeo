import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@companix/uikit'
import { Launcher } from './Launcher'
import { versions } from './versions'
import './styles/index.scss'

/**
 * Версия — первый сегмент адреса (`/v-0.1.32/workers/12`), дальше — маршруты её приложения; корень — список
 * версий. Тема одна — светлая.
 */
const key = window.location.pathname.split('/')[1]
const version = versions.find((item) => item.key === key)
const root = createRoot(document.getElementById('root')!)

const loadScreen = async () => {
  if (!version) {
    return Launcher
  }

  const { Screen } = await version.load()

  return Screen
}

const render = async () => {
  const Screen = await loadScreen()

  root.render(
    <ThemeProvider fixed defaultColorScheme="light">
      <Screen />
    </ThemeProvider>
  )
}

render()
