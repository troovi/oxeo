import { CoreError } from '@oxeo/server'
import { createCase, createTableTest } from '../../tools'
import { mock } from '../../..'

// у revisor 2 есть живое место (Seat.revisorId → revisor.seats has-many). Смена формы на office
// должна быть ЗАБЛОКИРОВАНА (DEPENDENCY_RESTRICT), данные не меняются.
export const caseCDD = createCase('#CDD - changeDiscriminator blocked by has-many dependency', {
  execute: async (kit, dataSource) => {
    await kit.addDictionary({ dictionary: 'location_type' })
    await kit.addDictionary({ dictionary: 'value_type' })

    await kit.addOption({ value: 'option-1', dictionary: 'location_type' })
    await kit.addOption({ value: 'option-2', dictionary: 'value_type' })

    await kit.addLegal({ legalId: 'legal-1' })
    await kit.addLocation({
      locationId: 'location-1',
      legalId: 'legal-1',
      location_type: 'option-1',
      value_type: 'option-2'
    })

    await kit.addOfficeWorker({ workerId: 1 }) // manager/curator
    await kit.addRevisorWorker({ workerId: 2 }) // будет морфиться

    await kit.addClient({ clientId: 101, managerId: 1 })
    await kit.addProject({ projectId: 1001, clientId: 101, curatorId: 1, managerId: 1 })

    await kit.addNoteChat({ chatId: 'chat-1', shiftId: 10001 })
    await kit.addShift({
      shiftId: 10001,
      projectId: 1001,
      locationId: 'location-1',
      chatId: 'chat-1'
    })

    await kit.addSeatChat({ chatId: 'chat-2', seatId: 'seat-1' })
    await kit.addSeat({ seatId: 'seat-1', revisorId: 2, shiftId: 10001, chatId: 'chat-2' })

    // revisor 2 владеет seat-1 → смена формы запрещена
    await dataSource.collections.worker.changeDiscriminator(2, 'office', {
      password: 'off-pass',
      roles: []
    })
  },
  expectations: {
    tables: {
      ...createTableTest('client', {
        column: (source) => source.commonRefs.managerId,
        rows: [{ client: 101, worker: 1 }]
      }),
      ...createTableTest('location', {
        column: (source) => source.commonRefs.legalId,
        rows: [{ location: 'location-1', legal: 'legal-1' }]
      }),
      ...createTableTest('location', {
        column: (source) => source.commonRefs.location_type,
        rows: [{ location: 'location-1', options: 'option-1' }]
      }),
      ...createTableTest('location', {
        column: (source) => source.commonRefs.value_type,
        rows: [{ location: 'location-1', options: 'option-2' }]
      }),
      ...createTableTest('project', {
        column: (source) => source.commonRefs.clientId,
        rows: [{ project: 1001, client: 101 }]
      }),
      ...createTableTest('project', {
        column: (source) => source.commonRefs.curatorId,
        rows: [{ project: 1001, worker: 1 }]
      }),
      ...createTableTest('project', {
        column: (source) => source.commonRefs.managerId,
        rows: [{ project: 1001, worker: 1 }]
      }),
      ...createTableTest('shift', {
        column: (source) => source.commonRefs.locationId,
        rows: [{ shift: 10001, location: 'location-1' }]
      }),
      ...createTableTest('shift', {
        column: (source) => source.commonRefs.projectId,
        rows: [{ shift: 10001, project: 1001 }]
      })
    },
    scheme: {
      dictionaries: [
        mock.Dictionary({ dictionary: 'location_type', options: ['option-1'] }),
        mock.Dictionary({ dictionary: 'value_type', options: ['option-2'] })
      ],
      options: [
        mock.Option({ value: 'option-1', dictionary: 'location_type' }),
        mock.Option({ value: 'option-2', dictionary: 'value_type' })
      ],
      legal: [mock.Legal({ legalId: 'legal-1' })],
      location: [
        mock.Location({
          locationId: 'location-1',
          legalId: 'legal-1',
          location_type: 'option-1',
          value_type: 'option-2'
        })
      ],
      worker: [
        mock.Office({ workerId: 1 }),
        mock.Revisor({ workerId: 2, seats: ['seat-1'] }) // не изменился — морф упал
      ],
      client: [mock.Client({ clientId: 101, managerId: 1 })],
      project: [mock.Project({ projectId: 1001, clientId: 101, curatorId: 1, managerId: 1 })],
      chat: [
        mock.NoteChat({ chatId: 'chat-1', shiftId: 10001 }),
        mock.SeatChat({ chatId: 'chat-2', seatId: 'seat-1' })
      ],
      shift: [
        mock.Shift({
          shiftId: 10001,
          projectId: 1001,
          locationId: 'location-1',
          chatId: 'chat-1',
          seats: ['seat-1']
        })
      ],
      seat: [mock.Seat({ seatId: 'seat-1', revisorId: 2, shiftId: 10001, chatId: 'chat-2' })]
    },
    error: new CoreError('Worker', {
      reason: 'DEPENDENCY_RESTRICT',
      model: 'Seat'
    })
  }
})
