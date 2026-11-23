import { describe, expect, it, vi } from 'vitest'
import { Allow, Collections, DomainsMap, Ids, Params, System, ViewsMap } from '@oxeo/scheme'
import { Domain, Service, View } from '@oxeo/scheme/di'
import { z } from 'zod'
import { Container, DomainRuntime, InjectionError, Token } from '../lib'
import {
  NotesDomain,
  NotesService,
  NotesView,
  createRuntime,
  source,
  viewInstances
} from './runtime.fixture'

/** Рантайм над своими классами: проверки при старте идут в конструкторе. */
const runtimeWith = <T extends DomainsMap, V extends ViewsMap>(classes: { domains: T; views?: V }) => {
  return new DomainRuntime({
    ...classes,
    dataSource: source(),
    counterCollection: 'counter',
    resolveActor: () => null,
    today: () => '2026-01-01',
    broadcast: () => {},
    onPartialWrite: () => {}
  })
}

/** Ошибка сборки: класс ошибки и текст целиком. */
const failureOf = (build: () => unknown) => {
  try {
    build()
  } catch (error) {
    return { isInjection: error instanceof InjectionError, message: (error as Error).message }
  }

  return null
}

/** Ошибка сборки класса в пустой области. */
const scopeFailureOf = (Class: Token) => {
  return failureOf(() => new Container({ where: 'в тесте', values: new Map() }).get(Class))
}

describe('области контейнера', () => {
  it('область рантайма: один экземпляр класса, значения по токенам — коллекции и выдача', async () => {
    const { runtime, serverSource } = createRuntime()
    const domain = runtime.get(NotesDomain)
    const addAuthor = vi.spyOn(domain, 'addAuthor')

    expect(runtime.get(NotesDomain)).toBe(domain)
    expect(runtime.get(NotesService)).toBe(domain.notesService)
    expect(runtime.get(Collections)).toBe(serverSource.collections)
    expect(await runtime.get(Ids).number('notes')).toBe(1)

    // вызовы исполняет тот же экземпляр домена
    await runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)
    expect(addAuthor).toHaveBeenCalledOnce()
  })

  it('область представления: представление и его сервисы — новые на каждый расчёт', async () => {
    const { runtime } = createRuntime()
    const summary = { kind: 'view', view: 'notes', method: 'summary', params: { authorId: 1 } } as const
    const before = viewInstances.length

    await runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)
    await runtime.query({ queries: [summary] }, 'автор')
    await runtime.query({ queries: [summary] }, 'другой')

    const [first, second] = viewInstances.slice(before)

    // сравнение ссылок: глубокое сравнение `not.toBe` обошло бы коллекции представления и упёрлось в запрет записи
    expect(viewInstances.length).toBe(before + 2)
    expect(first === second).toBe(false)
    expect(first.notesService === second.notesService).toBe(false)
    expect(first.notesService === runtime.get(NotesService)).toBe(false)
    expect(first === runtime.get(NotesView)).toBe(false)
  })

  it('сервис в представлении: его чтения — в учёте кэша, запись — отказ', async () => {
    const { runtime } = createRuntime()
    const summary = { kind: 'view', view: 'notes', method: 'summary', params: { authorId: 1 } } as const

    await runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)

    // заметки сводка читает только через сервис
    const first = await runtime.query({ queries: [summary] })

    expect(first.results[0]).toMatchObject({ value: { drafts: 0 }, reads: ['note', 'author'] })

    // заметка тронула прочитанное сервисом — значение считается заново
    await runtime.run({ domain: 'notes', method: 'add', params: { text: 'a', authorId: 1 } }, null)

    const next = await runtime.query({ queries: [summary] })

    expect(next.results[0]).toMatchObject({ value: { drafts: 1 } })

    const broken = await runtime.query({
      queries: [{ kind: 'view', view: 'notes', method: 'broken', params: { noteId: 1 } }]
    })

    expect(broken.results[0]).toMatchObject({ error: { code: 'forbidden' } })
  })
})

describe('ошибки сборки', () => {
  it('цикл зависимостей', () => {
    class First {
      constructor(readonly second: unknown) {}
    }

    class Second {
      constructor(readonly first: unknown) {}
    }

    // цикл в метаданных: объявлением классов его не собрать — второй класс ещё не объявлен
    Service()(First)
    Service()(Second)
    Reflect.defineMetadata('design:paramtypes', [Second], First)
    Reflect.defineMetadata('design:paramtypes', [First], Second)

    expect(scopeFailureOf(First)).toEqual({
      isInjection: true,
      message: 'цикл зависимостей: First → Second → First'
    })
  })

  it('класс с параметрами конструктора без роли', () => {
    class PlainService {
      constructor(readonly collections: Collections) {}
    }

    @Domain()
    class PlainDomain {
      constructor(readonly service: PlainService) {}
    }

    expect(scopeFailureOf(PlainService)).toEqual({
      isInjection: true,
      message: 'PlainService: класс с параметрами без роли — нужен @Service()'
    })
    expect(failureOf(() => runtimeWith({ domains: { plain: PlainDomain } }))).toEqual({
      isInjection: true,
      message: 'PlainDomain → PlainService: класс с параметрами без роли — нужен @Service()'
    })
  })

  it('роль без типов параметров: декоратор применён не синтаксисом или метаданные не выпущены', () => {
    class Unmarked {
      constructor(readonly collections: Collections) {}
    }

    Service()(Unmarked)

    expect(scopeFailureOf(Unmarked)?.message).toBe(
      `Unmarked: нет типов параметров конструктора — нужны emitDecoratorMetadata и полифил reflect-metadata до объявления класса`
    )
  })

  it('параметр не класс: Object и undefined — import type, интерфейс, цикл импортов', () => {
    interface LocalToken {}
    abstract class LocalToken {}

    interface Shape {
      size: number
    }

    @Service()
    class WithLocalToken {
      constructor(
        readonly collections: Collections,
        readonly token: LocalToken
      ) {}
    }

    @Service()
    class WithShape {
      constructor(readonly shape: Shape) {}
    }

    @Service()
    class WithPrimitive {
      constructor(readonly label: string) {}
    }

    class WithUndefined {
      constructor(readonly service: unknown) {}
    }

    Service()(WithUndefined)
    Reflect.defineMetadata('design:paramtypes', [undefined], WithUndefined)

    const notClass = 'не класс: import type, интерфейс или цикл импортов'
    const primitive = scopeFailureOf(WithPrimitive)

    expect(Reflect.getMetadata('design:paramtypes', WithLocalToken)).toEqual([Collections, Object])
    expect(scopeFailureOf(WithLocalToken)).toEqual({
      isInjection: true,
      message: `WithLocalToken: параметр 2 — ${notClass}`
    })
    expect(scopeFailureOf(WithShape)?.message).toBe(`WithShape: параметр 1 — ${notClass}`)
    expect(scopeFailureOf(WithUndefined)?.message).toBe(`WithUndefined: параметр 1 — ${notClass}`)
    expect(primitive?.message).toBe('WithPrimitive: параметр 1 — String, а не класс')
  })

  it('выдачи идентификаторов в представлении нет — и у его сервисов', () => {
    @Service()
    class IdsService {
      constructor(readonly ids: Ids) {}
    }

    @View()
    class IdsView {
      constructor(readonly service: IdsService) {}

      @Params(z.object({}))
      async total(_params: {}) {
        return 0
      }
    }

    expect(failureOf(() => runtimeWith({ domains: {}, views: { ids: IdsView } }))).toEqual({
      isInjection: true,
      message: 'Ids нет в представлении: IdsView → IdsService'
    })
  })
})

describe('методы без схемы', () => {
  it('рантайм стартует, а метод без @Params — и TS-private помощник — не вызвать: notFound', async () => {
    @Domain()
    class LooseDomain {
      @Params(z.object({ name: z.string() }))
      async add(params: { name: string }) {
        return this.normalize(params.name)
      }

      async extra(_params: {}) {
        return 'без схемы'
      }

      /** TS-`private` в рантайме — обычный метод экземпляра. */
      private async normalize(name: string) {
        return name.trim()
      }
    }

    @View()
    class LooseView {
      @Params(z.object({}))
      async total(_params: {}) {
        return this.count()
      }

      private async count() {
        return 0
      }
    }

    const runtime = runtimeWith({ domains: { loose: LooseDomain }, views: { loose: LooseView } })
    const added = await runtime.run({ domain: 'loose', method: 'add', params: { name: ' Аня ' } }, null)

    expect(added.result).toBe('Аня')

    for (const method of ['extra', 'normalize']) {
      const call = runtime.run({ domain: 'loose', method, params: {} } as never, null)

      await expect(call).rejects.toMatchObject({ code: 'notFound' })
    }

    const answer = await runtime.query({
      queries: [
        { kind: 'view', view: 'loose', method: 'total', params: {} },
        { kind: 'view', view: 'loose', method: 'count', params: {} }
      ]
    })

    expect(answer.results).toEqual([
      { value: 0, reads: [] },
      { error: { code: 'notFound', message: 'View loose.count not found' } }
    ])
  })
})

describe('роли', () => {
  @Domain()
  class OtherDomain {
    @Params(z.object({}))
    async ping(_params: {}) {
      return 'pong'
    }
  }

  @View()
  class OtherView {
    @Params(z.object({}))
    async total(_params: {}) {
      return 0
    }
  }

  it('домен и представления — корни: параметром конструктора не внедряются', () => {
    @Domain()
    class UsesDomain {
      constructor(readonly other: OtherDomain) {}
    }

    @Domain()
    class UsesView {
      constructor(readonly views: OtherView) {}
    }

    const rule = 'корень графа, параметром конструктора не внедряется'

    expect(failureOf(() => runtimeWith({ domains: { uses: UsesDomain } }))).toEqual({
      isInjection: true,
      message: `UsesDomain → OtherDomain: домен — ${rule}`
    })
    expect(failureOf(() => runtimeWith({ domains: { uses: UsesView } }))?.message).toBe(
      `UsesView → OtherView: представление — ${rule}`
    )
  })

  it('сервис зависит только от сервисов и токенов', () => {
    @Service()
    class LeakyService {
      constructor(readonly domain: OtherDomain) {}
    }

    @Domain()
    class UsesLeaky {
      constructor(readonly service: LeakyService) {}
    }

    const rule = `сервис зависит только от сервисов, Collections и Ids — не от домена и не от представления`

    expect(failureOf(() => runtimeWith({ domains: { uses: UsesLeaky } }))?.message).toBe(
      `UsesLeaky → LeakyService → OtherDomain: ${rule}`
    )
  })

  it('класс реестра — с ролью реестра, даже без параметров конструктора', () => {
    class BareDomain {
      @Params(z.object({}))
      async ping(_params: {}) {
        return 'pong'
      }
    }

    @Service()
    class ServiceAsView {
      @Params(z.object({}))
      async total(_params: {}) {
        return 0
      }
    }

    expect(failureOf(() => runtimeWith({ domains: { bare: BareDomain } }))).toEqual({
      isInjection: true,
      message: 'BareDomain: класс реестра доменов без @Domain()'
    })
    expect(
      failureOf(() => runtimeWith({ domains: {}, views: { views: ServiceAsView } }))?.message
    ).toBe('ServiceAsView: класс реестра представлений без @View()')
    expect(() =>
      runtimeWith({ domains: { other: OtherDomain }, views: { other: OtherView } })
    ).not.toThrow()
  })
})

describe('доступ', () => {
  it('@Allow: система и роль проходят, без роли — forbidden с подписями; без записи и ревизии', async () => {
    const { runtime } = createRuntime()

    await runtime.run({ domain: 'notes', method: 'addAuthor', params: { name: 'Аня' } }, null)
    await runtime.run({ domain: 'notes', method: 'add', params: { text: 'a', authorId: 1 } }, null)

    const revision = runtime.revision
    const denied = runtime.run(
      { domain: 'notes', method: 'rename', params: { noteId: 1, text: 'b' } },
      'автор'
    )

    await expect(denied).rejects.toMatchObject({
      code: 'forbidden',
      message: 'Действие доступно только: Редактор'
    })
    expect(runtime.revision).toBe(revision)

    const byEditor = await runtime.run(
      { domain: 'notes', method: 'rename', params: { noteId: 1, text: 'b' } },
      'редактор'
    )
    const bySystem = await runtime.run(
      { domain: 'notes', method: 'rename', params: { noteId: 1, text: 'c' } },
      null
    )

    expect(byEditor.changes[0].record).toMatchObject({ text: 'b' })
    expect(bySystem.changes[0].record).toMatchObject({ text: 'c' })
  })

  it('@System: только система, актору — свой текст отказа', async () => {
    const { runtime } = createRuntime()
    const call = { domain: 'notes', method: 'reconcile', params: {} } as const

    await expect(runtime.run(call, 'редактор')).rejects.toMatchObject({
      code: 'forbidden',
      message: 'Сверку запускает только система'
    })
    expect((await runtime.run(call, null)).result).toBe('сверено')
  })

  it('порядок: сначала схема параметров, затем актор и доступ', async () => {
    const { runtime } = createRuntime()
    const invalid = runtime.run(
      { domain: 'notes', method: 'rename', params: { noteId: 'x' } } as never,
      'автор'
    )

    await expect(invalid).rejects.toMatchObject({ code: 'params' })
  })

  it('без опции access ролей нет: @Allow доступен только системе, отказ — с самими ролями', async () => {
    @Domain()
    class GuardedDomain {
      @Allow('editor')
      @Params(z.object({}))
      async edit(_params: {}) {
        return 'ok'
      }
    }

    const runtime = new DomainRuntime({
      domains: { guarded: GuardedDomain },
      dataSource: source(),
      counterCollection: 'counter',
      resolveActor: (name: string) => ({ name, roles: ['editor' as const] }),
      today: () => '2026-01-01',
      broadcast: () => {},
      onPartialWrite: () => {}
    })
    const call = { domain: 'guarded', method: 'edit', params: {} } as const

    await expect(runtime.run(call, 'редактор')).rejects.toMatchObject({
      message: 'Действие доступно только: editor'
    })
    expect((await runtime.run(call, null)).result).toBe('ok')
  })

  it('суперроль проходит любой @Allow, служебная операция ей закрыта', async () => {
    @Domain()
    class GuardedDomain {
      @Allow('editor')
      @Params(z.object({}))
      async edit(_params: {}) {
        return 'ok'
      }

      @System('Сверку запускает только система')
      @Params(z.object({}))
      async reconcile(_params: {}) {
        return 'сверено'
      }
    }

    const runtime = new DomainRuntime({
      domains: { guarded: GuardedDomain },
      dataSource: source(),
      counterCollection: 'counter',
      resolveActor: (name: string) => ({ roles: name === 'админ' ? ['admin' as const] : [] }),
      access: { rolesOf: (actor) => actor.roles, superRole: 'admin' },
      today: () => '2026-01-01',
      broadcast: () => {},
      onPartialWrite: () => {}
    })
    const edit = { domain: 'guarded', method: 'edit', params: {} } as const
    const reconcile = { domain: 'guarded', method: 'reconcile', params: {} } as const

    expect((await runtime.run(edit, 'админ')).result).toBe('ok')
    await expect(runtime.run(edit, 'автор')).rejects.toMatchObject({ code: 'forbidden' })
    await expect(runtime.run(reconcile, 'админ')).rejects.toMatchObject({
      code: 'forbidden',
      message: 'Сверку запускает только система'
    })
  })
})
