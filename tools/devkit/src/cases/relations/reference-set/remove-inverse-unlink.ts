import { createCase, createTableTest } from '../../tools'
import { mock } from '../../..'

export const casePUX = createCase('#PUX - remove Project and unlink Client.projects', {
  execute: async (kit, dataSource) => {
    await kit.addOfficeWorker({ workerId: 1 })
    await kit.addOfficeWorker({ workerId: 2 })

    await kit.addClient({
      clientId: 101,
      managerId: 1
    })

    await kit.addClient({
      clientId: 102,
      managerId: 1
    })

    await kit.addProject({
      projectId: 1000,
      clientId: 101,
      curatorId: 2,
      managerId: 1
    })

    await kit.addProject({
      projectId: 1001,
      clientId: 101,
      curatorId: 2,
      managerId: 1
    })

    await dataSource.collections.client.update(101, (draft) => {
      draft.projects = [1000, 1001]
    })

    await dataSource.collections.client.update(102, (draft) => {
      draft.projects = [1000]
    })

    await dataSource.collections.project.remove(1000)
  },
  expectations: {
    tables: {
      ...createTableTest('client', {
        column: (source) => source.commonRefs.managerId,
        rows: [
          { client: 101, worker: 1 },
          { client: 102, worker: 1 }
        ]
      }),
      ...createTableTest('client', {
        column: (source) => source.commonRefs.projects,
        rows: [{ client: 101, project: 1001 }]
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
      worker: [mock.Office({ workerId: 1 }), mock.Office({ workerId: 2 })],
      client: [
        mock.Client({ clientId: 101, managerId: 1, projects: [1001] }),
        mock.Client({ clientId: 102, managerId: 1, projects: [] })
      ],
      project: [mock.Project({ projectId: 1001, clientId: 101, curatorId: 2, managerId: 1 })]
    }
  }
})

export const caseCAX = createCase(
  '#CAX - remove shared Option across worker, project and shift tables',
  {
    execute: async (kit, dataSource) => {
      await kit.addDictionary({ dictionary: 'location_type' })
      await kit.addDictionary({ dictionary: 'value_type' })
      await kit.addDictionary({ dictionary: 'kind_of_work' })

      await kit.addOption({ value: 'option-1', dictionary: 'location_type' })
      await kit.addOption({ value: 'option-2', dictionary: 'value_type' })
      await kit.addOption({ value: 'option-3', dictionary: 'kind_of_work' })
      await kit.addOption({ value: 'option-4', dictionary: 'kind_of_work' })

      await kit.addLegal({ legalId: 'legal-1' })
      await kit.addLocation({
        locationId: 'location-1',
        legalId: 'legal-1',
        location_type: 'option-1',
        value_type: 'option-2'
      })

      await kit.addOfficeWorker({ workerId: 1 })
      await kit.addOfficeWorker({ workerId: 2 })
      await kit.addRevisorWorker({
        workerId: 3,
        about: { kind_of_work: ['option-3', 'option-4'] }
      })
      await kit.addRevisorWorker({
        workerId: 4,
        about: { kind_of_work: ['option-3'] }
      })

      await kit.addClient({
        clientId: 101,
        managerId: 1
      })

      await kit.addProject({
        projectId: 1000,
        clientId: 101,
        curatorId: 2,
        managerId: 1,
        type_of_works: ['option-3', 'option-4']
      })

      await kit.addNoteChat({
        chatId: 'chat-1',
        shiftId: 10000
      })
      await kit.addShift({
        shiftId: 10000,
        projectId: 1000,
        locationId: 'location-1',
        chatId: 'chat-1',
        type_of_work: ['option-3']
      })

      await kit.addNoteChat({
        chatId: 'chat-2',
        shiftId: 10001
      })
      await kit.addShift({
        shiftId: 10001,
        projectId: 1000,
        locationId: 'location-1',
        chatId: 'chat-2',
        type_of_work: ['option-3', 'option-4']
      })

      await dataSource.collections.options.remove('option-3')
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
          rows: [{ client: 101, worker: 1 }]
        }),
        ...createTableTest('worker', {
          column: (source) => source.commonRefs['about.kind_of_work'],
          rows: [{ worker: 3, options: 'option-4' }]
        }),
        ...createTableTest('project', {
          column: (source) => source.commonRefs.clientId,
          rows: [{ project: 1000, client: 101 }]
        }),
        ...createTableTest('project', {
          column: (source) => source.commonRefs.curatorId,
          rows: [{ project: 1000, worker: 2 }]
        }),
        ...createTableTest('project', {
          column: (source) => source.commonRefs.managerId,
          rows: [{ project: 1000, worker: 1 }]
        }),
        ...createTableTest('project', {
          column: (source) => source.commonRefs.type_of_works,
          rows: [{ project: 1000, options: 'option-4' }]
        }),
        ...createTableTest('shift', {
          column: (source) => source.commonRefs.projectId,
          rows: [
            { shift: 10000, project: 1000 },
            { shift: 10001, project: 1000 }
          ]
        }),
        ...createTableTest('shift', {
          column: (source) => source.commonRefs.locationId,
          rows: [
            { shift: 10000, location: 'location-1' },
            { shift: 10001, location: 'location-1' }
          ]
        }),
        ...createTableTest('shift', {
          column: (source) => source.commonRefs.type_of_work,
          rows: [{ shift: 10001, options: 'option-4' }]
        })
      },
      scheme: {
        dictionaries: [
          mock.Dictionary({ dictionary: 'location_type', options: ['option-1'] }),
          mock.Dictionary({ dictionary: 'value_type', options: ['option-2'] }),
          mock.Dictionary({ dictionary: 'kind_of_work', options: ['option-4'] })
        ],
        options: [
          mock.Option({ value: 'option-1', dictionary: 'location_type' }),
          mock.Option({ value: 'option-2', dictionary: 'value_type' }),
          mock.Option({ value: 'option-4', dictionary: 'kind_of_work' })
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
          mock.Revisor({ workerId: 3, about: { kind_of_work: ['option-4'] } }),
          mock.Revisor({ workerId: 4, about: { kind_of_work: [] } })
        ],
        client: [mock.Client({ clientId: 101, managerId: 1 })],
        project: [
          mock.Project({
            projectId: 1000,
            clientId: 101,
            curatorId: 2,
            managerId: 1,
            type_of_works: ['option-4']
          })
        ],
        chat: [
          mock.NoteChat({ chatId: 'chat-1', shiftId: 10000 }),
          mock.NoteChat({ chatId: 'chat-2', shiftId: 10001 })
        ],
        shift: [
          mock.Shift({
            shiftId: 10000,
            projectId: 1000,
            locationId: 'location-1',
            chatId: 'chat-1',
            type_of_work: []
          }),
          mock.Shift({
            shiftId: 10001,
            projectId: 1000,
            locationId: 'location-1',
            chatId: 'chat-2',
            type_of_work: ['option-4']
          })
        ]
      }
    }
  }
)
