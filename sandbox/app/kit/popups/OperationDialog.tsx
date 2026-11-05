import { FormLayout } from '@companix/formkit'
import { Button, DialogShell, LoadingButton, PopupProps } from '@companix/uikit'
import { DialogKit } from '../components/DialogKit'
import { format } from '../format'
import { toaster } from '../toaster'
import { DomainAction } from '../types'

export interface OperationData {
  domain: string
  action: DomainAction
}

/**
 * Окно действия домена: форма — хук действия версии, «Выполнить» — её отправка. Вызов операции форма
 * оборачивает в `run`: успех — тост с результатом и закрытие окна, отказ — тост, окно остаётся для правки.
 */
export const OperationDialog = ({ data, close }: PopupProps<OperationData>) => {
  const { domain, action } = data

  const form = action.useForm({
    run: async (call) => {
      try {
        const result = await call()
        const answer = result === undefined ? '' : `: ${format.value(result)}`

        toaster.success(`${domain}.${action.name} — готово${answer}`)
        close()
      } catch (error) {
        toaster.danger(error instanceof Error ? error.message : String(error))
      }
    }
  })

  const handleRun = async (start: () => void) => {
    start()
    await form.handleSubmit()
  }

  return (
    <DialogShell size="m">
      <DialogKit.Header title={`${domain}.${action.name}`} />
      <DialogKit>
        <div className="form-layout">
          <FormLayout manager={form.manager} />
        </div>
      </DialogKit>
      <DialogKit.Footer>
        <Button mode="outline" onClick={close}>
          Закрыть
        </Button>
        <LoadingButton appearance="primary" onClick={handleRun}>
          Выполнить
        </LoadingButton>
      </DialogKit.Footer>
    </DialogShell>
  )
}
