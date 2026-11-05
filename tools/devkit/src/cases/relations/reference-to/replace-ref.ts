import { createCase, createTableTest } from '../../tools'
import { mock } from '../../..'

export const caseNIO = createCase('#NIO - ReferenceTo switch', {
  execute: async (kit, dataSource) => {
    await kit.addOfficeWorker({ workerId: 1 })
    await kit.addOfficeWorker({ workerId: 2 })

    await kit.addClient({
      clientId: 101,
      managerId: 1 // ReferenceTo
    })

    await dataSource.collections.client.update(101, (draft) => {
      draft.managerId = 2
    })
  },
  expectations: {
    tables: {
      ...createTableTest('client', {
        column: (source) => source.commonRefs.managerId,
        rows: [{ client: 101, worker: 2 }]
      })
    },
    scheme: {
      worker: [mock.Office({ workerId: 1 }), mock.Office({ workerId: 2 })],
      client: [mock.Client({ clientId: 101, managerId: 2 })]
    }
  }
})
