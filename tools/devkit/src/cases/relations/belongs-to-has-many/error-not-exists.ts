import { CoreError } from '@oxeo/server'
import { createCase } from '../../tools'
import { mock } from '../../..'

export const caseJRI = createCase('#JRI - check not exists error (BelongsTo) - creating', {
  execute: async (kit) => {
    await kit.addOption({ value: 'option-1', dictionary: 'regions' })
  },
  expectations: {
    tables: {},
    scheme: {},
    error: new CoreError('Dictionary', { reason: 'NOT_EXISTS', refId: 'regions' })
  }
})

export const caseFNQ = createCase('#FNQ - check relation restrict error (BelongsTo) - updating', {
  execute: async (kit, dataSource) => {
    await kit.addDictionary({ dictionary: 'regions' })
    await kit.addOption({
      value: 'option-1',
      dictionary: 'regions'
    })

    await dataSource.collections.options.update('option-1', (draft) => {
      draft.dictionary = 'kind_of_work'
    })
  },
  expectations: {
    tables: {},
    scheme: {
      dictionaries: [mock.Dictionary({ dictionary: 'regions', options: ['option-1'] })],
      options: [
        mock.Option({
          value: 'option-1',
          dictionary: 'regions'
        })
      ]
    },
    error: new CoreError('Option', {
      reason: 'RELATION_RESTRICT',
      address: 'dictionary',
      info: 'belongs-to'
    })
  }
})
