import { CoreError } from '@oxeo/server'
import { createCase } from '../../tools'
import { mock } from '../../..'

// дискриминатор нельзя менять через update — должен прилететь чистый CoreError, данные не меняются
export const caseCDU = createCase('#CDU - update cannot change discriminator', {
  execute: async (kit, dataSource) => {
    await kit.addOfficeWorker({ workerId: 1 })

    await dataSource.collections.worker.update(1, (worker) => {
      worker.type = 'revisor'
    })
  },
  expectations: {
    tables: {},
    scheme: {
      worker: [mock.Office({ workerId: 1 })]
    },
    error: new CoreError('Worker', {
      reason: 'RELATION_RESTRICT',
      address: 'type',
      info: 'discriminator-immutable'
    })
  }
})
