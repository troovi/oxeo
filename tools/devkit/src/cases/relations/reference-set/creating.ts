import { createDualCase, createTableTest } from '../../tools'
import { mock } from '../../..'

export const caseAIX = createDualCase('#AIX - ReferenceSet', ['creating', 'updating'], {
  execute: async (kit, dataSource, marker) => {
    // create role
    await kit.addRole({ value: 'role-1' })

    if (marker === 'creating') {
      await kit.addOfficeWorker({
        workerId: 1,
        roles: ['role-1'] // ReferenceSet
      })
    }

    if (marker === 'updating') {
      await kit.addOfficeWorker({
        workerId: 1
      })

      await dataSource.collections.worker.update(1, (draft) => {
        if (draft.type === 'office') {
          draft.roles.push('role-1')
        }
      })
    }
  },
  expectations: {
    tables: {
      ...createTableTest('worker', {
        column: (source) => source.discriminatorRefs!.office.roles,
        rows: [{ worker: 1, role: 'role-1' }]
      })
    },
    scheme: {
      role: [mock.Role({ value: 'role-1' })],
      worker: [mock.Office({ workerId: 1, roles: ['role-1'] })]
    }
  }
})
