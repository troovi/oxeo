import { useMemo } from 'react'
import { useForm } from '@companix/formkit'
import { ActionFormOptions, Label, SelectForm } from '../../../../app/kit'
import { AppKey, AppKeys } from '../../core/keys'
import { DomainsAPI } from '../data'
import { EntityShortForms } from './shortcuts/entities.shortcuts'

/** `shifts.setAttendance` — явка участника смены в наборе. */
export const useSetAttendanceForm = ({ run }: ActionFormOptions) => {
  const scheme = useMemo(() => {
    return [
      Label({ text: 'participantId', required: true })(
        EntityShortForms.ParticipantSelect('participantId')
      ),
      Label({ text: 'attendance', required: true })(
        SelectForm<AppKey.Attendance>()('attendance', {
          placeholder: 'Выберите явку',
          options: AppKeys.Attendance.map((attendance) => ({ value: attendance, title: attendance })),
          $rules: {
            required: true
          }
        })
      )
    ]
  }, [])

  return useForm(scheme, {
    onSubmit: (values) => run(() => DomainsAPI.shifts.setAttendance(values))
  })
}
