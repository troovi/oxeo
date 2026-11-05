import { mock } from '../../..'
import { createCase, createTableTest } from '../../tools'

export const caseQAX = createCase('#QAX - remove Owner and cascade OwnerFallback entity', {
  execute: async (kit, dataSource) => {
    await kit.addDictionary({ dictionary: 'location_type' })
    await kit.addDictionary({ dictionary: 'value_type' })

    await kit.addOption({
      value: 'option-1',
      dictionary: 'location_type'
    })
    await kit.addOption({
      value: 'option-2',
      dictionary: 'value_type'
    })

    await kit.addLegal({ legalId: 'legal-1' })
    await kit.addLocation({
      locationId: 'location-1',
      legalId: 'legal-1',
      location_type: 'option-1',
      value_type: 'option-2'
    })

    await kit.addOfficeWorker({ workerId: 1 })
    await kit.addOfficeWorker({ workerId: 2 })

    await kit.addClient({
      clientId: 101,
      managerId: 1
    })

    await kit.addProject({
      projectId: 1001,
      clientId: 101,
      curatorId: 2,
      managerId: 1
    })

    await kit.addNoteChat({
      chatId: 'chat-1',
      shiftId: 10001
    })
    await kit.addShift({
      shiftId: 10001,
      projectId: 1001,
      locationId: 'location-1',
      chatId: 'chat-1'
    })

    await dataSource.collections.shift.remove(10001)
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
      chat: [],
      shift: []
    }
  }
})
