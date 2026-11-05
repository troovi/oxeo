import {
  LinkEmbedded,
  Embedded,
  Discriminator,
  DiscriminatedModel,
  Identifier,
  Model,
  Ownership,
  ReferenceSet,
  Prop
} from '@oxeo/scheme'
import { AppKey, AppKeys } from './keys'
import { DateFormat, FileFormat } from '@companix/utils-js'
import { RoleEntities } from './roles'
import { ShiftEntities } from './shifts'
import { DictionaryEntities } from './dictionary'

export namespace WorkerEntities {
  @Embedded(() => Contacts, (worker) => worker.film)
  export class Film {
    @Prop({ type: 'string' })
    anime: string

    @Prop({ type: 'boolean' })
    isTheater: boolean

    @ReferenceSet(() => DictionaryEntities.Option)
    actors: DictionaryEntities.Option['value'][]
  }

  @Embedded(() => BaseWorker, (worker) => worker.contacts)
  export class Contacts {
    @Prop({ type: 'string' })
    phone_base: string

    @Prop({ type: 'boolean' })
    phone_base_verified: boolean

    // extra phone
    @Prop({ type: 'string' })
    phone_extra: string

    @Prop({ type: 'boolean' })
    phone_extra_verified: boolean

    // whatsapp
    @Prop({ type: 'string' })
    whatsapp_phone: string

    @Prop({ type: 'boolean' })
    whatsapp_verified: boolean

    // viber
    @Prop({ type: 'string' })
    viber_phone: string

    @Prop({ type: 'boolean' })
    viber_verified: boolean

    // telegram
    @Prop({ type: 'string' })
    telegram_nickname: string

    @Prop({ type: 'string' })
    telegram_phone: string

    @Prop({ type: 'boolean' })
    telegram_phone_verified: boolean

    @LinkEmbedded(Film)
    film: Film
  }

  @Embedded(() => BaseWorker, (worker) => worker.about)
  export class About {
    @Prop({ type: 'number', nullable: true })
    height: number | null

    @Prop({ type: 'string' })
    shoe_size: string

    @Prop({ type: 'string' })
    clothing_size: string

    @ReferenceSet(() => DictionaryEntities.Option)
    regions: DictionaryEntities.Option['value'][]

    @ReferenceSet(() => DictionaryEntities.Option)
    kind_of_work: DictionaryEntities.Option['value'][]

    @ReferenceSet(() => DictionaryEntities.Option)
    employments: DictionaryEntities.Option['value'][]
  }

  @Embedded(() => BaseWorker, (worker) => worker.documents)
  export class Documents {
    @Prop({ type: 'literal', values: AppKeys.Citizenship, nullable: true })
    citizenship: AppKey.Citizenship | null

    @Prop({ type: 'string' })
    passport_number: string

    @Prop({ type: 'string' })
    passport_serial: string

    @Prop({ type: 'string' })
    passport_issued_by: string

    @Prop({ type: 'json', nullable: true })
    passport_issued_date: DateFormat | null

    @Prop({ type: 'string' })
    place_of_birth: string

    @Prop({ type: 'string' })
    registration_place: string

    @Prop({ type: 'string' })
    inn: string

    @Prop({ type: 'string' })
    snils: string
  }

  // detail

  @Model({ name: 'BankDetail' })
  export class BankDetail {
    @Identifier({ type: 'string' })
    detailId: string

    @Prop({ type: 'string' })
    recipient_name: string

    @Prop({ type: 'string' })
    bank_name: string

    @Prop({ type: 'string' })
    recipient_count: string

    @Prop({ type: 'string' })
    kor: string

    @Prop({ type: 'string' })
    bik: string

    @Prop({ type: 'string' })
    kpp: string

    @Prop({ type: 'string' })
    inn: string

    @Prop({ type: 'number' })
    createdAt: number
  }

  // card

  @Model({ name: 'BankCard' })
  export class BankCard {
    @Identifier({ type: 'string' })
    cardId: string

    @Prop({ type: 'string' })
    bank_name: string

    @Prop({ type: 'string' })
    bank_card_number: string

    @Prop({ type: 'string' })
    comment: string

    @Prop({ type: 'boolean' })
    is_default_card: boolean

    @Prop({ type: 'json' })
    image: FileFormat

    @Prop({ type: 'number' })
    createdAt: number
  }

  // scan

  @Model({ name: 'Scan' })
  export class Scan {
    @Identifier({ type: 'string' })
    scanId: string

    @Prop({ type: 'string' })
    name: string

    @Prop({ type: 'json' })
    file: FileFormat

    @Prop({ type: 'number' })
    createdAt: number
  }

  // worker

  export class Info {
    @Prop({ type: 'json' })
    avatar: FileFormat

    @Prop({ type: 'string' })
    name: string

    @Prop({ type: 'string' })
    surname: string

    @Prop({ type: 'string' })
    patronymic: string

    @Prop({ type: 'string', email: true })
    email: string

    @Prop({ type: 'literal', values: AppKeys.Sex })
    sex: AppKey.Sex

    @Prop({ type: 'literal', values: AppKeys.WorkerStatus })
    status: AppKey.WorkerStatus

    @Prop({ type: 'json' })
    date_birth: DateFormat

    @Prop({ type: 'json' })
    date_employ: DateFormat
  }

  @DiscriminatedModel({ name: 'Worker', discriminatorKey: 'type' })
  export class BaseWorker extends Info {
    @Identifier({ type: 'number' })
    workerId: number

    @Prop({ type: 'literal', values: ['office', 'revisor'] })
    type: 'office' | 'revisor'

    @Prop({ type: 'number', nullable: true })
    tgid: number | null

    @Prop({ type: 'number' })
    createdAt: number

    // submodels

    @LinkEmbedded(Contacts)
    contacts: Contacts

    @LinkEmbedded(Documents)
    documents: Documents

    @LinkEmbedded(About)
    about: About

    // connections:

    @ReferenceSet(() => Scan, { cascadeCleanup: true })
    scans: Scan['scanId'][]

    @ReferenceSet(() => BankCard, { cascadeCleanup: true })
    bank_cards: BankCard['cardId'][]

    @ReferenceSet(() => BankDetail, { cascadeCleanup: true })
    bank_details: BankDetail['detailId'][]
  }

  @Discriminator('office')
  export class OfficeProfile extends BaseWorker {
    // @ts-ignore
    type: 'office'

    @Prop({ type: 'string' })
    password: string

    @ReferenceSet(() => RoleEntities.Role)
    roles: RoleEntities.Role['value'][]
  }

  @Discriminator('revisor')
  export class RevisorProfile extends BaseWorker {
    // @ts-ignore
    type: 'revisor'

    @Prop({ type: 'string' })
    password: string

    @Prop({ type: 'literal', values: AppKeys.RevisorRoles })
    revisor_role: AppKey.RevisorRoles

    @Prop({ type: 'literal', values: AppKeys.JobType })
    job_type: AppKey.JobType

    @Ownership.HasMany(() => ShiftEntities.Seat, (seat) => seat.revisorId)
    seats: ShiftEntities.Seat['seatId'][]
  }
}
