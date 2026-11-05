import { CoreError } from '@oxeo/server'
import { createCase, createTableTest } from '../../tools'
import { mock } from '../../..'

export const caseSIA = createCase('#SIA - ReferenceTo set-null creating', {
  execute: async (kit) => {
    await kit.addOfficeWorker({ workerId: 1 })
    await kit.addOfficeWorker({ workerId: 2 })

    await kit.addClient({
      clientId: 101,
      managerId: 1,
      subManagerId: 2
    })
  },
  expectations: {
    tables: {
      ...createTableTest('client', {
        column: (source) => source.commonRefs.managerId,
        rows: [{ client: 101, worker: 1 }]
      }),
      ...createTableTest('client', {
        column: (source) => source.commonRefs.subManagerId,
        rows: [{ client: 101, worker: 2 }]
      })
    },
    scheme: {
      worker: [mock.Office({ workerId: 1 }), mock.Office({ workerId: 2 })],
      client: [mock.Client({ clientId: 101, managerId: 1, subManagerId: 2 })]
    }
  }
})

export const caseSIB = createCase('#SIB - ReferenceTo set-null switch sub manager', {
  execute: async (kit, dataSource) => {
    await kit.addOfficeWorker({ workerId: 1 })
    await kit.addOfficeWorker({ workerId: 2 })
    await kit.addOfficeWorker({ workerId: 3 })

    await kit.addClient({
      clientId: 101,
      managerId: 1,
      subManagerId: 2
    })

    await dataSource.collections.client.update(101, (draft) => {
      draft.subManagerId = 3
    })
  },
  expectations: {
    tables: {
      ...createTableTest('client', {
        column: (source) => source.commonRefs.managerId,
        rows: [{ client: 101, worker: 1 }]
      }),
      ...createTableTest('client', {
        column: (source) => source.commonRefs.subManagerId,
        rows: [{ client: 101, worker: 3 }]
      })
    },
    scheme: {
      worker: [
        mock.Office({ workerId: 1 }),
        mock.Office({ workerId: 2 }),
        mock.Office({ workerId: 3 })
      ],
      client: [mock.Client({ clientId: 101, managerId: 1, subManagerId: 3 })]
    }
  }
})

export const caseUIA = createCase('#UIA - Remove set null sub-manager', {
  execute: async (kit, dataSource) => {
    await kit.addOfficeWorker({ workerId: 1 })
    await kit.addOfficeWorker({ workerId: 2 })

    await kit.addClient({
      clientId: 101,
      managerId: 1,
      subManagerId: 2
    })

    await dataSource.collections.client.update(101, (draft) => {
      draft.subManagerId = null
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
      worker: [mock.Office({ workerId: 1 }), mock.Office({ workerId: 2 })],
      client: [mock.Client({ clientId: 101, managerId: 1, subManagerId: null })]
    }
  }
})

export const caseSIC = createCase('#SIC - Remove sub manager and set client field to null', {
  execute: async (kit, dataSource) => {
    await kit.addOfficeWorker({ workerId: 1 })
    await kit.addOfficeWorker({ workerId: 2 })

    await kit.addClient({
      clientId: 101,
      managerId: 1,
      subManagerId: 2
    })

    await dataSource.collections.worker.remove(2)
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
      client: [mock.Client({ clientId: 101, managerId: 1, subManagerId: null })]
    }
  }
})

export const caseSID = createCase('#SID - Remove shared sub manager and null all consumers', {
  execute: async (kit, dataSource) => {
    await kit.addOfficeWorker({ workerId: 1 })
    await kit.addOfficeWorker({ workerId: 2 })
    await kit.addOfficeWorker({ workerId: 3 })

    await kit.addClient({
      clientId: 101,
      managerId: 1,
      subManagerId: 3
    })
    await kit.addClient({
      clientId: 102,
      managerId: 2,
      subManagerId: 3
    })

    await dataSource.collections.worker.remove(3)
  },
  expectations: {
    tables: {
      ...createTableTest('client', {
        column: (source) => source.commonRefs.managerId,
        rows: [
          { client: 101, worker: 1 },
          { client: 102, worker: 2 }
        ]
      })
    },
    scheme: {
      worker: [mock.Office({ workerId: 1 }), mock.Office({ workerId: 2 })],
      client: [
        mock.Client({ clientId: 101, managerId: 1, subManagerId: null }),
        mock.Client({ clientId: 102, managerId: 2, subManagerId: null })
      ]
    }
  }
})

export const caseSIE = createCase(
  '#SIE - Remove worker blocked by manager restrict before subManager set-null',
  {
    execute: async (kit, dataSource) => {
      await kit.addOfficeWorker({ workerId: 1 })
      await kit.addOfficeWorker({ workerId: 2 })

      await kit.addClient({
        clientId: 101,
        managerId: 1,
        subManagerId: 2
      })
      await kit.addClient({
        clientId: 102,
        managerId: 2
      })

      await dataSource.collections.worker.remove(2)
    },
    expectations: {
      tables: {
        ...createTableTest('client', {
          column: (source) => source.commonRefs.managerId,
          rows: [
            { client: 101, worker: 1 },
            { client: 102, worker: 2 }
          ]
        }),
        ...createTableTest('client', {
          column: (source) => source.commonRefs.subManagerId,
          rows: [{ client: 101, worker: 2 }]
        })
      },
      scheme: {
        worker: [mock.Office({ workerId: 1 }), mock.Office({ workerId: 2 })],
        client: [
          mock.Client({ clientId: 101, managerId: 1, subManagerId: 2 }),
          mock.Client({ clientId: 102, managerId: 2 })
        ]
      },
      error: new CoreError('Worker', {
        reason: 'DEPENDENCY_RESTRICT',
        model: 'Client'
      })
    }
  }
)
