import { createCase, createTableTest } from '../tools'
import { mock } from '../..'

export const caseXNI = createCase('#XNI - Discriminated updates', {
  execute: async (kit, dataSource) => {
    await kit.addDictionary({ dictionary: 'regions' })
    await kit.addOption({
      value: 'option-1',
      dictionary: 'regions' // BelongsTo
    })

    // role
    await kit.addRole({ value: 'role-1' })

    // worker
    await kit.addOfficeWorker({ workerId: 1 })
    await kit.addRevisorWorker({ workerId: 2 })

    await dataSource.collections.worker.update(1, (w) => {
      if (w.type === 'office') {
        w.roles = ['role-1']
      }
    })

    await dataSource.collections.worker.update(2, (w) => {
      if (w.type === 'revisor') {
        w.job_type = 'self_employed'
        w.about.regions = ['option-1']
      }
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
        mock.Revisor({ workerId: 2, job_type: 'self_employed', about: { regions: ['option-1'] } })
      ]
    }
  }
})
