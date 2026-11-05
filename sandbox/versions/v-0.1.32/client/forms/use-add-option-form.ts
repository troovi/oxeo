import { useMemo } from 'react'
import { useForm } from '@companix/formkit'
import { ActionFormOptions, InputForm, Label, SelectForm } from '../../../../app/kit'
import { AppKey, AppKeys } from '../../core/keys'
import { DomainsAPI } from '../data'

/** `dictionary.addOption` — новое значение справочника. */
export const useAddOptionForm = ({ run }: ActionFormOptions) => {
  const scheme = useMemo(() => {
    return [
      Label({ text: 'dictionary', required: true })(
        SelectForm<AppKey.Dictionary>()('dictionary', {
          placeholder: 'Выберите справочник',
          options: AppKeys.Dictionary.map((dictionary) => ({ value: dictionary, title: dictionary })),
          $rules: {
            required: true
          }
        })
      ),
      Label({ text: 'title', required: true })(
        InputForm('title', {
          placeholder: 'Название значения',
          $rules: {
            required: true
          }
        })
      )
    ]
  }, [])

  return useForm(scheme, {
    onSubmit: (values) => run(() => DomainsAPI.dictionary.addOption(values))
  })
}
