/**
 * Общий пример тестов рантайма и стенда: маленькая схема заметок, типы проекта в `Register`, домен, представления и
 * сервис над токенами `Collections` и `Ids`, рантайм над in-memory драйвером. Отдельным файлом рядом с тестами, а не в
 * `@oxeo/devkit`: его модели попали бы в одно хранилище метаданных с макетной схемой.
 */
import { createMemoryDriver } from '@oxeo-drivers/memory'
import {
  Allow,
  Collections,
  DataScheme,
  DomainContext,
  DomainError,
  DomainEvent,
  Identifier,
  Ids,
  Model,
  Params,
  Prop,
  ReferenceTo,
  System,
  ViewContext,
  defineCollection,
  schemaOf
} from '@oxeo/scheme'
import { Domain, Service, View } from '@oxeo/scheme/di'
import { DataSource, DomainRuntime, PartialWrite, QueryFailure } from '../lib'

export type Source = 'notes' | 'authors'

export type Role = 'editor' | 'reader' | 'admin'

export const ROLE_LABELS: Record<Role, string> = {
  editor: 'Редактор',
  reader: 'Читатель',
  admin: 'Администратор'
}

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

export const scheme = new DataScheme({
  counter: defineCollection(CounterEntity, 'source'),
  author: defineCollection(AuthorEntity, 'authorId'),
  note: defineCollection(NoteEntity, 'noteId')
})

export type Scheme = typeof scheme extends DataScheme<infer S> ? S : never

export interface Actor {
  name: string
  roles: Role[]
}

declare module '@oxeo/scheme' {
  interface Register {
    scheme: Scheme
    actor: Actor
    counters: Source
    roles: Role
  }
}

/** Сервис заметок: его получают и домен, и представления — каждый в своей области. */
@Service()
export class NotesService {
  constructor(private collections: Collections) {}

  /** Заметки автора. */
  async notesOf(authorId: number) {
    return this.collections.note.findBy({ authorId })
  }

  /** Удаление заметки: из представления — отказ. */
  async removeNote(noteId: number) {
    await this.collections.note.remove(noteId)
  }
}

@Domain()
export class NotesDomain {
  constructor(
    private collections: Collections,
    private ids: Ids,
    readonly notesService: NotesService
  ) {}

  @Params(schemaOf(AuthorEntity).pick({ name: true }))
  async addAuthor(params: { name: string }) {
    const authorId = await this.ids.number('authors')

    await this.collections.author.create({ authorId, name: params.name })

    return authorId
  }

  @Params(schemaOf(NoteEntity).pick({ text: true, authorId: true }))
  async add(params: { text: string; authorId: number }, ctx: DomainContext) {
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

  @Params(schemaOf(NoteEntity).pick({ noteId: true }))
  async publish(params: { noteId: number }) {
    await this.collections.note.update(params.noteId, (draft) => {
      draft.status = 'published'
    })
  }

  @Params(schemaOf(NoteEntity).pick({ noteId: true }))
  async remove(params: { noteId: number }) {
    await this.notesService.removeNote(params.noteId)
  }

  @Params(schemaOf(NoteEntity).pick({}))
  async whoami(_params: {}, ctx: DomainContext) {
    return { actor: ctx.actor, today: ctx.today }
  }

  /** Пишет и падает — частичная запись (номер из счётчика записью не считается). */
  @Params(schemaOf(NoteEntity).pick({ text: true, authorId: true }))
  async addBroken(params: { text: string; authorId: number }, ctx: DomainContext) {
    await this.add(params, ctx)
    throw new Error('after write')
  }

  /** Новый текст заметки — только редактору. */
  @Allow('editor')
  @Params(schemaOf(NoteEntity).pick({ noteId: true, text: true }))
  async rename(params: { noteId: number; text: string }) {
    await this.collections.note.update(params.noteId, (draft) => {
      draft.text = params.text
    })
  }

  /** Служебная операция — только система. */
  @System('Сверку запускает только система')
  @Params(schemaOf(NoteEntity).pick({}))
  async reconcile(_params: {}) {
    return 'сверено'
  }

  /** Помощник: `private` в рантайме виден, закрывает его только отсутствие схемы. */
  private async hidden() {
    return 'скрытое'
  }
}

export const domains = { notes: NotesDomain }

/** Сколько раз представления считались: кэш рантайма не должен считать их снова. */
export const viewRuns = { count: 0 }

/** Экземпляры, на которых считались представления, — по расчёту. */
export const viewInstances: NotesView[] = []

@View()
export class NotesView {
  constructor(
    private collections: Collections,
    readonly notesService: NotesService
  ) {}

  /** Сводка автора: имя, черновики и опубликованные — заметки читает сервис; кто смотрит — из контекста. */
  @Params(schemaOf(NoteEntity).pick({ authorId: true }))
  async summary(params: { authorId: number }, ctx: ViewContext) {
    const notes = await this.notesService.notesOf(params.authorId)
    const author = await this.collections.author.get(params.authorId)

    viewRuns.count += 1
    viewInstances.push(this)

    return {
      author: author?.name ?? null,
      drafts: notes.filter((note) => note.status === 'draft').length,
      published: notes.filter((note) => note.status === 'published').length,
      viewer: ctx.actor?.name ?? null
    }
  }

  /** Представление не пишет, и сервис в нём тоже: запись — отказ. */
  @Params(schemaOf(NoteEntity).pick({ noteId: true }))
  async broken(params: { noteId: number }) {
    await this.notesService.removeNote(params.noteId)
  }

  /** Упавшее представление — непредвиденная ошибка расчёта. */
  @Params(schemaOf(NoteEntity).pick({}))
  async crash(_params: {}) {
    const missing = (await this.collections.author.get(404)) as { name: string }

    return missing.name
  }
}

export const views = { notes: NotesView }

export const source = () => new DataSource(scheme, { createDriver: createMemoryDriver })

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

export const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))

/** Рантайм на базовом драйвере: события копятся в `events` и уходят слушателям потока. */
export const createRuntime = () => {
  const events: DomainEvent[] = []
  const partial: PartialWrite[] = []
  const queryErrors: QueryFailure[] = []
  const stream = new Set<(event: DomainEvent) => void>()
  const serverSource = source()

  const runtime = new DomainRuntime({
    domains,
    views,
    dataSource: serverSource,
    counterCollection: 'counter',
    resolveActor: (name: string): Actor => {
      if (name === 'чужой') {
        throw new DomainError('forbidden', 'нет доступа')
      }

      return { name, roles: name === 'редактор' ? ['editor'] : [] }
    },
    access: { rolesOf: (actor) => actor.roles, labelOf: (role) => ROLE_LABELS[role] },
    today: () => '2026-01-01',
    broadcast: (event) => {
      events.push(clone(event))
      stream.forEach((listener) => listener(clone(event)))
    },
    onPartialWrite: (info) => partial.push(info),
    onQueryError: (info) => queryErrors.push(info)
  })

  return { runtime, serverSource, events, partial, queryErrors, stream }
}
