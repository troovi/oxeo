import { CoreError } from '@oxeo/server'
import { createCase } from '../../tools'
import { mock } from '../../..'

export const caseMWO = createCase('#MWO - check not exists error (ReferenceSet) - creating', {
  execute: async (kit) => {
    await kit.addRevisorWorker({
      workerId: 1,
      scans: ['scan-1'] // ReferenceSet (will be cause error)
    })
  },
  expectations: {
    tables: {},
    scheme: {},
    error: new CoreError('Scan', { reason: 'NOT_EXISTS', refId: 'scan-1' })
  }
})

export const caseAOX = createCase('#AOX - check not exists error (ReferenceSet) - updating', {
  execute: async (kit, dataSource) => {
    await kit.addRevisorWorker({ workerId: 1 })

    await dataSource.collections.worker.update(1, (draft) => {
      draft.scans.push('scan-1') // will be cause error
    })
  },
  expectations: {
    tables: {},
    scheme: {
      worker: [mock.Revisor({ workerId: 1 })]
    },
    error: new CoreError('Scan', { reason: 'NOT_EXISTS', refId: 'scan-1' })
  }
})
