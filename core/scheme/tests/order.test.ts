import { describe, expect, it } from 'vitest'
import { OrderedEntry, windowOf } from '../lib/filter/order'

const entries: OrderedEntry[] = [
  [3, { date: '2026-11-12', plan: 4 }],
  [1, { date: null, plan: 2 }],
  [4, { date: '2026-11-10', plan: 4 }],
  [2, { plan: 'много' }]
]

const idsOf = (window: OrderedEntry[]) => window.map(([id]) => id)

describe('windowOf', () => {
  it('без опций — как есть, предел без порядка — по id', () => {
    expect(idsOf(windowOf(entries))).toEqual([3, 1, 4, 2])
    expect(idsOf(windowOf(entries, { limit: 2 }))).toEqual([1, 2])
  })

  it('порядок: пустое раньше чисел, числа раньше строк, при равенстве — id по возрастанию', () => {
    const plan = { field: 'plan', direction: 'asc' } as const

    expect(idsOf(windowOf(entries, { order: plan }))).toEqual([1, 3, 4, 2])
    expect(idsOf(windowOf(entries, { order: { ...plan, direction: 'desc' } }))).toEqual([2, 3, 4, 1])
  })

  it('окно — первые записи в порядке; нет поля и null равны', () => {
    const date = { field: 'date', direction: 'desc' } as const

    expect(idsOf(windowOf(entries, { order: date, limit: 2 }))).toEqual([3, 4])
    expect(idsOf(windowOf(entries, { order: { ...date, direction: 'asc' }, limit: 3 }))).toEqual([
      1, 2, 4
    ])
  })
})
