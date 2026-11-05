import { createCase, createTableTest } from '../tools'
import { mock } from '../..'

export const caseNIX = createCase('#NIX - After seat removed, revisor can be removed; shift remains', {
  execute: async (kit, dataSource) => {
    // dictionary
    await kit.addDictionary({ dictionary: 'location_type' })
    await kit.addDictionary({ dictionary: 'value_type' })
    // options
    await kit.addOption({
      value: 'option-1',
      dictionary: 'location_type' // BelongsTo
    })
    await kit.addOption({
      value: 'option-2',
      dictionary: 'value_type' // BelongsTo
    })
    // legal
    await kit.addLegal({ legalId: 'legal-1' })
    // location
    await kit.addLocation({
      locationId: 'location-1',
      legalId: 'legal-1', // ReferenceTo
      location_type: 'option-1', // ReferenceTo
      value_type: 'option-2' // ReferenceTo
    })
    // worker
    await kit.addOfficeWorker({ workerId: 1 })
    await kit.addOfficeWorker({ workerId: 2 })
    await kit.addRevisorWorker({ workerId: 3 })
    // client
    await kit.addClient({
      clientId: 101,
      managerId: 1 // ReferenceTo
    })
    // project
    await kit.addProject({
      projectId: 1001,
      clientId: 101, // ReferenceTo
      curatorId: 2, // ReferenceTo
      managerId: 1 // ReferenceTo
    })
    // shift
    await kit.addNoteChat({
      chatId: 'chat-1',
      shiftId: 10001 // OwnerFallback
    })
    await kit.addShift({
      shiftId: 10001,
      projectId: 1001, // ReferenceTo
      locationId: 'location-1', // ReferenceTo
      chatId: 'chat-1' // Owner
    })
    // seat
    await kit.addSeatChat({
      chatId: 'chat-2',
      seatId: 'seat-1' // OwnerFallback
    })
    await kit.addSeat({
      seatId: 'seat-1',
      revisorId: 3, // BelongsTo
      shiftId: 10001, // BelongsTo
      chatId: 'chat-2' // Owner
    })

    await dataSource.collections.seat.remove('seat-1')
    await dataSource.collections.worker.remove(3)
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
        rows: [{ project: 1001, worker: 2 }]
      }),
      ...createTableTest('project', {
        column: (source) => source.commonRefs.managerId,
        rows: [{ project: 1001, worker: 1 }]
      }),
      ...createTableTest('shift', {
        column: (source) => source.commonRefs.projectId,
        rows: [{ shift: 10001, project: 1001 }]
      }),
      ...createTableTest('shift', {
        column: (source) => source.commonRefs.locationId,
        rows: [{ shift: 10001, location: 'location-1' }]
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
      worker: [mock.Office({ workerId: 1 }), mock.Office({ workerId: 2 })],
      client: [mock.Client({ clientId: 101, managerId: 1 })],
      project: [mock.Project({ projectId: 1001, clientId: 101, curatorId: 2, managerId: 1 })],
      chat: [mock.NoteChat({ chatId: 'chat-1', shiftId: 10001 })],
      shift: [
        mock.Shift({
          shiftId: 10001,
          projectId: 1001,
          locationId: 'location-1',
          chatId: 'chat-1'
        })
      ],
      seat: []
    }
  }
})
