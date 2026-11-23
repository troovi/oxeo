/**
 * Стенд и проверка полноты библиотеки на ядре версии: операции — как на сервере, от имени системы и сотрудника,
 * значение представления — пакетом запросов рантайма стенда, раскладка — по исходникам.
 */
import * as path from 'path'
import { describe, expect, it } from 'vitest'
import { checkDomains, createStand } from '../lib/testing'
import { appDomains } from '../core/domains'
import { appViews } from '../core/views'
import { dataScheme } from '../core/scheme'

const T0 = Date.UTC(2026, 10, 4, 9)

const toDateISO = (at: number) => {
  return new Date(at).toISOString().slice(0, 10)
}

const standOf = () => {
  return createStand({
    scheme: dataScheme,
    domains: appDomains,
    views: appViews,
    clock: T0,
    today: toDateISO
  })
}

describe('стенд v-next', () => {
  it('операции системы и сотрудника, @System, запись и событие', async () => {
    const stand = await standOf()

    await stand.run({ domain: 'dictionary', method: 'ensureDictionaries', params: {} })

    const value = await stand.run({
      domain: 'dictionary',
      method: 'addOption',
      params: { dictionary: 'regions', title: 'Москва' }
    })
    const workerId = await stand.run({
      domain: 'workers',
      method: 'createOffice',
      params: {
        name: 'Анна',
        contacts: { phone: '+70000000000', email: 'anna@example.com' },
        positions: ['manager'],
        regionIds: [value],
        citizenshipId: null
      }
    })

    expect(await stand.record('worker', workerId)).toMatchObject({
      name: 'Анна',
      createdAt: T0 + 3 * 60_000
    })
    expect(stand.events.map((event) => event.method)).toEqual([
      'ensureDictionaries',
      'addOption',
      'createOffice'
    ])

    const byWorker = stand.run({
      domain: 'dictionary',
      method: 'ensureDictionaries',
      params: {},
      actor: { workerId }
    })

    await expect(byWorker).rejects.toMatchObject({
      code: 'forbidden',
      message: 'Справочники заводит система'
    })
  })

  it('значение представления считает рантайм стенда', async () => {
    const stand = await standOf()
    const answer = await stand.runtime.query({
      queries: [{ kind: 'view', view: 'stats', method: 'shiftStages', params: { from: null } }]
    })

    expect(answer.results[0]).toMatchObject({
      value: { created: { shifts: 0, plan: 0 } },
      reads: ['shift']
    })
  })
})

describe('полнота ядра v-next', () => {
  it('роли, имена, схемы @Params и токены — без нарушений', () => {
    const violations = checkDomains({
      tsconfig: path.join(__dirname, '../../../tsconfig.json'),
      registries: {
        domains: { file: 'versions/v-next/core/domains/index.ts', name: 'appDomains' },
        views: { file: 'versions/v-next/core/views/index.ts', name: 'appViews' }
      },
      include: ['versions/v-next/core']
    })

    expect(violations).toEqual([])
  }, 60_000)
})
