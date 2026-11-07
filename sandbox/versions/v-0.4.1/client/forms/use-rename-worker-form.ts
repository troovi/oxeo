import { useMemo } from 'react'
import { useForm } from '@companix/formkit'
import { ActionFormOptions, InputForm, Label } from '../../../../app/kit'
import { DomainsAPI } from '../data'
import { EntityShortForms } from './shortcuts/entities.shortcuts'

/** `workers.rename` — новое имя сотрудника. */
export const useRenameWorkerForm = ({ run }: ActionFormOptions) => {
  const scheme = useMemo(() => {
    return [
      Label({ text: 'workerId', required: true })(EntityShortForms.WorkerSelect('workerId')),
      Label({ text: 'name', required: true })(
        InputForm('name', {
          placeholder: 'Новое имя',
          $rules: {
            required: true
          }
        })
      )
    ]
  }, [])

  return useForm(scheme, {
    onSubmit: (values) => run(() => DomainsAPI.workers.rename(values))
  })
}
