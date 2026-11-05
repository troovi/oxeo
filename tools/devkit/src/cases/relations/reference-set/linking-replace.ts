import { createCase, createTableTest } from '../../tools'
import { mock } from '../../..'

export const caseRYU = createCase('#RYU - RefernceSet replace link', {
  execute: async (kit, dataSource) => {
    await kit.addRole({ value: 'role-1' })
    await kit.addRole({ value: 'role-2' })
    await kit.addRole({ value: 'role-3' })

    await kit.addOfficeWorker({
      workerId: 1,
      roles: ['role-1', 'role-2'] // ReferenceSet
    })

    await dataSource.collections.worker.update(1, (draft) => {
      if (draft.type === 'office') {
        draft.roles = ['role-3']
      }
    })
  },
  expectations: {
    tables: {
      ...createTableTest('worker', {
        column: (source) => source.discriminatorRefs!.office.roles,
        rows: [{ worker: 1, role: 'role-3' }]
      })
    },
    scheme: {
      role: [
        mock.Role({ value: 'role-1' }),
        mock.Role({ value: 'role-2' }),
        mock.Role({ value: 'role-3' })
      ],
      worker: [mock.Office({ workerId: 1, roles: ['role-3'] })]
    }
  }
})
