import { createCase } from '../tools'
import { mock } from '../..'
import { CoreError } from '@oxeo/server'

export const caseFIX = createCase('#FIX - check not exists error (Model) - updating', {
  execute: async (kit, dataSource) => {
    await dataSource.collections.worker.update(1, (draft) => {
      draft.name = 'Missing Worker'
    })
  },
  expectations: {
    tables: {},
    scheme: {},
    error: new CoreError('Worker', { reason: 'NOT_EXISTS', refId: 1 })
  }
})

export const caseJRO = createCase('#JRO - check not exists error (Model) - removing', {
  execute: async (kit, dataSource) => {
    await dataSource.collections.worker.remove(2)
  },
  expectations: {
    tables: {},
    scheme: {},
    error: new CoreError('Worker', { reason: 'NOT_EXISTS', refId: 2 })
  }
})

export const caseKRO = createCase('#KRO - check duplicate model create error', {
  execute: async (kit) => {
    await kit.addOfficeWorker({ workerId: 1 })
    await kit.addOfficeWorker({ workerId: 1 })
  },
  expectations: {
    tables: {},
    scheme: {
      worker: [mock.Office({ workerId: 1 })]
    },
    error: new CoreError('Worker', { reason: 'EXISTS', id: 1 })
  }
})
