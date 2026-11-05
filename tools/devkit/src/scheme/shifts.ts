import { DateFormat, TimeFormat } from '@companix/utils-js'
import { AppKey, AppKeys } from './keys'
import {
  Identifier,
  Model,
  Prop,
  ReferenceTo,
  ReferenceSet,
  Ownership,
  ModelToModel
} from '@oxeo/scheme'
import { WorkerEntities } from './workers'
import { ProjectEntities } from './projects'
import { ClientEntities } from './clients'
import { DictionaryEntities } from './dictionary'
import { ChatEntities } from './chat'

export namespace ShiftStageSchemas {
  export interface Recruiting {
    type: 'recruiting' // created, registration, completed
  }

  export interface Reminding {
    type: 'reminding'
    currentStage: AppKey.Confirmed | null
    stageExpiration: number
  }

  export interface Inventory {
    type: 'inventory'
  }

  export interface Completed {
    type: 'completed'
  }

  export interface Payed {
    type: 'payed'
  }

  export interface Canceled {
    type: 'canceled'
    reason: string
  }
}

// prettier-ignore
export type ShiftStageSchema = ShiftStageSchemas.Recruiting | ShiftStageSchemas.Reminding | ShiftStageSchemas.Inventory | ShiftStageSchemas.Completed | ShiftStageSchemas.Payed | ShiftStageSchemas.Canceled

// // schema

export interface Paid {
  amount: number
  method: AppKey.PaymentMethod
}

export interface EventLog {
  text: string
  timestamp: number
}

export namespace ShiftEntities {
  @Model({ name: 'Seat' })
  export class Seat {
    @Identifier({ type: 'string' })
    seatId: string

    @Prop({ type: 'number' })
    assignTime: number

    // StoreFallback заботится о том, чтобы при создании данной сущности, были автоматически проставленны ссылки на нее во владеющей сущности
    // также при удалении данной сущности, ссылки во владеющей сущности будут автоматически удалены.
    // StoreFallback блокирует удаление владеющей сущности, так как это приведет к удалению данной сущности (поведение можно настроить)
    @Ownership.BelongsTo(() => WorkerEntities.RevisorProfile, (worker) => worker.seats) // TEST: что, если это будет глубокий параметр из дискриминированных полей (при том что здесь можно указать и общее - модель то одна)
    revisorId: WorkerEntities.RevisorProfile['workerId']

    @Ownership.BelongsTo(() => Shift, (shift) => shift.seats)
    shiftId: Shift['shiftId']

    @ModelToModel.Owner(() => ChatEntities.SeatChat, (chat) => chat.seatId)
    chatId: ChatEntities.SeatChat['chatId']

    @Prop({ type: 'json', nullable: true })
    paid: Paid | null

    @ReferenceTo(() => WorkerEntities.OfficeProfile, { onRefDeleting: 'set-null' })
    subManagerId: WorkerEntities.OfficeProfile['workerId'] | null

    @Prop({ type: 'literal', values: ['reserve', 'assigned'] })
    status: 'reserve' | 'assigned'

    @Prop({ type: 'literal', values: AppKeys.Confirmed, nullable: true })
    confirmed: AppKey.Confirmed | null

    @Prop({ type: 'literal', values: AppKeys.Attendance, nullable: true })
    attendance: AppKey.Attendance | null
  }

  @Model({ name: 'Shift' })
  export class Shift {
    @Identifier({ type: 'number' })
    shiftId: number

    @ReferenceTo(() => ProjectEntities.Project)
    projectId: ProjectEntities.Project['projectId'] // -> выбрав проект, в UI подгружается информация о нем и о клиенте

    @ReferenceTo(() => ClientEntities.Location)
    locationId: ClientEntities.Location['locationId'] // -> выбрав объект (из списка доступных в проекте), в UI подгружается информация об объекте

    @Prop({ type: 'number' })
    revisorRate: number

    @Prop({ type: 'number' })
    revisorsCount: number

    @Prop({ type: 'string' })
    comment: string

    @Prop({ type: 'string' })
    adname: string

    @Prop({ type: 'json' })
    stage: ShiftStageSchema

    @ReferenceSet(() => DictionaryEntities.Option)
    extra_rates: DictionaryEntities.Option['value'][]

    @ReferenceSet(() => DictionaryEntities.Option)
    equipments: DictionaryEntities.Option['value'][]

    @ReferenceSet(() => DictionaryEntities.Option)
    type_of_work: DictionaryEntities.Option['value'][]

    @Prop({ type: 'json' })
    date: DateFormat

    @Prop({ type: 'json' })
    startTime: TimeFormat

    @Prop({ type: 'json' })
    endTime: TimeFormat

    @Prop({ type: 'literal', values: AppKeys.TypeOfShift })
    typeOfShift: AppKey.TypeOfShift

    @Prop({ type: 'array', itemType: 'json' })
    logs: EventLog[]

    @Prop({ type: 'boolean' })
    isAttendanceCommited: boolean

    @Prop({ type: 'enum', values: AppKeys.RevisorRoles })
    enabledRevisorRoles: AppKey.RevisorRoles[]

    @Ownership.HasMany(() => Seat, (seat) => seat.shiftId, { cleanupBehavior: 'cascade' })
    seats: Seat['seatId'][]

    @ModelToModel.Owner(() => ChatEntities.NoteChat, (chat) => chat.shiftId)
    chatId: ChatEntities.NoteChat['chatId']
  }
}
