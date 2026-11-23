import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { Params, paramsOf } from '../lib/domains/params'
import type { DomainContext } from '../lib/domains/context'
import type { DomainRoutes } from '../lib/domains/domains.types'

const Rename = z.object({ noteId: z.number(), text: z.string() })
const NoteId = z.object({ noteId: z.number() })

class BaseDomain {
  @Params(NoteId)
  async remove(params: z.infer<typeof NoteId>) {
    return params.noteId
  }

  @Params(NoteId)
  async publish(params: z.infer<typeof NoteId>) {
    return params.noteId
  }
}

class NotesDomain extends BaseDomain {
  /** Контекст — вторым параметром. */
  @Params(Rename)
  async rename(params: z.infer<typeof Rename>, ctx: DomainContext) {
    return `${params.text} ${ctx.today}`
  }

  /** Собственная схема заменяет унаследованную. */
  @Params(Rename)
  async publish(params: z.infer<typeof Rename>) {
    return params.noteId
  }

  async helper() {
    return null
  }
}

describe('@Params', () => {
  it('paramsOf: метод → схема, с методами базового класса; метода без схемы в карте нет', () => {
    const schemas = paramsOf(NotesDomain)

    expect([...schemas.keys()].sort()).toEqual(['publish', 'remove', 'rename'])
    expect(schemas.get('rename')).toBe(Rename)
    expect(schemas.get('publish')).toBe(Rename)
    expect(schemas.get('remove')).toBe(NoteId)
    expect(paramsOf(BaseDomain).get('publish')).toBe(NoteId)
    expect(schemas.has('helper')).toBe(false)
    expect(schemas.has('toString')).toBe(false)
  })

  it('метод с чужой схемой не компилируется; маршруты — по методам экземпляра', () => {
    class Checked {
      // @ts-expect-error схема другого метода: у rename параметры другие
      @Params(NoteId)
      async rename(params: z.infer<typeof Rename>) {
        return params.text
      }

      // @ts-expect-error метод не асинхронный
      @Params(NoteId)
      remove(params: z.infer<typeof NoteId>) {
        return params.noteId
      }
    }

    const routes: DomainRoutes<{ notes: typeof NotesDomain }>['notes']['rename'] = {
      params: { noteId: 1, text: 'a' },
      answer: 'a'
    }

    expect(paramsOf(Checked).size).toBe(2)
    expect(routes.answer).toBe('a')
  })
})
