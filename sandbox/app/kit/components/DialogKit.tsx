import { faXmark } from '@companix/icons-solid'
import { Dialog, Icon } from '@companix/uikit'

/** Прокручиваемое тело окна uikit между `DialogKit.Header` и `DialogKit.Footer`. */
export const DialogKit = ({ children }: { children: React.ReactNode }) => {
  return <div className="dialog-kit-body">{children}</div>
}

/** Шапка окна: заголовок в строку и крестик, который закрывает окно uikit. */
const DialogKitHeader = ({ title }: { title: React.ReactNode }) => {
  return (
    <div className="dialog-kit-header">
      <h3 className="dialog-kit-title">{title}</h3>
      <Dialog.Close asChild>
        <button type="button" className="dialog-kit-close" aria-label="Закрыть">
          <Icon icon={faXmark} size="xxs" />
        </button>
      </Dialog.Close>
    </div>
  )
}

/** Подвал окна: кнопки справа. */
const DialogKitFooter = ({ children }: { children: React.ReactNode }) => {
  return <div className="dialog-kit-footer">{children}</div>
}

DialogKit.Header = DialogKitHeader
DialogKit.Footer = DialogKitFooter
