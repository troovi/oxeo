/**
 * Общий пример тестов журнала и клиента: маленькая схема заметок, домен и журнал над in-memory драйвером. Отдельным файлом
 * рядом с тестами, а не в `@oxeo/devkit`: его модели попали бы в одно хранилище метаданных с макетной схемой.
 */
import { createMemoryDriver } from '@oxeo-drivers/memory'
import {
  Collections,
  DataScheme,
  DomainContext,
  DomainError,
  DomainEvent,
  Identifier,
  Model,
  Prop,
  ReferenceTo,
  defineCollection
} from '@oxeo/scheme'
import { DataSource, PartialWrite, createServerShell } from '../lib'

type Source = 'notes' | 'authors'

@Model({ name: 'Counter' })
class CounterEntity {
  @Identifier({ type: 'string' })
  source: Source

  @Prop({ type: 'number' })
  seq: number
}

@Model({ name: 'Author' })
class AuthorEntity {
  @Identifier({ type: 'number' })
  authorId: number

  @Prop({ type: 'string' })
  name: string
}

@Model({ name: 'Note' })
class NoteEntity {
  @Identifier({ type: 'number' })
  noteId: number

  @Prop({ type: 'string' })
  text: string

  @Prop({ type: 'literal', values: ['draft', 'published'] })
  status: 'draft' | 'published'

  @Prop({ type: 'number' })
  createdAt: number

  @ReferenceTo(() => AuthorEntity)
  authorId: AuthorEntity['authorId']
}

const scheme = new DataScheme({
  counter: defineCollection(CounterEntity, 'source'),
  author: defineCollection(AuthorEntity, 'authorId'),
  note: defineCollection(NoteEntity, 'noteId')
})

export type Scheme = typeof scheme extends DataScheme<infer S> ? S : never

interface Actor {
  name: string
}

class NotesDomain {
  constructor(private collections: Collections<Scheme>) {}

  async addAuthor(params: { name: string }, ctx: DomainContext<Actor, Source>) {
    const authorId = await ctx.ids.number('authors')

    await this.collections.author.create({ authorId, name: params.name })

    return authorId
  }

  async add(params: { text: string; authorId: number }, ctx: DomainContext<Actor, Source>) {
    const noteId = await ctx.ids.number('notes')

    await this.collections.note.create({
      noteId,
      text: params.text,
      status: 'draft',
      createdAt: ctx.at,
      authorId: params.authorId
    })

    return noteId
  }

  async publish(params: { noteId: number }) {
    await this.collections.note.update(params.noteId, (draft) => {
      draft.status = 'published'
    })
  }

  async remove(params: { noteId: number }) {
    await this.collections.note.remove(params.noteId)
  }

  async whoami(_params: {}, ctx: DomainContext<Actor, Source>) {
    return { actor: ctx.actor, today: ctx.today }
  }

  /** Пишет и падает — частичная запись (номер из счётчика записью не считается). */
  async addBroken(params: { text: string; authorId: number }, ctx: DomainContext<Actor, Source>) {
    await this.add(params, ctx)
    throw new Error('after write')
  }
}

export const domains = { notes: NotesDomain }

export const source = () => new DataSource(scheme, { createDriver: createMemoryDriver })

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

export const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))

/** Журнал на базовом драйвере: события копятся в `events` и уходят слушателям потока. */
export const createJournal = () => {
  const events: DomainEvent[] = []
  const partial: PartialWrite[] = []
  const stream = new Set<(event: DomainEvent) => void>()
  const serverSource = source()

  const server = createServerShell(domains, serverSource, {
    counterCollection: 'counter',
    resolveActor: (name: string): Actor => {
      if (name === 'чужой') {
        throw new DomainError('forbidden', 'нет доступа')
      }

      return { name }
    },
    today: () => '2026-01-01',
    broadcast: (event) => {
      events.push(clone(event))
      stream.forEach((listener) => listener(clone(event)))
    },
    onPartialWrite: (info) => partial.push(info)
  })

  return { server, serverSource, events, partial, stream }
}
