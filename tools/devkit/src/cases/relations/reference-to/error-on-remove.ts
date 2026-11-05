import { CoreError } from '@oxeo/server'
import { createCase, createTableTest } from '../../tools'
import { mock } from '../../..'

export const caseKJI = createCase('#KJI - Unable to remove ReferenceTo target', {
  execute: async (kit, dataSource) => {
    await kit.addOfficeWorker({ workerId: 1 })
    await kit.addClient({
      clientId: 101,
      managerId: 1 // ReferenceTo
    })

    await dataSource.collections.worker.remove(1)
  },
  expectations: {
    tables: {
      ...createTableTest('client', {
        column: (source) => source.commonRefs.managerId,
        rows: [{ client: 101, worker: 1 }]
      })
    },
    scheme: {
      worker: [mock.Office({ workerId: 1 })],
      client: [mock.Client({ clientId: 101, managerId: 1 })]
    },
    error: new CoreError('Worker', {
      reason: 'DEPENDENCY_RESTRICT',
      model: 'Client'
    })
  }
})
