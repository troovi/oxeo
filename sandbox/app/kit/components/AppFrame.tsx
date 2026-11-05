import { NavLink } from 'react-router'

export interface AppNavItem {
  /** Путь раздела внутри приложения — без префикса версии (его добавляет `basename` роутера). */
  to: string
  title: string
}

interface AppFrameProps {
  nav: AppNavItem[]
  children: React.ReactNode
}

/**
 * Окно приложения версии: строка разделов и прокручиваемая страница. Раздел подсвечен и на своих записях
 * (`/workers/12` — «Сотрудники»); корень — только сам.
 */
export const AppFrame = ({ nav, children }: AppFrameProps) => {
  return (
    <div className="app-frame">
      <nav className="app-frame-nav">
        <span className="app-frame-title">App</span>
        {nav.map((item) => (
          <NavLink key={`nav-${item.to}`} className="app-frame-link" to={item.to} end={item.to === '/'}>
            {item.title}
          </NavLink>
        ))}
      </nav>
      <div className="app-frame-content">{children}</div>
    </div>
  )
}
