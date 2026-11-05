import { describe, expect, it } from 'vitest'
import { applyPatch } from '../lib/domains/patch'

describe('applyPatch', () => {
  it('правит embedded по полям, json — целиком', () => {
    const draft = {
      name: 'a',
      file: { stage: 'assigned', meta: { filename: 'x' } },
      contacts: { phone: '1', extra: '2' }
    }

    applyPatch(
      draft,
      { file: { stage: 'empty' } as never, contacts: { phone: '3' } as never, name: undefined },
      ['contacts']
    )
    expect(draft).toEqual({ name: 'a', file: { stage: 'empty' }, contacts: { phone: '3', extra: '2' } })
  })
})
