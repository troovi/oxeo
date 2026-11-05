import { createLayout } from '@companix/formkit'

/** Вложенный объект параметров: поля в рамке под подписью. */
export const Group = createLayout((title: React.ReactNode) => {
  return ({ children }) => {
    return (
      <div className="form-group-box">
        <div className="form-group-box-title">{title}</div>
        <div className="form-group-box-content">{children}</div>
      </div>
    )
  }
})
