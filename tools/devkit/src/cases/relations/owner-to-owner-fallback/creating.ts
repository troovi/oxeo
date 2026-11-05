import { createCase, createTableTest } from '../../tools'
import { mock } from '../../..'

export const caseMDI = createCase('#MDI - Owner - Owner-fallback creating', {
  execute: async (kit) => {
    // dictionary
    await kit.addDictionary({ dictionary: 'location_type', name: '#15 Location type' })
    await kit.addDictionary({ dictionary: 'value_type', name: '#15 Value type' })
    // option
    await kit.addOption({
      value: 'option-1',
      dictionary: 'location_type' // BelongsTo
    })
    await kit.addOption({
      value: 'option-2',
      dictionary: 'value_type' // BelongsTo
    })
    // worker
    await kit.addOfficeWorker({ workerId: 1, name: '#15 Curator' })
    await kit.addOfficeWorker({ workerId: 2, name: '#15 Manager' })
    // legal
    await kit.addLegal({ legalId: 'legal-1' })
    // location
    await kit.addLocation({
      locationId: 'location-1',
      legalId: 'legal-1', // ReferenceTo
      location_type: 'option-1', // ReferenceTo
      value_type: 'option-2' // ReferenceTo
    })
    // client
    await kit.addClient({
      clientId: 101,
      managerId: 2, // ReferenceTo
      locations: ['location-1'], // ReferenceSet
      legals: ['legal-1'], // ReferenceSet
      contacts: [], // ReferenceSet
      projects: [] // ReferenceSet
    })
    // project
    await kit.addProject({
      projectId: 1001,
      clientId: 101, // ReferenceTo
      curatorId: 1, // ReferenceTo
      managerId: 2, // ReferenceTo
      locationsIds: ['location-1'], // ReferenceSet
      type_of_works: [] // ReferenceSet
    })
    // shift
    await kit.addNoteChat({
      chatId: 'chat-1',
      shiftId: 10001 // OwnerFallback
    })
    await kit.addShift({
      shiftId: 10001,
      chatId: 'chat-1', // Owner
      projectId: 1001, // ReferenceTo
      locationId: 'location-1', // ReferenceTo
      equipments: [], // ReferenceSet
      extra_rates: [], // ReferenceSet
      type_of_work: [], // ReferenceSet
      seats: [] // HasMany
    })
  },
  expectations: {
    tables: {
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
      ...createTableTest('client', {
        column: (source) => source.commonRefs.managerId,
        rows: [{ client: 101, worker: 2 }]
      }),
      ...createTableTest('client', {
        column: (source) => source.commonRefs.legals,
        rows: [{ client: 101, legal: 'legal-1' }]
      }),
      ...createTableTest('client', {
        column: (source) => source.commonRefs.locations,
        rows: [{ client: 101, location: 'location-1' }]
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
        rows: [{ project: 1001, worker: 2 }]
      }),
      ...createTableTest('project', {
        column: (source) => source.commonRefs.locationsIds,
        rows: [{ project: 1001, location: 'location-1' }]
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
        mock.Dictionary({
          dictionary: 'location_type',
          name: '#15 Location type',
          options: ['option-1']
        }),
        mock.Dictionary({ dictionary: 'value_type', name: '#15 Value type', options: ['option-2'] })
      ],
      options: [
        mock.Option({ value: 'option-1', dictionary: 'location_type' }),
        mock.Option({ value: 'option-2', dictionary: 'value_type' })
      ],
      worker: [
        mock.Office({ workerId: 1, name: '#15 Curator' }),
        mock.Office({ workerId: 2, name: '#15 Manager' })
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
      client: [
        mock.Client({
          clientId: 101,
          managerId: 2,
          locations: ['location-1'],
          legals: ['legal-1'],
          contacts: [],
          projects: []
        })
      ],
      project: [
        mock.Project({
          projectId: 1001,
          clientId: 101,
          curatorId: 1,
          managerId: 2,
          locationsIds: ['location-1'],
          type_of_works: []
        })
      ],
      chat: [mock.NoteChat({ chatId: 'chat-1', shiftId: 10001 })],
      shift: [
        mock.Shift({
          shiftId: 10001,
          projectId: 1001,
          locationId: 'location-1',
          chatId: 'chat-1',
          equipments: [],
          extra_rates: [],
          type_of_work: [],
          seats: []
        })
      ]
    }
  }
})
