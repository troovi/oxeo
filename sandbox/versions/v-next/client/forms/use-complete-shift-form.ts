import { useMemo } from 'react'
import { useForm } from '@companix/formkit'
import { ActionFormOptions, Label } from '../../../../app/kit'
import { DomainsAPI } from '../data'
import { EntityShortForms } from './shortcuts/entities.shortcuts'

/** `shifts.complete` — завершение смены с начислением участникам. */
export const useCompleteShiftForm = ({ run }: ActionFormOptions) => {
  const scheme = useMemo(() => {
    return [Label({ text: 'shiftId', required: true })(EntityShortForms.ShiftSelect('shiftId'))]
  }, [])

  return useForm(scheme, {
    onSubmit: (values) => run(() => DomainsAPI.shifts.complete(values))
  })
}
