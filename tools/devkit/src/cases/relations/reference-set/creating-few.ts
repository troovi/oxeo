import { createDualCase, createTableTest } from '../../tools'
import { mock } from '../../..'

export const caseWIO = createDualCase('#WIO - ReferenceSet few', ['creating', 'updating'], {
  execute: async (kit, dataSource, marker) => {
    // create role
    await kit.addRole({ value: 'role-1' })
    await kit.addRole({ value: 'role-2' })
    await kit.addRole({ value: 'role-3' })

    if (marker === 'creating') {
      await kit.addOfficeWorker({
        workerId: 1,
        roles: ['role-1', 'role-2', 'role-3'] // ReferenceSet
      })

      await kit.addOfficeWorker({
        workerId: 2,
        roles: ['role-3'] // ReferenceSet
      })
    }

    if (marker === 'updating') {
      await kit.addOfficeWorker({
        workerId: 1
      })

      await kit.addOfficeWorker({
        workerId: 2
      })

      await dataSource.collections.worker.update(1, (draft) => {
        if (draft.type === 'office') {
          draft.roles.push('role-1')
          draft.roles.push('role-2')
          draft.roles.push('role-3')
        }
      })

      await dataSource.collections.worker.update(2, (draft) => {
        if (draft.type === 'office') {
          draft.roles.push('role-3')
        }
      })
    }
  },
  expectations: {
    tables: {
      ...createTableTest('worker', {
        column: (source) => source.discriminatorRefs!.office.roles,
        rows: [
          { worker: 1, role: 'role-1' },
          { worker: 1, role: 'role-2' },
          { worker: 1, role: 'role-3' },
          { worker: 2, role: 'role-3' }
        ]
      })
    },
    scheme: {
      role: [
        mock.Role({ value: 'role-1' }),
        mock.Role({ value: 'role-2' }),
        mock.Role({ value: 'role-3' })
      ],
      worker: [
        mock.Office({ workerId: 1, roles: ['role-1', 'role-2', 'role-3'] }),
        mock.Office({ workerId: 2, roles: ['role-3'] })
      ]
    }
  }
})
