import { createCase, createTableTest } from '../../tools'
import { mock } from '../../..'

export const caseWZX = createCase('#WZX - ReferenceSet adding option link', {
  execute: async (kit, dataSource) => {
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

    // add worker

    await kit.addRevisorWorker({
      workerId: 1,
      about: {
        regions: ['option-1'] // ReferenceSet
      }
    })

    await kit.addRevisorWorker({
      workerId: 2
    })

    // add option to worker

    await dataSource.collections.worker.update(1, (draft) => {
      draft.about.regions.push('option-2')
    })

    await dataSource.collections.worker.update(2, (draft) => {
      draft.about.regions.push('option-1')
    })
  },
  expectations: {
    tables: {
      ...createTableTest('worker', {
        column: (source) => source.commonRefs['about.regions'],
        rows: [
          { worker: 1, options: 'option-1' },
          { worker: 1, options: 'option-2' },
          { worker: 2, options: 'option-1' }
        ]
      })
    },
    scheme: {
      options: [
        mock.Option({ value: 'option-1', dictionary: 'regions' }),
        mock.Option({ value: 'option-2', dictionary: 'regions' })
      ],
      dictionaries: [mock.Dictionary({ dictionary: 'regions', options: ['option-1', 'option-2'] })],
      worker: [
        mock.Revisor({ workerId: 1, about: { regions: ['option-1', 'option-2'] } }),
        mock.Revisor({ workerId: 2, about: { regions: ['option-1'] } })
      ]
    }
  }
})
