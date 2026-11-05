import { createCase } from '../tools'
import { mock } from '../..'

export const caseVIA = createCase('#VIA - Model scalar update properties', {
  execute: async (kit, dataSource) => {
    await kit.addRevisorWorker({ workerId: 19 })

    await dataSource.collections.worker.update(19, (draft) => {
      // update json field
      draft.avatar = {
        stage: 'assigned',
        meta: { type: 'document', extension: '', filename: '', originalname: '', size: 1 }
      }
      // update simple field
      draft.name = 'Updated Revisor 19'
      // update embedded
      draft.documents.passport_number = 'AB1234567'
      // update embedded
      draft.about.height = 20
    })
  },
  expectations: {
    tables: {},
    scheme: {
      worker: [
        mock.Revisor({
          workerId: 19,
          name: 'Updated Revisor 19',
          about: { height: 20 },
          avatar: {
            stage: 'assigned',
            meta: { type: 'document', extension: '', filename: '', originalname: '', size: 1 }
          },
          documents: {
            passport_number: 'AB1234567'
          }
        })
      ]
    }
  }
})
