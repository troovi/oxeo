import { useMemo } from 'react'
import { useForm } from '@companix/formkit'
import { ActionFormOptions, Label } from '../../../../app/kit'
import { DomainsAPI } from '../data'
import { EntityShortForms } from './shortcuts/entities.shortcuts'

/** `shifts.launchRecruiting` — запуск набора у новой смены. */
export const useLaunchRecruitingForm = ({ run }: ActionFormOptions) => {
  const scheme = useMemo(() => {
    return [Label({ text: 'shiftId', required: true })(EntityShortForms.ShiftSelect('shiftId'))]
  }, [])

  return useForm(scheme, {
    onSubmit: (values) => run(() => DomainsAPI.shifts.launchRecruiting(values))
  })
}
