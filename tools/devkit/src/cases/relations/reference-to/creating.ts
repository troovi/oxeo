import { createCase, createTableTest } from '../../tools'
import { mock } from '../../..'

export const caseRJO = createCase('#RJO - ReferenceTo creating', {
  execute: async (kit) => {
    await kit.addOfficeWorker({ workerId: 1 })

    await kit.addClient({
      clientId: 101,
      managerId: 1 // ReferenceTo
    })
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
    }
  }
})
