import { createCase } from '../../tools'
import { mock } from '../../..'

export const caseLXA = createCase('#LXA - BelongsTo adding to HasMany', {
  execute: async (kit) => {
    // dictionary
    await kit.addDictionary({ dictionary: 'employment' })

    // options
    await kit.addOption({
      value: 'option-1',
      dictionary: 'employment' // BelongsTo
    })

    await kit.addOption({
      value: 'option-2',
      dictionary: 'employment' // BelongsTo
    })
  },
  expectations: {
    tables: {},
    scheme: {
      dictionaries: [mock.Dictionary({ dictionary: 'employment', options: ['option-1', 'option-2'] })],
      options: [
        mock.Option({ value: 'option-1', dictionary: 'employment' }),
        mock.Option({ value: 'option-2', dictionary: 'employment' })
      ]
    }
  }
})
