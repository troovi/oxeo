import * as path from 'path'
import { describe, expect, it } from 'vitest'
import { ParamsError } from '@oxeo/scheme'
import { checkDomains, createStand } from '../lib/testing'
import { ROLE_LABELS, domains, scheme, views, NotesService } from './runtime.fixture'

const T0 = Date.UTC(2026, 0, 1, 9)

const toDateISO = (at: number) => {
  return new Date(at).toISOString().slice(0, 10)
}

/** Стенд над примером заметок: автор 100 засеян, доступ — как у сервера. */
const standOf = (retry?: Parameters<typeof createStand>[0]['retry']) => {
  return createStand({
    scheme,
    domains,
    views,
    clock: T0,
    today: toDateISO,
    seed: async (collections) => {
      await collections.author.create({ authorId: 100, name: 'Посев' })
    },
    retry,
    access: { rolesOf: (actor) => actor.roles, labelOf: (role) => ROLE_LABELS[role] }
  })
}

describe('стенд', () => {
  it('run как на сервере: ответ метода, событие, часы стенда сдвигаются на минуту', async () => {
    const stand = await standOf()

    expect(stand.now).toBe(T0 + 60_000)

    const noteId = await stand.run({
      domain: 'notes',
      method: 'add',
      params: { text: 'a', authorId: 100 }
    })

    expect(noteId).toBe(1)
    expect(stand.events).toHaveLength(1)
    expect(stand.events[0].ctx).toEqual({ actor: null, at: T0 + 60_000, today: '2026-01-01' })

    stand.advance(24 * 3_600_000)
    expect(stand.today).toBe('2026-01-02')

    expect(await stand.record('note', noteId)).toMatchObject({ text: 'a', createdAt: T0 + 60_000 })
    expect(await stand.recordBy('author', { name: 'Посев' })).toMatchObject({ authorId: 100 })
    await expect(stand.record('note', 99)).rejects.toThrow('stand: note 99 не найдена')
    await expect(stand.recordBy('author', { name: 'Никто' })).rejects.toThrow('stand: author по')
  })

  it('чтения доменов и сервисов — копии, база стенда — живая', async () => {
    const stand = await standOf()

    await stand.run({ domain: 'notes', method: 'add', params: { text: 'a', authorId: 100 } })

    const [copy] = await stand.get(NotesService).notesOf(100)

    copy.text = 'правка мимо update'

    const [stored] = await stand.get(NotesService).notesOf(100)

    expect(stored.text).toBe('a')
  })

  it('актор и доступ, частичная запись видна тесту', async () => {
    const stand = await standOf()
    const reader = { name: 'Боря', roles: [] }
    const editor = { name: 'Аня', roles: ['editor' as const] }

    await stand.run({ domain: 'notes', method: 'add', params: { text: 'a', authorId: 100 } })

    const denied = stand.run({
      domain: 'notes',
      method: 'rename',
      params: { noteId: 1, text: 'b' },
      actor: reader
    })

    await expect(denied).rejects.toMatchObject({ message: 'Действие доступно только: Редактор' })
    await stand.run({
      domain: 'notes',
      method: 'rename',
      params: { noteId: 1, text: 'b' },
      actor: editor
    })

    const broken = stand.run({
      domain: 'notes',
      method: 'addBroken',
      params: { text: 'x', authorId: 100 }
    })

    await expect(broken).rejects.toThrow('after write')
    expect(stand.partialWrites).toHaveLength(1)
  })

  it('retry: отказ без записи — повтор с новыми параметрами; retry: false и запись — отказ тесту', async () => {
    const calls: string[] = []
    const stand = await standOf((error, call) => {
      calls.push(call.method)

      return error instanceof ParamsError ? { ...call.params, noteId: 1 } : null
    })

    await stand.run({ domain: 'notes', method: 'add', params: { text: 'a', authorId: 100 } })
    await stand.run({ domain: 'notes', method: 'publish', params: { noteId: 'один' } as never })

    expect(await stand.record('note', 1)).toMatchObject({ status: 'published' })

    const once = stand.run({
      domain: 'notes',
      method: 'publish',
      params: { noteId: 'один' } as never,
      retry: false
    })

    await expect(once).rejects.toBeInstanceOf(ParamsError)

    // отказ без записи, который крючок не исправляет, — уходит тесту
    const missing = stand.run({ domain: 'notes', method: 'publish', params: { noteId: 7 } })

    await expect(missing).rejects.toMatchObject({ model: 'Note' })

    const broken = stand.run({
      domain: 'notes',
      method: 'addBroken',
      params: { text: 'x', authorId: 100 }
    })

    await expect(broken).rejects.toThrow('after write')
    expect(calls).toEqual(['publish', 'publish'])
  })
})

describe('checkDomains', () => {
  it('нарушения ролей, имён, схем и токенов — строками «файл: Класс — что не так»', () => {
    const project = path.join(__dirname, 'check-project')
    const violations = checkDomains({
      tsconfig: path.join(project, 'tsconfig.json'),
      registries: {
        domains: { file: 'registry.ts', name: 'appDomains' },
        views: { file: 'registry.ts', name: 'appViews' }
      }
    })

    expect(violations).toEqual([
      'bare.domain.ts: BareDomain — нет декоратора роли @Domain()',
      'helpers.ts: HelperService — класс с @Service() лежит в helper.service.ts',
      'plain.service.ts: PlainService — нет декоратора роли @Service()',
      'mixed.domain.ts: LocalToken — нет декоратора роли @Domain()',
      'report.view.ts: ReportReader — класс с @View() называется ReportView',
      'shift-stats.service.ts: StatsService — класс с @Service() называется ShiftStatsService',
      'bare.domain.ts: BareDomain.extra — публичный метод без @Params',
      'mixed.domain.ts: MixedDomain — параметр 1 (Shape) — интерфейс или алиас: в метаданных будет Object',
      'mixed.domain.ts: MixedDomain — параметр 2 (TypedService) — import type: в метаданных будет Object',
      'plain.service.ts: MixedDomain → PlainService — класс с параметрами без роли: нужен @Service()',
      'mixed.domain.ts: MixedDomain → GoodDomain — домен и представление — корни графа, параметром не внедряются',
      'mixed.domain.ts: MixedDomain — параметр 5 (LocalToken) — токен в одном файле с классом: в метаданных будет Object',
      'mixed.domain.ts: MixedDomain — параметр 6 (string) — не класс: в метаданных не будет класса',
      'report.view.ts: ReportReader.total — публичный метод без @Params',
      'report.view.ts: ReportReader — параметр leaky: LeakyService называется leakyService',
      'leaky.service.ts: ReportReader → LeakyService → GoodDomain — сервис зависит от домена или представления'
    ])
  })
})
