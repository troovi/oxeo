import { useMemo } from 'react'
import { useForm } from '@companix/formkit'
import { ActionFormOptions, InputForm, Label } from '../../../../app/kit'
import { DomainsAPI } from '../data'
import { EntityShortForms } from './shortcuts/entities.shortcuts'

/** `projects.create` — проект клиента с кадровиками. */
export const useCreateProjectForm = ({ run }: ActionFormOptions) => {
  const scheme = useMemo(() => {
    return [
      Label({ text: 'clientId', required: true })(EntityShortForms.ClientSelect('clientId')),
      Label({ text: 'name', required: true })(
        InputForm('name', {
          placeholder: 'Название проекта',
          $rules: {
            required: true
          }
        })
      ),
      Label({ text: 'recruiterIds' })(EntityShortForms.WorkerTags('recruiterIds'))
    ]
  }, [])

  return useForm(scheme, {
    onSubmit: (values) => run(() => DomainsAPI.projects.create(values))
  })
}
