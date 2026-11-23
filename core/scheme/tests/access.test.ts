import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { Allow, System, accessOf, accessRefusal, createAccessIndex } from '../lib/domains/access'
import type { DomainsDescriptions } from '../lib/domains/descriptions'
import { Params } from '../lib/domains/params'

const Empty = z.object({})

class StaffDomain {
  @Params(Empty)
  async list(_params: {}) {
    return []
  }

  @Allow('director', 'recruiter')
  @Params(Empty)
  async hire(_params: {}) {
    return 1
  }

  @Allow('director')
  @Params(Empty)
  async fire(_params: {}) {
    return 1
  }

  @System('Отчёт строит только планировщик')
  @Params(Empty)
  async report(_params: {}) {
    return null
  }

  /** Без схемы — не операция: в индекс не попадает, даже с декоратором доступа. */
  @Allow('director')
  async helper(_params: {}) {
    return null
  }
}

class NotesDomain {
  @Allow('editor')
  @Params(Empty)
  async publish(_params: {}) {
    return null
  }
}

const domains = { staff: StaffDomain, notes: NotesDomain }

const LABELS: Record<string, string> = { director: 'Директор', recruiter: 'Рекрутер' }

describe('доступ к операциям', () => {
  it('accessOf: роли, system или null — без декоратора', () => {
    expect(accessOf(StaffDomain, 'hire')).toEqual(['director', 'recruiter'])
    expect(accessOf(StaffDomain, 'report')).toBe('system')
    expect(accessOf(StaffDomain, 'list')).toBeNull()
    expect(accessOf(StaffDomain, 'missing')).toBeNull()
  })

  it('accessRefusal: система проходит @Allow, @System — только система; текст — по подписям ролей', () => {
    const check = { Class: StaffDomain, labelOf: (role: string) => LABELS[role] }

    expect(accessRefusal({ ...check, method: 'hire', roles: null })).toBeNull()
    expect(accessRefusal({ ...check, method: 'hire', roles: ['recruiter'] })).toBeNull()
    expect(accessRefusal({ ...check, method: 'hire', roles: ['accountant'] })).toBe(
      'Действие доступно только: Директор, Рекрутер'
    )
    expect(accessRefusal({ Class: StaffDomain, method: 'fire', roles: [] })).toBe(
      'Действие доступно только: director'
    )
    expect(accessRefusal({ ...check, method: 'report', roles: ['director'] })).toBe(
      'Отчёт строит только планировщик'
    )
    expect(accessRefusal({ ...check, method: 'report', roles: null })).toBeNull()
    expect(accessRefusal({ ...check, method: 'list', roles: [] })).toBeNull()
  })

  it('accessRefusal: суперроль проходит любой @Allow, но не @System', () => {
    const check = { Class: StaffDomain, superRole: 'admin' }

    expect(accessRefusal({ ...check, method: 'fire', roles: ['admin'] })).toBeNull()
    expect(accessRefusal({ ...check, method: 'hire', roles: ['recruiter', 'admin'] })).toBeNull()
    expect(accessRefusal({ ...check, method: 'fire', roles: ['recruiter'] })).toBe(
      'Действие доступно только: director'
    )
    expect(accessRefusal({ ...check, method: 'report', roles: ['admin'] })).toBe(
      'Отчёт строит только планировщик'
    )
  })

  it('индекс: открытые и разрешённые ролям операции, служебные отдельно, доступ операции', () => {
    const index = createAccessIndex(domains)

    expect(index.allowed([])).toEqual(['staff.list'])
    expect(index.allowed(['recruiter'])).toEqual(['staff.list', 'staff.hire'])
    expect(index.allowed(['director', 'editor']).sort()).toEqual([
      'notes.publish',
      'staff.fire',
      'staff.hire',
      'staff.list'
    ])
    expect(index.system()).toEqual(['staff.report'])
    expect(index.of('staff', 'fire')).toEqual(['director'])
    expect(index.of('notes', 'publish')).toEqual(['editor'])
  })

  it('индекс с суперролью: ей — все операции, кроме служебных; другим ролям — как без неё', () => {
    const index = createAccessIndex(domains, { superRole: 'admin' })

    expect(index.allowed(['admin']).sort()).toEqual([
      'notes.publish',
      'staff.fire',
      'staff.hire',
      'staff.list'
    ])
    expect(index.allowed(['recruiter'])).toEqual(['staff.list', 'staff.hire'])
    expect(index.system()).toEqual(['staff.report'])
  })

  it('описания: компилятор требует каждый домен и каждую операцию и не пускает лишнее', () => {
    const operation = { title: 'Действие', description: 'Что делает' }
    const staff = {
      title: 'Сотрудники',
      description: 'Штат',
      methods: {
        list: operation,
        hire: operation,
        fire: operation,
        report: operation,
        helper: operation
      }
    }
    const notes = { title: 'Заметки', description: 'Тексты', methods: { publish: operation } }
    const descriptions: DomainsDescriptions<typeof domains> = { staff, notes }

    // @ts-expect-error нет домена notes
    const withoutDomain: DomainsDescriptions<typeof domains> = { staff }
    const withoutMethod: DomainsDescriptions<typeof domains> = {
      staff,
      // @ts-expect-error нет операции publish
      notes: { ...notes, methods: {} }
    }
    const extra: DomainsDescriptions<typeof domains> = {
      staff,
      // @ts-expect-error лишняя операция
      notes: { ...notes, methods: { publish: operation, archive: operation } }
    }

    expect([descriptions, withoutDomain, withoutMethod, extra]).toHaveLength(4)
  })
})
