/**
 * Общий пример тестов рантайма и клиента: маленькая схема заметок, домен и рантайм над in-memory драйвером. Отдельным файлом
 * рядом с тестами, а не в `@oxeo/devkit`: его модели попали бы в одно хранилище метаданных с макетной схемой.
 */
import { createMemoryDriver } from '@oxeo-drivers/memory'
import {
  Collections,
  DataScheme,
  DomainContext,
  DomainError,
  DomainEvent,
  IdSource,
  Identifier,
  Model,
  Prop,
  ReferenceTo,
  ViewContext,
  createDomainsParams,
  createViewsParams,
  defineCollection,
  schemaOf
} from '@oxeo/scheme'
import { DataSource, DomainRuntime, PartialWrite } from '../lib'

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
  constructor(
    private collections: Collections<Scheme>,
    private ids: IdSource<Source>
  ) {}

  async addAuthor(params: { name: string }) {
    const authorId = await this.ids.number('authors')

    await this.collections.author.create({ authorId, name: params.name })

    return authorId
  }

  async add(params: { text: string; authorId: number }, ctx: DomainContext<Actor>) {
    const noteId = await this.ids.number('notes')

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

  async whoami(_params: {}, ctx: DomainContext<Actor>) {
    return { actor: ctx.actor, today: ctx.today }
  }

  /** Пишет и падает — частичная запись (номер из счётчика записью не считается). */
  async addBroken(params: { text: string; authorId: number }, ctx: DomainContext<Actor>) {
    await this.add(params, ctx)
    throw new Error('after write')
  }

  /** Помощник: `private` в рантайме не виден, закрывает его только отсутствие схемы. */
  private async hidden() {
    return 'скрытое'
  }
}

export const domains = { notes: NotesDomain }

export const params = createDomainsParams<typeof domains>({
  notes: {
    addAuthor: schemaOf(AuthorEntity).pick({ name: true }),
    add: schemaOf(NoteEntity).pick({ text: true, authorId: true }),
    publish: schemaOf(NoteEntity).pick({ noteId: true }),
    remove: schemaOf(NoteEntity).pick({ noteId: true }),
    whoami: schemaOf(NoteEntity).pick({}),
    addBroken: schemaOf(NoteEntity).pick({ text: true, authorId: true })
  }
})

/** Сколько раз представления считались: кэш рантайма не должен считать их снова. */
export const viewRuns = { count: 0 }

class NotesViews {
  constructor(private collections: Collections<Scheme>) {}

  /** Сводка автора: имя, черновики и опубликованные; кто смотрит — из контекста. */
  async summary(params: { authorId: number }, ctx: ViewContext<Actor>) {
    const notes = await this.collections.note.findBy({ authorId: params.authorId })
    const author = await this.collections.author.get(params.authorId)

    viewRuns.count += 1

    return {
      author: author?.name ?? null,
      drafts: notes.filter((note) => note.status === 'draft').length,
      published: notes.filter((note) => note.status === 'published').length,
      viewer: ctx.actor?.name ?? null
    }
  }

  /** Представление не пишет: запись — отказ. */
  async broken(params: { noteId: number }) {
    await this.collections.note.remove(params.noteId)
  }
}

export const views = { notes: NotesViews }

export const viewParams = createViewsParams<typeof views>({
  notes: {
    summary: schemaOf(NoteEntity).pick({ authorId: true }),
    broken: schemaOf(NoteEntity).pick({ noteId: true })
  }
})

export const source = () => new DataSource(scheme, { createDriver: createMemoryDriver })

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

export const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))

/** Рантайм на базовом драйвере: события копятся в `events` и уходят слушателям потока. */
export const createRuntime = () => {
  const events: DomainEvent[] = []
  const partial: PartialWrite[] = []
  const stream = new Set<(event: DomainEvent) => void>()
  const serverSource = source()

  const runtime = new DomainRuntime({
    domains,
    params,
    views,
    viewParams,
    dataSource: serverSource,
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

  return { runtime, serverSource, events, partial, stream }
}
