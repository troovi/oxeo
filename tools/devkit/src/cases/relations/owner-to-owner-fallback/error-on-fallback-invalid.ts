import { createTableTest } from '../../tools'
import { CoreError } from '@oxeo/server'
import { createCase } from '../../tools'
import { mock } from '../../..'

const setupShiftGraph = async (kit: Parameters<typeof caseJXA.params.execute>[0]) => {
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

  await kit.addOfficeWorker({ workerId: 1 })
  await kit.addOfficeWorker({ workerId: 2 })
  await kit.addLegal({ legalId: 'legal-1' })
  await kit.addLocation({
    locationId: 'location-1',
    legalId: 'legal-1',
    location_type: 'option-1',
    value_type: 'option-2'
  })
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
}

const baseTables = {
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
    rows: [{ client: 101, worker: 1 }]
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
}

const baseScheme = {
  dictionaries: [
    mock.Dictionary({ dictionary: 'location_type', options: ['option-1'] }),
    mock.Dictionary({ dictionary: 'value_type', options: ['option-2'] })
  ],
  options: [
    mock.Option({ value: 'option-1', dictionary: 'location_type' }),
    mock.Option({ value: 'option-2', dictionary: 'value_type' })
  ],
  worker: [mock.Office({ workerId: 1 }), mock.Office({ workerId: 2 })],
  legal: [mock.Legal({ legalId: 'legal-1' })],
  location: [
    mock.Location({
      locationId: 'location-1',
      legalId: 'legal-1',
      location_type: 'option-1',
      value_type: 'option-2'
    })
  ],
  client: [mock.Client({ clientId: 101, managerId: 1 })],
  project: [mock.Project({ projectId: 1001, clientId: 101, curatorId: 2, managerId: 1 })]
}

export const caseJXA = createCase('#JXA - check not exists error (Owner) - creating', {
  execute: async (kit) => {
    await setupShiftGraph(kit)

    await kit.addShift({
      shiftId: 10001,
      projectId: 1001,
      locationId: 'location-1',
      chatId: 'chat-2'
    })
  },
  expectations: {
    tables: baseTables,
    scheme: baseScheme,
    error: new CoreError('Chat', { reason: 'NOT_EXISTS', refId: 'chat-2' })
  }
})

export const caseRIO = createCase('#RIO - check relation restrict error (Owner) - updating', {
  execute: async (kit, dataSource) => {
    await setupShiftGraph(kit)

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

    await dataSource.collections.shift.update(10001, (draft) => {
      draft.chatId = 'chat-2'
    })
  },
  expectations: {
    tables: {
      ...baseTables,
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
      ...baseScheme,
      chat: [mock.NoteChat({ chatId: 'chat-1', shiftId: 10001 })],
      shift: [
        mock.Shift({
          shiftId: 10001,
          projectId: 1001,
          locationId: 'location-1',
          chatId: 'chat-1'
        })
      ]
    },
    error: new CoreError('Shift', {
      reason: 'RELATION_RESTRICT',
      address: 'chatId',
      info: 'owner'
    })
  }
})
