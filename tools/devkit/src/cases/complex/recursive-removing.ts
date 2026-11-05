import { createCase, createTableTest } from '../tools'
import { mock } from '../..'

export const caseMOS = createCase(
  '#MOS - Recursive removing. Drop shift cascades seat, notechat, seatchat; revisor empty seats',
  {
    execute: async (kit, dataSource) => {
      // create dictionary
      await kit.addDictionary({ dictionary: 'location_type' })
      await kit.addDictionary({ dictionary: 'value_type' })

      // create options
      await kit.addOption({
        value: 'option-1',
        dictionary: 'location_type' // BelongsTo
      })
      await kit.addOption({
        value: 'option-2',
        dictionary: 'value_type' // BelongsTo
      })

      // create legal (for location)
      await kit.addLegal({ legalId: 'legal-1' })

      // create location
      await kit.addLocation({
        locationId: 'location-1',
        legalId: 'legal-1', // ReferenceTo
        location_type: 'option-1', // ReferenceTo
        value_type: 'option-2' // ReferenceTo
      })

      // create workers
      await kit.addOfficeWorker({ workerId: 1 })
      await kit.addOfficeWorker({ workerId: 2 })
      await kit.addRevisorWorker({ workerId: 3 })

      // create client
      await kit.addClient({
        clientId: 101,
        managerId: 1 // ReferenceTo
      })

      // create project
      await kit.addProject({
        projectId: 1001,
        clientId: 101, // ReferenceTo
        curatorId: 2, // ReferenceTo
        managerId: 1 // ReferenceTo
      })

      //  ============= create shift and seat 1 ============= //

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

      // create chat
      await kit.addSeatChat({
        chatId: 'chat-2',
        seatId: 'seat-1' // OwnerFallback
      })

      await kit.addSeat({
        seatId: 'seat-1',
        revisorId: 3, // BelongsTo
        shiftId: 10001, // BelongsTo
        chatId: 'chat-2', // Owner
        subManagerId: 2 // ReferenceTo
      })

      //  ============= create shift and seat 2 ============= //

      await kit.addNoteChat({
        chatId: 'chat-3',
        shiftId: 10002 // OwnerFallback
      })

      await kit.addShift({
        shiftId: 10002,
        projectId: 1001, // ReferenceTo
        locationId: 'location-1', // ReferenceTo
        chatId: 'chat-3' // Owner
      })

      //  create seat (with chat)
      await kit.addSeatChat({
        chatId: 'chat-4',
        seatId: 'seat-2' // OwnerFallback
      })

      await kit.addSeat({
        seatId: 'seat-2',
        revisorId: 3, // BelongsTo
        shiftId: 10002, // BelongsTo
        chatId: 'chat-4', // Owner
        subManagerId: 2 // ReferenceTo
      })

      //  ============= add seat to 1 shift ============= //

      //  create seat (with chat)
      await kit.addSeatChat({
        chatId: 'chat-5',
        seatId: 'seat-3' // OwnerFallback
      })

      await kit.addSeat({
        seatId: 'seat-3',
        revisorId: 3, // BelongsTo
        shiftId: 10001, // BelongsTo
        chatId: 'chat-5', // Owner
        subManagerId: 1 // ReferenceTo
      })

      // remove shift 1
      await dataSource.collections.shift.remove(10001)
    },
    expectations: {
      tables: {
        ...createTableTest('client', {
          column: (source) => source.commonRefs.managerId,
          rows: [{ client: 101, worker: 1 }]
        }),
        // location
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
        // project
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
        // seat
        ...createTableTest('seat', {
          column: (source) => source.commonRefs.subManagerId,
          rows: [{ seat: 'seat-2', worker: 2 }]
        }),
        // shift
        ...createTableTest('shift', {
          column: (source) => source.commonRefs.projectId,
          rows: [{ shift: 10002, project: 1001 }]
        }),
        ...createTableTest('shift', {
          column: (source) => source.commonRefs.locationId,
          rows: [{ shift: 10002, location: 'location-1' }]
        })
        // TODO:
        // ...createTableTest('project', {
        //   clientId: [{ project: 1001, client: 101 }],
        //   curatorId: [{ project: 1001, worker: 2 }],
        //   managerId: [{ project: 1001, worker: 1 }],
        //   ["inner.discriminated"]: []
        // }),
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
          mock.Office({ workerId: 2 }),
          mock.Revisor({ workerId: 3, seats: ['seat-2'] })
        ],
        shift: [
          mock.Shift({
            shiftId: 10002,
            projectId: 1001, // ReferenceTo
            locationId: 'location-1', // ReferenceTo
            chatId: 'chat-3', // Owner
            seats: ['seat-2']
          })
        ],
        chat: [
          mock.NoteChat({
            chatId: 'chat-3',
            shiftId: 10002 // OwnerFallback
          }),
          mock.SeatChat({
            chatId: 'chat-4',
            seatId: 'seat-2' // OwnerFallback
          })
        ],
        seat: [
          mock.Seat({
            seatId: 'seat-2',
            revisorId: 3,
            shiftId: 10002,
            chatId: 'chat-4',
            subManagerId: 2
          })
        ],
        client: [mock.Client({ clientId: 101, managerId: 1 })],
        project: [mock.Project({ projectId: 1001, clientId: 101, curatorId: 2, managerId: 1 })]
      }
    }
  }
)
