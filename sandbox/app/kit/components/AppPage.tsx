import { Button, Segments } from '@companix/uikit'
import { Link, useLocation, useNavigate } from 'react-router'

interface AppPageProps {
  title: React.ReactNode
  /** Возврат к списку — ссылка над заголовком записи. */
  back?: { to: string; title: string }
  /** Справа от заголовка — число записей, состояние. */
  aside?: React.ReactNode
  children?: React.ReactNode
}

/** Страница приложения: заголовок (у записи — со ссылкой назад к списку) и содержимое столбцом. */
export const AppPage = ({ title, back, aside, children }: AppPageProps) => {
  return (
    <div className="app-page">
      {back && (
        <Link className="app-page-back" to={back.to}>
          ← {back.title}
        </Link>
      )}
      <div className="app-page-head">
        <h1 className="app-page-title">{title}</h1>
        {aside && <div className="app-page-aside">{aside}</div>}
      </div>
      {children}
    </div>
  )
}

/** Блок страницы записи — связанные записи под своим заголовком. */
const AppPageSection = ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => {
  return (
    <section className="app-page-section">
      <h2 className="app-page-section-title">{title}</h2>
      {children}
    </section>
  )
}

/** Страница одним состоянием — записи нет, страницы нет. */
const AppPageEmpty = ({ children }: { children: React.ReactNode }) => {
  return <div className="app-page-empty">{children}</div>
}

/** Загрузка — заглушка области, пока догружается то, что она читает. */
const AppPageLoading = ({ children }: { children?: React.ReactNode }) => {
  return <div className="app-page-empty">{children ?? 'Загрузка…'}</div>
}

/** Загрузка не удалась — текст и повтор. */
const AppPageFailed = ({ onRetry }: { onRetry: () => void }) => {
  return (
    <div className="app-page-empty app-page-failed">
      Не удалось загрузить данные
      <Button size="sm" appearance="neutral" onClick={onRetry}>
        Повторить
      </Button>
    </div>
  )
}

interface AppPageSegment {
  /** Путь сегмента внутри приложения — свой маршрут страницы. */
  to: string
  title: string
}

/**
 * Сегменты списка — маршруты страницы: выбран сегмент текущего адреса, выбор ведёт на его путь. Значение опции
 * — номер сегмента, а не путь: uikit строит из значения селектор `id`, и `/` его ломает.
 */
const AppPageSegments = ({ segments }: { segments: AppPageSegment[] }) => {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="app-page-segments">
      <Segments
        value={segments.findIndex((segment) => segment.to === location.pathname)}
        onChange={(i) => navigate(segments[i].to)}
        options={segments.map((segment, i) => ({ value: i, label: segment.title }))}
      />
    </div>
  )
}

AppPage.Section = AppPageSection
AppPage.Empty = AppPageEmpty
AppPage.Loading = AppPageLoading
AppPage.Failed = AppPageFailed
AppPage.Segments = AppPageSegments
