interface PanelProps {
  title: string
  hint?: React.ReactNode
  /** Действия у заголовка — справа. */
  aside?: React.ReactNode
  children: React.ReactNode
}

/** Колонка экрана: заголовок, пояснение и содержимое; прокрутку содержимое задаёт само (`.panel-scroll`). */
export const Panel = ({ title, hint, aside, children }: PanelProps) => {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">{title}</h2>
        {aside && <div className="panel-aside">{aside}</div>}
      </div>
      {hint && <p className="panel-hint">{hint}</p>}
      <div className="panel-content">{children}</div>
    </section>
  )
}
