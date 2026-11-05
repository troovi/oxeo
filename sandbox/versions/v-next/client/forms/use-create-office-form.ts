import { useMemo } from 'react'
import { Context, useForm } from '@companix/formkit'
import { ActionFormOptions, Group, InputForm, Label, SelectTagsForm } from '../../../../app/kit'
import { AppKey, AppKeys } from '../../core/keys'
import { DomainsAPI } from '../data'
import { EntityShortForms } from './shortcuts/entities.shortcuts'

/** `workers.createOffice` — офисный сотрудник: имя, контакты, должности, регионы и гражданство. */
export const useCreateOfficeForm = ({ run }: ActionFormOptions) => {
  const scheme = useMemo(() => {
    return [
      Label({ text: 'name', required: true })(
        InputForm('name', {
          placeholder: 'Имя сотрудника',
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
      Label({ text: 'positions' })(
        SelectTagsForm<AppKey.Position>()('positions', {
          placeholder: 'Выберите должности',
          options: AppKeys.Position.map((position) => ({ value: position, title: position }))
        })
      ),
      Label({ text: 'regionIds' })(EntityShortForms.RegionTags('regionIds')),
      Label({ text: 'citizenshipId' })(EntityShortForms.CitizenshipSelect('citizenshipId'))
    ]
  }, [])

  return useForm(scheme, {
    onSubmit: (values) => run(() => DomainsAPI.workers.createOffice(values))
  })
}
