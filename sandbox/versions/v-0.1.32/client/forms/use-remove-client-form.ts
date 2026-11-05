import { useMemo } from 'react'
import { useForm } from '@companix/formkit'
import { ActionFormOptions, Label } from '../../../../app/kit'
import { DomainsAPI } from '../data'
import { EntityShortForms } from './shortcuts/entities.shortcuts'

/** `clients.remove` — удаление клиента; клиента с проектами остановит схема. */
export const useRemoveClientForm = ({ run }: ActionFormOptions) => {
  const scheme = useMemo(() => {
    return [Label({ text: 'clientId', required: true })(EntityShortForms.ClientSelect('clientId'))]
  }, [])

  return useForm(scheme, {
    onSubmit: (values) => run(() => DomainsAPI.clients.remove(values))
  })
}
