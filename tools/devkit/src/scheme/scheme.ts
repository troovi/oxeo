import {
  DataScheme,
  InferScheme,
  defineCollection,
  defineDiscriminatedCollection
} from '@oxeo/scheme'
import { ChatEntities } from './chat'
import { ClientEntities } from './clients'
import { DictionaryEntities } from './dictionary'
import { ProjectEntities } from './projects'
import { RoleEntities } from './roles'
import { ShiftEntities } from './shifts'
import { WorkerEntities } from './workers'

export const dataScheme = new DataScheme({
  // worker
  worker: defineDiscriminatedCollection({
    baseScheme: WorkerEntities.BaseWorker,
    discriminators: [WorkerEntities.OfficeProfile, WorkerEntities.RevisorProfile],
    identifier: 'workerId',
    discriminatorKey: 'type'
  }),
  scan: defineCollection(WorkerEntities.Scan, 'scanId'),
  bankCard: defineCollection(WorkerEntities.BankCard, 'cardId'),
  bankDetail: defineCollection(WorkerEntities.BankDetail, 'detailId'),
  // chat
  chat: defineDiscriminatedCollection({
    baseScheme: ChatEntities.BaseChat,
    discriminators: [ChatEntities.SeatChat, ChatEntities.NoteChat],
    identifier: 'chatId',
    discriminatorKey: 'type'
  }),
  // client
  client: defineCollection(ClientEntities.Client, 'clientId'),
  contact: defineCollection(ClientEntities.Contact, 'contactId'),
  legal: defineCollection(ClientEntities.Legal, 'legalId'),
  location: defineCollection(ClientEntities.Location, 'locationId'),
  // project
  project: defineCollection(ProjectEntities.Project, 'projectId'),
  // role
  role: defineCollection(RoleEntities.Role, 'value'),
  // options
  dictionaries: defineCollection(DictionaryEntities.Dictionary, 'dictionary'),
  options: defineCollection(DictionaryEntities.Option, 'value'),
  // shift
  seat: defineCollection(ShiftEntities.Seat, 'seatId'),
  shift: defineCollection(ShiftEntities.Shift, 'shiftId')
})

export type AppScheme = InferScheme<typeof dataScheme>
