import { useMemo } from 'react'
import { useForm } from '@companix/formkit'
import { ActionFormOptions, Label } from '../../../../app/kit'
import { DomainsAPI } from '../data'
import { EntityShortForms } from './shortcuts/entities.shortcuts'

/** `shifts.withdraw` — снятие участника до завершения смены. */
export const useWithdrawParticipantForm = ({ run }: ActionFormOptions) => {
  const scheme = useMemo(() => {
    return [
      Label({ text: 'participantId', required: true })(
        EntityShortForms.ParticipantSelect('participantId')
      )
    ]
  }, [])

  return useForm(scheme, {
    onSubmit: (values) => run(() => DomainsAPI.shifts.withdraw(values))
  })
}
