import { createCase } from '../../tools'

export const caseHIE = createCase('#HIE - check @HasMany cleanupBehavior:cascade', {
  execute: async (kit, dataSource) => {
    // create dictionary
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

    // remove dictionary
    await dataSource.collections.dictionaries.remove('regions')
  },
  expectations: {
    tables: {},
    scheme: {}
  }
})
