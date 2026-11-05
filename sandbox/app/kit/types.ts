import { FormManager } from '@companix/formkit'

/** Форма действия для окна kit: менеджер formkit для `FormLayout` и отправка — проверка полей и вызов. */
export interface ActionForm {
  manager: FormManager<any, any, any>
  handleSubmit: () => Promise<void>
}

export interface ActionFormOptions {
  /**
   * Вызов операции домена из отправки формы: успех — тост с результатом и закрытие окна, отказ — тост с
   * текстом ошибки, окно остаётся.
   */
  run: (call: () => Promise<unknown>) => Promise<void>
}

/** Действие домена на панели: имя метода — подпись кнопки и заголовок окна, хук — форма действия версии. */
export interface DomainAction {
  name: string
  useForm: (options: ActionFormOptions) => ActionForm
}

/** Домен — группа действий на панели операций. */
export interface DomainGroup {
  domain: string
  actions: DomainAction[]
}
