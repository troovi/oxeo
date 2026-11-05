import { useMemo } from 'react'
import { useForm } from '@companix/formkit'
import { ActionFormOptions, InputForm, Label } from '../../../../app/kit'
import { DomainsAPI } from '../data'
import { EntityShortForms } from './shortcuts/entities.shortcuts'

/** `dictionary.renameOption` — новое название значения справочника. */
export const useRenameOptionForm = ({ run }: ActionFormOptions) => {
  const scheme = useMemo(() => {
    return [
      Label({ text: 'value', required: true })(EntityShortForms.OptionSelect('value')),
      Label({ text: 'title', required: true })(
        InputForm('title', {
          placeholder: 'Новое название',
          $rules: {
            required: true
          }
        })
      )
    ]
  }, [])

  return useForm(scheme, {
    onSubmit: (values) => run(() => DomainsAPI.dictionary.renameOption(values))
  })
}
