import { describe, expect, it } from 'vitest'
import { matches } from '../lib/filter/matcher'

const shift = {
  shiftId: 40,
  date: '2026-11-12',
  stage: 'recruiting',
  plan: 4,
  cancelReason: null,
  stats: { attended: null, total: 0 },
  participantIds: ['a', 'b']
}

describe('matches', () => {
  it('равенство полей и вложенных embedded', () => {
    expect(matches(shift, {})).toBe(true)
    expect(matches(shift, { stage: 'recruiting', plan: 4 })).toBe(true)
    expect(matches(shift, { stage: 'created' })).toBe(false)
    expect(matches(shift, { cancelReason: null })).toBe(true)
    expect(matches(shift, { stats: { total: 0 } })).toBe(true)
    expect(matches(shift, { stats: { attended: 1 } })).toBe(false)
  })

  it('поле-массив: скаляр — среди элементов, массив — целиком', () => {
    expect(matches(shift, { participantIds: 'a' })).toBe(true)
    expect(matches(shift, { participantIds: 'c' })).toBe(false)
    expect(matches(shift, { participantIds: ['a', 'b'] })).toBe(true)
    expect(matches(shift, { participantIds: ['a'] })).toBe(false)
    expect(matches(shift, { participantIds: { in: ['c', 'b'] } })).toBe(true)
  })

  it('операторы порядка, in и ne; с null порядок не выполняется', () => {
    expect(matches(shift, { date: { gte: '2026-11-01', lt: '2026-12-01' } })).toBe(true)
    expect(matches(shift, { date: { gte: '2026-12-01' } })).toBe(false)
    expect(matches(shift, { plan: { gt: 4 } })).toBe(false)
    expect(matches(shift, { plan: { lte: 4 } })).toBe(true)
    expect(matches(shift, { stage: { in: ['created', 'recruiting'] } })).toBe(true)
    expect(matches(shift, { stage: { ne: 'canceled' } })).toBe(true)
    expect(matches(shift, { cancelReason: { ne: null } })).toBe(false)
    expect(matches(shift, { stats: { attended: { gte: 0 } } })).toBe(false)
  })
})
