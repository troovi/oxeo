/**
 * Схема песочницы — маленький срез CRM со всеми видами связей xeo: дискриминированная модель с
 * embedded-блоком (сотрудник), `ReferenceTo` (клиент → менеджер, проект → клиент, смена → проект,
 * участник → сотрудник, сотрудник → гражданство с `set-null`), `ReferenceSet` (кадровики проекта, регионы
 * сотрудника), пары `HasMany`/`BelongsTo` с каскадом (смена ⊃ участники, справочник ⊃ значения),
 * embedded статистики смены и счётчики номеров. Поля — минимум, нужный доменам и экрану.
 */
import {
  DataScheme,
  DiscriminatedModel,
  Discriminator,
  Embedded,
  Identifier,
  InferScheme,
  LinkEmbedded,
  Model,
  Ownership,
  Prop,
  ReferenceSet,
  ReferenceTo,
  defineCollection,
  defineDiscriminatedCollection
} from '../lib'
import { AppKey, AppKeys } from './keys'

export namespace DictionaryEntities {
  /**
   * Значение справочника, как в CRM: `value` — сгенерированный идентификатор, общий для всех словарей. Удаление
   * снимает значение с записей: из набора ссылка уходит, одиночная ссылка становится `null`.
   */
  @Model({ name: 'Option' })
  export class Option {
    @Identifier({ type: 'string' })
    value: string

    /** Словарь-владелец значения. */
    @Ownership.BelongsTo(() => Dictionary, (dictionary) => dictionary.options)
    dictionary: AppKey.Dictionary

    @Prop({ type: 'string' })
    title: string
  }

  /** Справочник: ключ из фиксированного перечня `AppKeys.Dictionary`, владеет значениями каскадом. */
  @Model({ name: 'Dictionary' })
  export class Dictionary {
    @Identifier({ type: 'string' })
    dictionary: AppKey.Dictionary

    @Prop({ type: 'string' })
    name: string

    @Ownership.HasMany(() => Option, (option) => option.dictionary, {
      cleanupBehavior: 'cascade'
    })
    options: Option['value'][]
  }
}

export namespace WorkerEntities {
  @Embedded(() => BaseWorker, (worker) => worker.contacts)
  export class Contacts {
    @Prop({ type: 'string' })
    phone: string

    @Prop({ type: 'string' })
    email: string
  }

  /** Сотрудник: офисный с должностями или ревизор с категорией. */
  @DiscriminatedModel({ name: 'Worker', discriminatorKey: 'type' })
  export class BaseWorker {
    @Identifier({ type: 'number' })
    workerId: number

    @Prop({ type: 'literal', values: AppKeys.WorkerType })
    type: AppKey.WorkerType

    @Prop({ type: 'string' })
    name: string

    @Prop({ type: 'literal', values: AppKeys.WorkerStatus })
    status: AppKey.WorkerStatus

    @Prop({ type: 'number' })
    createdAt: number

    @LinkEmbedded(Contacts)
    contacts: Contacts

    /** Регионы работы — значения справочника `regions`; удалённое значение уходит из набора. */
    @ReferenceSet(() => DictionaryEntities.Option)
    regionIds: DictionaryEntities.Option['value'][]

    /** Гражданство — значение справочника `citizenships`; удаление значения оставляет `null`. */
    @ReferenceTo(() => DictionaryEntities.Option, { onRefDeleting: 'set-null' })
    citizenshipId: DictionaryEntities.Option['value'] | null
  }

  @Discriminator('office')
  export class OfficeProfile extends BaseWorker {
    // @ts-ignore — фиксируем дискриминатор
    type: 'office'

    @Prop({ type: 'enum', values: AppKeys.Position })
    positions: AppKey.Position[]
  }

  @Discriminator('revisor')
  export class RevisorProfile extends BaseWorker {
    // @ts-ignore — фиксируем дискриминатор
    type: 'revisor'

    @Prop({ type: 'literal', values: AppKeys.Category })
    category: AppKey.Category
  }

  export type Worker = OfficeProfile | RevisorProfile
}

export namespace ClientEntities {
  @Model({ name: 'Client' })
  export class Client {
    @Identifier({ type: 'number' })
    clientId: number

    @Prop({ type: 'string' })
    name: string

    /** Менеджер клиента — офисный сотрудник; удаление сотрудника с клиентами запрещено. */
    @ReferenceTo(() => WorkerEntities.BaseWorker)
    managerId: WorkerEntities.BaseWorker['workerId']

    @Prop({ type: 'number' })
    createdAt: number
  }
}

export namespace ProjectEntities {
  @Model({ name: 'Project' })
  export class Project {
    @Identifier({ type: 'number' })
    projectId: number

    @Prop({ type: 'string' })
    name: string

    @ReferenceTo(() => ClientEntities.Client)
    clientId: ClientEntities.Client['clientId']

    @Prop({ type: 'literal', values: AppKeys.ProjectStage })
    stage: AppKey.ProjectStage

    /** Кадровики по набору — набор ссылок; удалённый сотрудник из набора исчезает (`unlink`). */
    @ReferenceSet(() => WorkerEntities.BaseWorker)
    recruiterIds: WorkerEntities.BaseWorker['workerId'][]

    @Prop({ type: 'number' })
    createdAt: number

    @Prop({ type: 'number', nullable: true })
    completedAt: number | null
  }
}

export namespace ShiftEntities {
  /** Итоги завершённой смены; до завершения — `null`. */
  @Embedded(() => Shift, (shift) => shift.stats)
  export class Stats {
    @Prop({ type: 'number', nullable: true })
    attended: number | null

    @Prop({ type: 'number', nullable: true })
    total: number | null
  }

  /** Человек на смене: отклик, явка и начисление. Удаляется вместе со сменой. */
  @Model({ name: 'Participant' })
  export class Participant {
    @Identifier({ type: 'string' })
    participantId: string

    @Ownership.BelongsTo(() => Shift, (shift) => shift.participantIds)
    shiftId: Shift['shiftId']

    @ReferenceTo(() => WorkerEntities.BaseWorker)
    workerId: WorkerEntities.BaseWorker['workerId']

    @Prop({ type: 'literal', values: AppKeys.Role })
    role: AppKey.Role

    @Prop({ type: 'literal', values: AppKeys.Attendance, nullable: true })
    attendance: AppKey.Attendance | null

    @Prop({ type: 'number', nullable: true })
    earned: number | null

    @Prop({ type: 'number' })
    addedAt: number
  }

  /** Смена проекта: дата, план и ставка, стадия со штампами, состав — `participantIds`. */
  @Model({ name: 'Shift' })
  export class Shift {
    @Identifier({ type: 'number' })
    shiftId: number

    @ReferenceTo(() => ProjectEntities.Project)
    projectId: ProjectEntities.Project['projectId']

    /** Дата смены `YYYY-MM-DD`. */
    @Prop({ type: 'string' })
    date: string

    @Prop({ type: 'literal', values: AppKeys.ShiftStage })
    stage: AppKey.ShiftStage

    /** План ревизоров. */
    @Prop({ type: 'number' })
    plan: number

    /** Ставка ревизора за смену, ₽. */
    @Prop({ type: 'number' })
    rate: number

    @Prop({ type: 'string', nullable: true })
    cancelReason: string | null

    @Prop({ type: 'number' })
    createdAt: number

    @Prop({ type: 'number', nullable: true })
    completedAt: number | null

    @LinkEmbedded(Stats)
    stats: Stats

    @Ownership.HasMany(() => Participant, (participant) => participant.shiftId, {
      cleanupBehavior: 'cascade'
    })
    participantIds: Participant['participantId'][]
  }
}

/** Счётчик числовых идентификаторов: `source` — источник, `seq` — последний выданный номер. */
@Model({ name: 'Counter' })
export class CounterEntity {
  @Identifier({ type: 'string' })
  source: AppKey.CounterSource

  @Prop({ type: 'number' })
  seq: number
}

export const dataScheme = new DataScheme({
  dictionary: defineCollection(DictionaryEntities.Dictionary, 'dictionary'),
  option: defineCollection(DictionaryEntities.Option, 'value'),
  worker: defineDiscriminatedCollection({
    baseScheme: WorkerEntities.BaseWorker,
    discriminators: [WorkerEntities.OfficeProfile, WorkerEntities.RevisorProfile],
    discriminatorKey: 'type',
    identifier: 'workerId'
  }),
  client: defineCollection(ClientEntities.Client, 'clientId'),
  project: defineCollection(ProjectEntities.Project, 'projectId'),
  shift: defineCollection(ShiftEntities.Shift, 'shiftId'),
  participant: defineCollection(ShiftEntities.Participant, 'participantId'),
  counter: defineCollection(CounterEntity, 'source')
})

export type AppScheme = InferScheme<typeof dataScheme>
