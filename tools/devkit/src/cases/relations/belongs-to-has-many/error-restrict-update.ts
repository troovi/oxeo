import { CoreError } from '@oxeo/server'
import { createCase } from '../../tools'
import { mock } from '../../..'

export const caseMOX = createCase('#MOX - check relation restrict error (HasMany)', {
  execute: async (kit, dataSource) => {
    await kit.addDictionary({ dictionary: 'regions' })
    await kit.addOption({
      value: 'option-1',
      dictionary: 'regions'
    })

    await dataSource.collections.dictionaries.update('regions', (draft) => {
      draft.options = []
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
    error: new CoreError('Dictionary', {
      reason: 'RELATION_RESTRICT',
      address: 'options',
      info: 'has-many'
    })
  }
})
