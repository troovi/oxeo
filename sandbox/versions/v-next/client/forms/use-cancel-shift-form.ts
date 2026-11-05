import { useMemo } from 'react'
import { useForm } from '@companix/formkit'
import { ActionFormOptions, InputForm, Label } from '../../../../app/kit'
import { DomainsAPI } from '../data'
import { EntityShortForms } from './shortcuts/entities.shortcuts'

/** `shifts.cancel` — отмена смены с причиной до завершения. */
export const useCancelShiftForm = ({ run }: ActionFormOptions) => {
  const scheme = useMemo(() => {
    return [
      Label({ text: 'shiftId', required: true })(EntityShortForms.ShiftSelect('shiftId')),
      Label({ text: 'reason', required: true })(
        InputForm('reason', {
          placeholder: 'Причина отмены',
          $rules: {
            required: true
          }
        })
      )
    ]
  }, [])

  return useForm(scheme, {
    onSubmit: (values) => run(() => DomainsAPI.shifts.cancel(values))
  })
}
