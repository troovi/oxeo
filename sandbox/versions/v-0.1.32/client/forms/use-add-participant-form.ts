import { useMemo } from 'react'
import { useForm } from '@companix/formkit'
import { ActionFormOptions, Label, SelectForm } from '../../../../app/kit'
import { AppKey, AppKeys } from '../../core/keys'
import { DomainsAPI } from '../data'
import { EntityShortForms } from './shortcuts/entities.shortcuts'

/** `shifts.addParticipant` — сотрудник в состав смены в наборе, с ролью. */
export const useAddParticipantForm = ({ run }: ActionFormOptions) => {
  const scheme = useMemo(() => {
    return [
      Label({ text: 'shiftId', required: true })(EntityShortForms.ShiftSelect('shiftId')),
      Label({ text: 'workerId', required: true })(EntityShortForms.WorkerSelect('workerId')),
      Label({ text: 'role', required: true })(
        SelectForm<AppKey.Role>()('role', {
          placeholder: 'Выберите роль',
          options: AppKeys.Role.map((role) => ({ value: role, title: role })),
          $rules: {
            required: true
          }
        })
      )
    ]
  }, [])

  return useForm(scheme, {
    onSubmit: (values) => run(() => DomainsAPI.shifts.addParticipant(values))
  })
}
