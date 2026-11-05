import { CoreError } from '@oxeo/server'
import { createCase } from '../../tools'

export const caseKEO = createCase('#KEO - check relation restrict error (HasMany) - creating', {
  execute: async (kit) => {
    await kit.addDictionary({
      dictionary: 'regions',
      options: ['option-1']
    })
  },
  expectations: {
    tables: {},
    scheme: {},
    error: new CoreError('Option', {
      reason: 'RELATION_RESTRICT',
      address: 'options',
      info: 'has-many >0'
    })
  }
})
