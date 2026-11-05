import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmptyObject,
  IsNumber,
  IsObject,
  IsString,
  ValidateIf,
  ValidateNested
} from 'class-validator'
import type { DateFormat, FileFormat } from '@companix/utils-js'
import { WorkerEntities, DictionaryEntities, RoleEntities, AppKey, AppKeys } from '@oxeo/devkit'

export class DateFormatDto implements DateFormat {
  @IsNumber()
  year: number

  @IsNumber()
  month: number

  @IsNumber()
  day: number
}

export class FilmDto implements WorkerEntities.Film {
  @IsString()
  anime: string

  @IsBoolean()
  isTheater: boolean

  @IsArray()
  @IsString({ each: true })
  actors: string[]
}

export class ContactsDto implements WorkerEntities.Contacts {
  @IsString()
  phone_base: string

  @IsBoolean()
  phone_base_verified: boolean

  @IsString()
  phone_extra: string

  @IsBoolean()
  phone_extra_verified: boolean

  @IsString()
  whatsapp_phone: string

  @IsBoolean()
  whatsapp_verified: boolean

  @IsString()
  viber_phone: string

  @IsBoolean()
  viber_verified: boolean

  @IsString()
  telegram_nickname: string

  @IsString()
  telegram_phone: string

  @IsBoolean()
  telegram_phone_verified: boolean

  @ValidateNested()
  @Type(() => FilmDto)
  film: FilmDto
}

export class AboutDto implements WorkerEntities.About {
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  height: number | null

  @IsString()
  shoe_size: string

  @IsString()
  clothing_size: string

  @IsArray()
  @IsString({ each: true })
  regions: string[]

  @IsArray()
  @IsString({ each: true })
  kind_of_work: string[]

  @IsArray()
  @IsString({ each: true })
  employments: string[]
}

export class DocumentsDto implements WorkerEntities.Documents {
  @ValidateIf((_, value) => value !== null)
  @IsIn(AppKeys.Citizenship)
  citizenship: AppKey.Citizenship | null

  @IsString()
  passport_number: string

  @IsString()
  passport_serial: string

  @IsString()
  passport_issued_by: string

  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => DateFormatDto)
  passport_issued_date: DateFormat | null

  @IsString()
  place_of_birth: string

  @IsString()
  registration_place: string

  @IsString()
  inn: string

  @IsString()
  snils: string
}

export class WorkerBaseDto implements WorkerEntities.BaseWorker {
  @IsNumber()
  workerId: number

  @IsIn(['office', 'revisor'])
  type: 'office' | 'revisor'

  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  tgid: number | null

  @IsNumber()
  createdAt: number

  @IsObject()
  avatar: FileFormat

  @IsString()
  name: string

  @IsString()
  surname: string

  @IsString()
  patronymic: string

  @IsEmail()
  email: string

  @IsIn(AppKeys.Sex)
  sex: AppKey.Sex

  @IsIn(AppKeys.WorkerStatus)
  status: AppKey.WorkerStatus

  @ValidateNested()
  @Type(() => DateFormatDto)
  date_birth: DateFormat

  @ValidateNested()
  @Type(() => DateFormatDto)
  date_employ: DateFormat

  @ValidateNested()
  @Type(() => ContactsDto)
  contacts: ContactsDto

  @ValidateNested()
  @Type(() => DocumentsDto)
  documents: DocumentsDto

  @ValidateNested()
  @Type(() => AboutDto)
  about: AboutDto

  @IsArray()
  @IsString({ each: true })
  scans: string[]

  @IsArray()
  @IsString({ each: true })
  bank_cards: string[]

  @IsArray()
  @IsString({ each: true })
  bank_details: string[]
}

export class OfficeProfileDto extends WorkerBaseDto implements WorkerEntities.OfficeProfile {
  @IsIn(['office'])
  type: 'office' = 'office'

  @IsString()
  password: string

  @IsArray()
  @IsString({ each: true })
  roles: RoleEntities.Role['value'][]
}

export class RevisorProfileDto extends WorkerBaseDto implements WorkerEntities.RevisorProfile {
  @IsIn(['revisor'])
  type: 'revisor' = 'revisor'

  @IsString()
  password: string

  @IsIn(AppKeys.RevisorRoles)
  revisor_role: AppKey.RevisorRoles

  @IsIn(AppKeys.JobType)
  job_type: AppKey.JobType

  seats: string[]
}

export class CreateWorkerDto {
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => WorkerBaseDto, {
    discriminator: {
      property: 'type',
      subTypes: [
        { name: 'office', value: OfficeProfileDto },
        { name: 'revisor', value: RevisorProfileDto }
      ]
    },
    keepDiscriminatorProperty: true
  })
  worker: OfficeProfileDto | RevisorProfileDto
}

export class ScanDto implements WorkerEntities.Scan {
  @IsString()
  scanId: string

  @IsString()
  name: string

  @IsObject()
  file: FileFormat

  @IsNumber()
  createdAt: number
}

export class CreateScanDto {
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => ScanDto)
  scan: ScanDto
}

export class BankCardDto implements WorkerEntities.BankCard {
  @IsString()
  cardId: string

  @IsString()
  bank_name: string

  @IsString()
  bank_card_number: string

  @IsString()
  comment: string

  @IsBoolean()
  is_default_card: boolean

  @IsObject()
  image: FileFormat

  @IsNumber()
  createdAt: number
}

export class CreateBankCardDto {
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => BankCardDto)
  bankCard: BankCardDto
}

export class BankDetailDto implements WorkerEntities.BankDetail {
  @IsString()
  detailId: string

  @IsString()
  recipient_name: string

  @IsString()
  bank_name: string

  @IsString()
  recipient_count: string

  @IsString()
  kor: string

  @IsString()
  bik: string

  @IsString()
  kpp: string

  @IsString()
  inn: string

  @IsNumber()
  createdAt: number
}

export class CreateBankDetailDto {
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => BankDetailDto)
  bankDetail: BankDetailDto
}

export class RoleDto implements RoleEntities.Role {
  @IsString()
  value: string

  @IsString()
  title: string

  @IsNumber()
  createdAt: number
}

export class CreateRoleDto {
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => RoleDto)
  role: RoleDto
}

export class DictionaryDto implements DictionaryEntities.Dictionary {
  @IsIn(AppKeys.Dictionaries)
  dictionary: AppKey.Dictionaries

  @IsString()
  name: string

  @IsArray()
  @IsString({ each: true })
  options: DictionaryEntities.Option['value'][]
}

export class CreateDictionaryDto {
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => DictionaryDto)
  dictionary: DictionaryDto
}

export class OptionDto implements DictionaryEntities.Option {
  @IsIn(AppKeys.Dictionaries)
  dictionary: AppKey.Dictionaries

  @IsString()
  value: string

  @IsString()
  title: string
}

export class CreateOptionDto {
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => OptionDto)
  option: OptionDto
}

export class UpdateOptionDto {
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => OptionDto)
  option: OptionDto
}
