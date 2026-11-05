import { useMemo } from 'react'
import { useForm } from '@companix/formkit'
import { ActionFormOptions, InputForm, Label } from '../../../../app/kit'
import { DomainsAPI } from '../data'
import { EntityShortForms } from './shortcuts/entities.shortcuts'

/** `clients.create` — клиент с менеджером. */
export const useCreateClientForm = ({ run }: ActionFormOptions) => {
  const scheme = useMemo(() => {
    return [
      Label({ text: 'name', required: true })(
        InputForm('name', {
          placeholder: 'Название клиента',
          $rules: {
            required: true
          }
        })
      ),
      Label({ text: 'managerId', required: true })(EntityShortForms.WorkerSelect('managerId'))
    ]
  }, [])

  return useForm(scheme, {
    onSubmit: (values) => run(() => DomainsAPI.clients.create(values))
  })
}
