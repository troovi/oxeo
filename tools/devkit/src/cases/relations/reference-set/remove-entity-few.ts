import { createCase, createTableTest } from '../../tools'
import { mock } from '../../..'

export const caseMOR = createCase('#MOR - Remove option that used a lot of workers', {
  execute: async (kit, dataSource) => {
    await kit.addDictionary({ dictionary: 'regions' })

    await kit.addOption({ value: 'shanghai', dictionary: 'regions' })
    await kit.addOption({ value: 'moscow', dictionary: 'regions' })
    await kit.addOption({ value: 'hongkong', dictionary: 'regions' })
    await kit.addOption({ value: 'tokyo', dictionary: 'regions' })
    await kit.addOption({ value: 'singapore', dictionary: 'regions' })

    // create worker

    await kit.addRevisorWorker({
      workerId: 1,
      about: { regions: ['shanghai', 'singapore'] }
    })

    await kit.addRevisorWorker({
      workerId: 2,
      about: { regions: ['singapore'] }
    })

    await kit.addRevisorWorker({
      workerId: 3
    })

    await dataSource.collections.worker.update(1, (draft) => {
      draft.about.regions.push('moscow')
    })

    await dataSource.collections.worker.update(3, (draft) => {
      draft.about.regions.push('singapore')
      draft.about.regions.push('hongkong')
    })

    await dataSource.collections.options.remove('singapore')
  },
  expectations: {
    tables: {
      ...createTableTest('worker', {
        column: (source) => source.commonRefs['about.regions'],
        rows: [
          { worker: 1, options: 'shanghai' },
          { worker: 1, options: 'moscow' },
          { worker: 3, options: 'hongkong' }
        ]
      })
    },
    scheme: {
      dictionaries: [
        mock.Dictionary({
          dictionary: 'regions',
          options: ['shanghai', 'moscow', 'hongkong', 'tokyo']
        })
      ],
      options: [
        mock.Option({ value: 'shanghai', dictionary: 'regions' }),
        mock.Option({ value: 'moscow', dictionary: 'regions' }),
        mock.Option({ value: 'hongkong', dictionary: 'regions' }),
        mock.Option({ value: 'tokyo', dictionary: 'regions' })
      ],
      worker: [
        mock.Revisor({ workerId: 1, about: { regions: ['shanghai', 'moscow'] } }),
        mock.Revisor({ workerId: 2, about: { regions: [] } }),
        mock.Revisor({ workerId: 3, about: { regions: ['hongkong'] } })
      ]
    }
  }
})
