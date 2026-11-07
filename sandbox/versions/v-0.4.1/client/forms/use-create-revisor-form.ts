import { useMemo } from 'react'
import { Context, useForm } from '@companix/formkit'
import { ActionFormOptions, Group, InputForm, Label, SelectForm } from '../../../../app/kit'
import { AppKey, AppKeys } from '../../core/keys'
import { DomainsAPI } from '../data'
import { EntityShortForms } from './shortcuts/entities.shortcuts'

/** `workers.createRevisor` — ревизор: имя, контакты, категория, регионы и гражданство. */
export const useCreateRevisorForm = ({ run }: ActionFormOptions) => {
  const scheme = useMemo(() => {
    return [
      Label({ text: 'name', required: true })(
        InputForm('name', {
          placeholder: 'Имя ревизора',
          $rules: {
            required: true
          }
        })
      ),
      Group('contacts')(
        Context('contacts')(
          Label({ text: 'phone' })(InputForm('phone', { placeholder: '+7 900 000-00-00' })),
          Label({ text: 'email' })(InputForm('email', { placeholder: 'name@example.com' }))
        )
      ),
      Label({ text: 'category', required: true })(
        SelectForm<AppKey.Category>()('category', {
          placeholder: 'Выберите категорию',
          options: AppKeys.Category.map((category) => ({ value: category, title: category })),
          $rules: {
            required: true
          }
        })
      ),
      Label({ text: 'regionIds' })(EntityShortForms.RegionTags('regionIds')),
      Label({ text: 'citizenshipId' })(EntityShortForms.CitizenshipSelect('citizenshipId'))
    ]
  }, [])

  return useForm(scheme, {
    onSubmit: (values) => run(() => DomainsAPI.workers.createRevisor(values))
  })
}
