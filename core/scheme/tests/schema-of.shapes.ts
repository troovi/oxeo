import { AppKeys } from '../../../tools/devkit/src/scheme/keys'
import { ShiftEntities } from '../../../tools/devkit/src/scheme/shifts'
import { WorkerEntities } from '../../../tools/devkit/src/scheme/workers'
import type { ExtractedSchemaShape } from './extract-schema-shape'

export const filmShape = {
  anime: 'string',
  isTheater: 'boolean',
  actors: { arrayOf: 'string' }
} as const satisfies ExtractedSchemaShape

export const contactsShape = {
  phone_base: 'string',
  phone_base_verified: 'boolean',
  phone_extra: 'string',
  phone_extra_verified: 'boolean',
  whatsapp_phone: 'string',
  whatsapp_verified: 'boolean',
  viber_phone: 'string',
  viber_verified: 'boolean',
  telegram_nickname: 'string',
  telegram_phone: 'string',
  telegram_phone_verified: 'boolean',
  film: filmShape
} as const satisfies ExtractedSchemaShape

export const documentsShape = {
  citizenship: {
    nullable: {
      enum: [...AppKeys.Citizenship]
    }
  },
  passport_number: 'string',
  passport_serial: 'string',
  passport_issued_by: 'string',
  passport_issued_date: { nullable: 'any' },
  place_of_birth: 'string',
  registration_place: 'string',
  inn: 'string',
  snils: 'string'
} as const satisfies ExtractedSchemaShape

export const aboutShape = {
  height: { nullable: 'number' },
  shoe_size: 'string',
  clothing_size: 'string',
  regions: { arrayOf: 'string' },
  kind_of_work: { arrayOf: 'string' },
  employments: { arrayOf: 'string' }
} as const satisfies ExtractedSchemaShape

export const infoShape = {
  avatar: 'any',
  name: 'string',
  surname: 'string',
  patronymic: 'string',
  email: 'string',
  sex: { enum: [...AppKeys.Sex] },
  status: { enum: [...AppKeys.WorkerStatus] },
  date_birth: 'any',
  date_employ: 'any'
} as const satisfies ExtractedSchemaShape

export const baseWorkerShape = {
  ...infoShape,
  workerId: 'number',
  type: { enum: ['office', 'revisor'] },
  tgid: { nullable: 'number' },
  createdAt: 'number',
  contacts: contactsShape,
  documents: documentsShape,
  about: aboutShape,
  scans: { arrayOf: 'string' },
  bank_cards: { arrayOf: 'string' },
  bank_details: { arrayOf: 'string' }
} as const satisfies ExtractedSchemaShape

export type SchemaShapeCase = readonly [
  label: string,
  entityClass: unknown,
  expectedShape: ExtractedSchemaShape
]

export const schemaShapeCases: SchemaShapeCase[] = [
  ['WorkerEntities.Film', WorkerEntities.Film, filmShape],
  ['WorkerEntities.Contacts', WorkerEntities.Contacts, contactsShape],
  ['WorkerEntities.About', WorkerEntities.About, aboutShape],
  ['WorkerEntities.Documents', WorkerEntities.Documents, documentsShape],
  [
    'WorkerEntities.BankDetail',
    WorkerEntities.BankDetail,
    {
      detailId: 'string',
      recipient_name: 'string',
      bank_name: 'string',
      recipient_count: 'string',
      kor: 'string',
      bik: 'string',
      kpp: 'string',
      inn: 'string',
      createdAt: 'number'
    }
  ],
  [
    'WorkerEntities.BankCard',
    WorkerEntities.BankCard,
    {
      cardId: 'string',
      bank_name: 'string',
      bank_card_number: 'string',
      comment: 'string',
      is_default_card: 'boolean',
      image: 'any',
      createdAt: 'number'
    }
  ],
  [
    'WorkerEntities.Scan',
    WorkerEntities.Scan,
    {
      scanId: 'string',
      name: 'string',
      file: 'any',
      createdAt: 'number'
    }
  ],
  ['WorkerEntities.BaseWorker', WorkerEntities.BaseWorker, baseWorkerShape],
  [
    'WorkerEntities.OfficeProfile',
    WorkerEntities.OfficeProfile,
    {
      ...baseWorkerShape,
      password: 'string',
      roles: { arrayOf: 'string' }
    }
  ],
  [
    'WorkerEntities.RevisorProfile',
    WorkerEntities.RevisorProfile,
    {
      ...baseWorkerShape,
      password: 'string',
      revisor_role: { enum: [...AppKeys.RevisorRoles] },
      job_type: { enum: [...AppKeys.JobType] },
      seats: { arrayOf: 'string' }
    }
  ],
  [
    'ShiftEntities.Seat',
    ShiftEntities.Seat,
    {
      seatId: 'string',
      assignTime: 'number',
      revisorId: 'number',
      shiftId: 'number',
      chatId: 'string',
      paid: { nullable: 'any' },
      subManagerId: 'number',
      status: { enum: ['reserve', 'assigned'] },
      confirmed: { nullable: { enum: [...AppKeys.Confirmed] } },
      attendance: { nullable: { enum: [...AppKeys.Attendance] } }
    }
  ],
  [
    'ShiftEntities.Shift',
    ShiftEntities.Shift,
    {
      shiftId: 'number',
      projectId: 'number',
      locationId: 'string',
      revisorRate: 'number',
      revisorsCount: 'number',
      comment: 'string',
      adname: 'string',
      stage: 'any',
      extra_rates: { arrayOf: 'string' },
      equipments: { arrayOf: 'string' },
      type_of_work: { arrayOf: 'string' },
      date: 'any',
      startTime: 'any',
      endTime: 'any',
      typeOfShift: { enum: [...AppKeys.TypeOfShift] },
      logs: { arrayOf: 'any' },
      isAttendanceCommited: 'boolean',
      enabledRevisorRoles: { arrayOf: { enum: [...AppKeys.RevisorRoles] } },
      seats: { arrayOf: 'string' },
      chatId: 'string'
    }
  ]
]
