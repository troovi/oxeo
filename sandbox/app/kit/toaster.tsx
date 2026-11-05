import { faCircleCheck } from '@companix/icons-solid'
import { Icon, createToaster } from '@companix/uikit'

/** Тосты kit — как в CRM: сверху по центру; viewport рисует `SandboxScreen`. */
export const { Viewport: ToasterViewport, api: ToasterAPI } = createToaster({
  side: 'top',
  align: 'center',
  duration: 3000
})

export const toaster = {
  success: (description: string) => {
    ToasterAPI.show({ description, icon: <Icon icon={faCircleCheck} />, appearance: 'positive' })
  },
  danger: (description: string) => {
    ToasterAPI.show({ description, appearance: 'negative' })
  }
}
