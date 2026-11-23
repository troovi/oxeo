import { describe, expect, it } from 'vitest'
import { isSystem, requireActor } from '../lib/domains/context'
import type { DomainContext } from '../lib/domains/context'
import { DomainError, ParamsError, assertNone, existing, notFound } from '../lib/domains/error'
import type { DomainErrorCode } from '../lib/domains/error'

/** Ошибка проекта: свои коды поверх базовых и своё поле. */
class AppDomainError extends DomainError<DomainErrorCode | 'taskDecision'> {
  constructor(
    code: DomainErrorCode | 'taskDecision',
    message: string,
    readonly draft: string | null = null
  ) {
    super(code, message)
  }
}

const ctxOf = (actor: unknown): DomainContext => {
  return { actor, at: 0, today: '2026-01-01' }
}

describe('ошибки и отказы', () => {
  it('notFound, existing, assertNone — коды и тексты', async () => {
    expect(notFound('Сотрудник 7')).toMatchObject({
      code: 'notFound',
      message: 'Не найдено: сотрудник 7'
    })
    expect(await existing(Promise.resolve({ id: 1 }), 'Запись')).toEqual({ id: 1 })
    await expect(existing(Promise.resolve(null), 'Смена')).rejects.toMatchObject({
      code: 'notFound',
      message: 'Не найдено: смена'
    })

    expect(() => assertNone([], { code: 'conflict', lead: 'Нельзя' })).not.toThrow()
    expect(() => assertNone(['занято', 'повтор'], { code: 'conflict', lead: 'Нельзя' })).toThrow(
      'Нельзя: занято; повтор'
    )
  })

  it('наследник проекта — тот же DomainError для рантайма; ParamsError — с кодом params', () => {
    const error = new AppDomainError('taskDecision', 'Решите', 'черновик')

    expect(error).toBeInstanceOf(DomainError)
    expect(error).toMatchObject({ code: 'taskDecision', draft: 'черновик', name: 'DomainError' })
    expect(new ParamsError([])).toMatchObject({ code: 'params', name: 'ParamsError' })
  })

  it('isSystem и requireActor', () => {
    expect(isSystem(ctxOf(null))).toBe(true)
    expect(isSystem(ctxOf({ id: 1 }))).toBe(false)
    expect(requireActor(ctxOf({ id: 1 }))).toEqual({ id: 1 })
    expect(() => requireActor(ctxOf(null))).toThrow('Действие требует вход пользователя')
  })
})
