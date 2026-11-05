import { CoreError } from '@oxeo/server'
import { createCase, createTableTest } from '../../tools'
import { mock } from '../../..'

export const caseONO = createCase('#ONO - check not exists error (ReferenceTo) - creating', {
  execute: async (kit) => {
    await kit.addClient({
      clientId: 101,
      managerId: 99
    })
  },
  expectations: {
    tables: {},
    scheme: {},
    error: new CoreError('Worker', { reason: 'NOT_EXISTS', refId: 99 })
  }
})

export const caseOPX = createCase('#OPX - check not exists error (ReferenceTo) - updating', {
  execute: async (kit, dataSource) => {
    await kit.addOfficeWorker({ workerId: 1 })
    await kit.addClient({
      clientId: 102,
      managerId: 1
    })

    await dataSource.collections.client.update(102, (draft) => {
      draft.managerId = 99
    })
  },
  expectations: {
    tables: {
      ...createTableTest('client', {
        column: (source) => source.commonRefs.managerId,
        rows: [{ client: 102, worker: 1 }]
      })
    },
    scheme: {
      worker: [mock.Office({ workerId: 1 })],
      client: [mock.Client({ clientId: 102, managerId: 1 })]
    },
    error: new CoreError('Worker', { reason: 'NOT_EXISTS', refId: 99 })
  }
})
