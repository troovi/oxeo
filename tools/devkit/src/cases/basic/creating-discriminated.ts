import { createCase, createTableTest } from '../tools'
import { mock } from '../..'

export const caseDWO = createCase('#DWO - Discriminated creating with relations', {
  execute: async (kit) => {
    await kit.addDictionary({ dictionary: 'regions' })
    await kit.addOption({
      value: 'option-1',
      dictionary: 'regions'
    })

    await kit.addRole({ value: 'role-1' })

    await kit.addOfficeWorker({
      workerId: 1,
      roles: ['role-1']
    })

    await kit.addRevisorWorker({
      workerId: 2,
      about: { regions: ['option-1'] }
    })
  },
  expectations: {
    tables: {
      ...createTableTest('worker', {
        column: (source) => source.discriminatorRefs!.office.roles,
        rows: [{ worker: 1, role: 'role-1' }]
      }),
      ...createTableTest('worker', {
        column: (source) => source.commonRefs['about.regions'],
        rows: [{ worker: 2, options: 'option-1' }]
      })
    },
    scheme: {
      dictionaries: [mock.Dictionary({ dictionary: 'regions', options: ['option-1'] })],
      options: [mock.Option({ value: 'option-1', dictionary: 'regions' })],
      role: [mock.Role({ value: 'role-1' })],
      worker: [
        mock.Office({ workerId: 1, roles: ['role-1'] }),
        mock.Revisor({ workerId: 2, about: { regions: ['option-1'] } })
      ]
    }
  }
})
