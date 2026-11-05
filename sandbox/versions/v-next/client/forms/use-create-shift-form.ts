import { useMemo } from 'react'
import { useForm } from '@companix/formkit'
import { ActionFormOptions, InputForm, Label, NumberInputForm } from '../../../../app/kit'
import { DomainsAPI } from '../data'
import { EntityShortForms } from './shortcuts/entities.shortcuts'

/** `shifts.create` — смена активного проекта: дата, план ревизоров и ставка. */
export const useCreateShiftForm = ({ run }: ActionFormOptions) => {
  const scheme = useMemo(() => {
    return [
      Label({ text: 'projectId', required: true })(EntityShortForms.ProjectSelect('projectId')),
      Label({ text: 'date', required: true })(
        InputForm('date', {
          placeholder: 'ГГГГ-ММ-ДД',
          $rules: {
            required: true
          }
        })
      ),
      Label({ text: 'plan', required: true })(
        NumberInputForm('plan', {
          placeholder: 'Ревизоров по плану',
          $rules: {
            required: true
          }
        })
      ),
      Label({ text: 'rate', required: true })(
        NumberInputForm('rate', {
          placeholder: 'Ставка ревизора, ₽',
          $rules: {
            required: true
          }
        })
      )
    ]
  }, [])

  return useForm(scheme, {
    onSubmit: (values) => run(() => DomainsAPI.shifts.create(values))
  })
}
