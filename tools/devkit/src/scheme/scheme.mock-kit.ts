import { DataSource } from '@oxeo/server'
import { AppScheme } from './scheme'
import { mock } from './scheme.mock'

export const createMockKit = (dataSource: DataSource<AppScheme>) => {
  return {
    addOfficeWorker: (params: Parameters<typeof mock.Office>[0]) => {
      return dataSource.collections.worker.create(mock.Office(params))
    },
    addRevisorWorker: (params: Parameters<typeof mock.Revisor>[0]) => {
      return dataSource.collections.worker.create(mock.Revisor(params))
    },
    addScan: (params: Parameters<typeof mock.Scan>[0]) => {
      return dataSource.collections.scan.create(mock.Scan(params))
    },
    addBankCard: (params: Parameters<typeof mock.BankCard>[0]) => {
      return dataSource.collections.bankCard.create(mock.BankCard(params))
    },
    addBankDetail: (params: Parameters<typeof mock.BankDetail>[0]) => {
      return dataSource.collections.bankDetail.create(mock.BankDetail(params))
    },
    // chat
    addNoteChat: (params: Parameters<typeof mock.NoteChat>[0]) => {
      return dataSource.collections.chat.create(mock.NoteChat(params))
    },
    addSeatChat: (params: Parameters<typeof mock.SeatChat>[0]) => {
      return dataSource.collections.chat.create(mock.SeatChat(params))
    },
    // client
    addClient: (params: Parameters<typeof mock.Client>[0]) => {
      return dataSource.collections.client.create(mock.Client(params))
    },
    addContact: (params: Parameters<typeof mock.Contact>[0]) => {
      return dataSource.collections.contact.create(mock.Contact(params))
    },
    addLegal: (params: Parameters<typeof mock.Legal>[0]) => {
      return dataSource.collections.legal.create(mock.Legal(params))
    },
    addLocation: (params: Parameters<typeof mock.Location>[0]) => {
      return dataSource.collections.location.create(mock.Location(params))
    },
    // project
    addProject: (params: Parameters<typeof mock.Project>[0]) => {
      return dataSource.collections.project.create(mock.Project(params))
    },
    // role
    addRole: (params: Parameters<typeof mock.Role>[0]) => {
      return dataSource.collections.role.create(mock.Role(params))
    },
    // options
    addDictionary: (params: Parameters<typeof mock.Dictionary>[0]) => {
      return dataSource.collections.dictionaries.create(mock.Dictionary(params))
    },
    addOption: (params: Parameters<typeof mock.Option>[0]) => {
      return dataSource.collections.options.create(mock.Option(params))
    },
    // shift
    addSeat: (params: Parameters<typeof mock.Seat>[0]) => {
      return dataSource.collections.seat.create(mock.Seat(params))
    },
    addShift: (params: Parameters<typeof mock.Shift>[0]) => {
      return dataSource.collections.shift.create(mock.Shift(params))
    }
  }
}

export type MockKit = ReturnType<typeof createMockKit>
