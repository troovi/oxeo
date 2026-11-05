import { LoadingButton } from '@companix/uikit'
import { toaster } from '../toaster'

interface SandboxHeaderProps {
  version: string
  /** Сброс базы на сервере версии; после него страница перезагружается — реплика начинает заново. */
  onReset: () => Promise<void>
}

/** Шапка экрана: имя версии со ссылкой на список версий и сброс базы. */
export const SandboxHeader = ({ version, onReset }: SandboxHeaderProps) => {
  const handleReset = async (start: () => void) => {
    start()

    try {
      await onReset()
      window.location.reload()
    } catch (error) {
      toaster.danger(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <header className="sandbox-header">
      <a className="sandbox-header-title" href="/">
        oxeo sandbox · {version}
      </a>
      <LoadingButton size="sm" appearance="neutral" onClick={handleReset}>
        Сбросить базу
      </LoadingButton>
    </header>
  )
}
