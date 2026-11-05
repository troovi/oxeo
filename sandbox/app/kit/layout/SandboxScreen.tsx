import { Popups } from '../popups'
import { ToasterViewport } from '../toaster'
import { SandboxHeader } from './SandboxHeader'

interface SandboxScreenProps {
  /** Ключ версии — в заголовке шапки. */
  version: string
  /** Сброс базы на сервере версии — кнопка шапки; после него страница перезагружается. */
  onReset: () => Promise<void>
  /** Плашка под шапкой — расхождение реплики с сервером. */
  banner?: React.ReactNode
  /** Операции доменов — первая колонка дашборда. */
  domains: React.ReactNode
  /** Обмены с сервером — вторая колонка дашборда. */
  network: React.ReactNode
  /** Клиентское приложение версии — правая половина экрана. */
  app: React.ReactNode
}

/**
 * Экран версии — один для всех версий: слева дашборд (шапка, под ней операции доменов и Networks), справа —
 * приложение версии; все блоки — карточки во всю высоту с одним отступом. Колонки прокручиваются сами. Окна и
 * тосты kit рисуются здесь, вне сетки экрана.
 */
export const SandboxScreen = (props: SandboxScreenProps) => {
  const { version, onReset, banner, domains, network, app } = props

  return (
    <>
      <div className="sandbox">
        <section className="sandbox-dashboard">
          <SandboxHeader version={version} onReset={onReset} />
          {banner}
          <div className="sandbox-dashboard-panels">
            {domains}
            {network}
          </div>
        </section>
        <section className="sandbox-app">{app}</section>
      </div>
      <Popups.Overlay />
      <ToasterViewport />
    </>
  )
}

/** Экран целиком занят одним состоянием — подключение, загрузка снимка. */
const SandboxScreenMessage = ({ children }: { children: React.ReactNode }) => {
  return <div className="sandbox-message">{children}</div>
}

SandboxScreen.Message = SandboxScreenMessage
