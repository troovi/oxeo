import { useMemo } from 'react'
import { useForm } from '@companix/formkit'
import { ActionFormOptions, Label } from '../../../../app/kit'
import { DomainsAPI } from '../data'
import { EntityShortForms } from './shortcuts/entities.shortcuts'

/** `dictionary.removeOption` — удаление значения; схема снимает его с сотрудников. */
export const useRemoveOptionForm = ({ run }: ActionFormOptions) => {
  const scheme = useMemo(() => {
    return [Label({ text: 'value', required: true })(EntityShortForms.OptionSelect('value'))]
  }, [])

  return useForm(scheme, {
    onSubmit: (values) => run(() => DomainsAPI.dictionary.removeOption(values))
  })
}
