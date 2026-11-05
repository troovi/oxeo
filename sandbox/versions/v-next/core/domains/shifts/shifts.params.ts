import { z } from 'zod'
import { schemaOf } from '../../../lib/scheme'
import { AppKeys } from '../../keys'
import { ShiftEntities } from '../../scheme'

export namespace ShiftsParams {
  const ShiftId = schemaOf(ShiftEntities.Shift).pick({ shiftId: true })
  const ParticipantId = schemaOf(ShiftEntities.Participant).pick({
    participantId: true
  })

  export const Create = schemaOf(ShiftEntities.Shift).pick({
    projectId: true,
    date: true,
    plan: true,
    rate: true
  })

  export const LaunchRecruiting = ShiftId

  export const AddParticipant = ShiftId.extend(
    schemaOf(ShiftEntities.Participant).pick({ workerId: true, role: true }).shape
  )

  export const Withdraw = ParticipantId
  export const SetAttendance = ParticipantId.extend({
    attendance: z.enum(AppKeys.Attendance)
  })
  export const Complete = ShiftId
  export const Cancel = ShiftId.extend({ reason: z.string().nonempty() })
}
