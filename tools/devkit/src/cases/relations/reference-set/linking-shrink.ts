import { createCase, createTableTest } from '../../tools'
import { mock } from '../../..'

export const caseSAO = createCase('#SAO - ReferenceSet unlink option', {
  execute: async (kit, dataSource) => {
    // add dictionary
    await kit.addDictionary({ dictionary: 'regions' })

    // add options
    await kit.addOption({
      value: 'option-1',
      dictionary: 'regions' // BelongsTo
    })
    await kit.addOption({
      value: 'option-2',
      dictionary: 'regions' // BelongsTo
    })

    // worker
    await kit.addRevisorWorker({
      workerId: 23,
      about: {
        regions: ['option-1', 'option-2'] // ReferenceSet
      }
    })

    // remove option-1 from worker
    await dataSource.collections.worker.update(23, (draft) => {
      draft.about.regions = ['option-2']
    })
  },
  expectations: {
    tables: {
      ...createTableTest('worker', {
        column: (source) => source.commonRefs['about.regions'],
        rows: [{ worker: 23, options: 'option-2' }]
      })
    },
    scheme: {
      options: [
        mock.Option({ value: 'option-1', dictionary: 'regions' }),
        mock.Option({ value: 'option-2', dictionary: 'regions' })
      ],
      dictionaries: [
        mock.Dictionary({
          dictionary: 'regions',
          options: ['option-1', 'option-2']
        })
      ],
      worker: [
        mock.Revisor({
          workerId: 23,
          about: { regions: ['option-2'] }
        })
      ]
    }
  }
})
