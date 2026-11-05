import { createCase } from '../tools'
import { mock } from '../..'

export const caseAAA = createCase('#AAA - Base model creating', {
  execute: async (kit) => {
    await kit.addDictionary({ dictionary: 'regions' })
  },
  expectations: {
    tables: {},
    scheme: {
      dictionaries: [mock.Dictionary({ dictionary: 'regions' })]
    }
  }
})
