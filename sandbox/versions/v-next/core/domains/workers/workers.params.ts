import { z } from 'zod'
import { schemaOf } from '../../../lib/scheme'
import { WorkerEntities } from '../../scheme'

export namespace WorkersParams {
  const WorkerId = schemaOf(WorkerEntities.BaseWorker).pick({ workerId: true })

  // гражданство может быть не указано: `schemaOf` даёт ссылке тип без `null`
  const Citizenship = z.string().nullable()

  export const CreateOffice = schemaOf(WorkerEntities.OfficeProfile)
    .pick({ name: true, contacts: true, positions: true, regionIds: true })
    .extend({ citizenshipId: Citizenship })

  export const CreateRevisor = schemaOf(WorkerEntities.RevisorProfile)
    .pick({ name: true, contacts: true, category: true, regionIds: true })
    .extend({ citizenshipId: Citizenship })

  export const Rename = WorkerId.extend({ name: z.string().nonempty() })
  export const Fire = WorkerId
}
