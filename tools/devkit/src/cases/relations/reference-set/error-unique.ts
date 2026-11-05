import { CoreError } from '@oxeo/server'
import { createCase, createTableTest } from '../../tools'
import { mock } from '../../..'

export const caseNOL = createCase('#NOL - check uniqe restrict error - creating', {
  execute: async (kit) => {
    await kit.addDictionary({ dictionary: 'regions' })
    await kit.addOption({ value: 'option-1', dictionary: 'regions' })
    await kit.addRevisorWorker({
      workerId: 1,
      about: { regions: ['option-1', 'option-1'] }
    })
  },
  expectations: {
    tables: {},
    scheme: {
      dictionaries: [mock.Dictionary({ dictionary: 'regions', options: ['option-1'] })],
      options: [mock.Option({ value: 'option-1', dictionary: 'regions' })]
    },
    error: new CoreError('Option', {
      reason: 'RELATION_RESTRICT',
      address: 'about.regions',
      info: 'unique'
    })
  }
})

export const caseUZO = createCase('#UZO - check uniqe restrict error - updating', {
  execute: async (kit, dataSource) => {
    await kit.addDictionary({ dictionary: 'regions' })
    await kit.addOption({ value: 'option-1', dictionary: 'regions' })

    await kit.addRevisorWorker({
      workerId: 1,
      about: { regions: ['option-1'] }
    })

    await dataSource.collections.worker.update(1, (draft) => {
      draft.about.regions.push('option-1')
    })
  },
  expectations: {
    tables: {
      ...createTableTest('worker', {
        column: (source) => source.commonRefs['about.regions'],
        rows: [{ worker: 1, options: 'option-1' }]
      })
    },
    scheme: {
      dictionaries: [mock.Dictionary({ dictionary: 'regions', options: ['option-1'] })],
      options: [mock.Option({ value: 'option-1', dictionary: 'regions' })],
      worker: [mock.Revisor({ workerId: 1, about: { regions: ['option-1'] } })]
    },
    error: new CoreError('Option', {
      reason: 'RELATION_RESTRICT',
      address: 'about.regions',
      info: 'unique'
    })
  }
})
