import { createCase } from '../../tools'
import { mock } from '../../..'

export const caseLAN = createCase('#LAN - remove @BelongsTo entity and check cleanup @HasMany set', {
  execute: async (kit, dataSource) => {
    // create dictionary
    await kit.addDictionary({ dictionary: 'regions' })

    await kit.addOption({
      value: 'option-1',
      dictionary: 'regions' // BelongsTo
    })

    await kit.addRevisorWorker({
      workerId: 1,
      about: {
        regions: ['option-1'] // ReferenceSet
      }
    })

    await kit.addRevisorWorker({
      workerId: 2,
      about: {
        regions: ['option-1'] // ReferenceSet
      }
    })

    // remove option
    await dataSource.collections.options.remove('option-1')
  },
  expectations: {
    tables: {},
    scheme: {
      dictionaries: [mock.Dictionary({ dictionary: 'regions' })],
      options: [],
      worker: [mock.Revisor({ workerId: 1 }), mock.Revisor({ workerId: 2 })]
    }
  }
})
