import { createCase, createTableTest } from '../../tools'
import { mock } from '../../..'

export const caseDMA = createCase('#DMA - ReferenceSet link/unlink', {
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
      about: {
        regions: ['shanghai', 'singapore'] // ReferenceSet
      }
    })

    await kit.addRevisorWorker({
      workerId: 2,
      about: {
        regions: ['singapore'] // ReferenceSet
      }
    })

    // добавляем опцию tokyo и удаляем singapore у worker id 1
    await dataSource.collections.worker.update(1, (draft) => {
      draft.about.regions.push('tokyo')

      const index = draft.about.regions.findIndex((item) => {
        return item === 'singapore'
      })

      if (index !== -1) {
        draft.about.regions.splice(index, 1)
      }
    })
  },
  expectations: {
    tables: {
      ...createTableTest('worker', {
        column: (source) => source.commonRefs['about.regions'],
        rows: [
          { worker: 1, options: 'shanghai' },
          { worker: 1, options: 'tokyo' },
          { worker: 2, options: 'singapore' }
        ]
      })
    },
    scheme: {
      dictionaries: [
        mock.Dictionary({
          dictionary: 'regions',
          options: ['shanghai', 'moscow', 'hongkong', 'tokyo', 'singapore']
        })
      ],
      options: [
        mock.Option({ value: 'shanghai', dictionary: 'regions' }),
        mock.Option({ value: 'moscow', dictionary: 'regions' }),
        mock.Option({ value: 'hongkong', dictionary: 'regions' }),
        mock.Option({ value: 'tokyo', dictionary: 'regions' }),
        mock.Option({ value: 'singapore', dictionary: 'regions' })
      ],
      worker: [
        mock.Revisor({ workerId: 1, about: { regions: ['shanghai', 'tokyo'] } }),
        mock.Revisor({ workerId: 2, about: { regions: ['singapore'] } })
      ]
    }
  }
})
