import { createCase, createTableTest } from '../../tools'
import { mock } from '../../..'

export const caseFMO = createCase('#FMO - remove ReferenceSet entities and check autocleanup', {
  execute: async (kit, dataSource) => {
    // create role
    await kit.addRole({ value: 'role-1' })
    await kit.addRole({ value: 'role-2' })
    await kit.addRole({ value: 'role-3' })

    await kit.addOfficeWorker({
      workerId: 1,
      roles: ['role-1', 'role-2', 'role-3'] // ReferenceSet
    })

    await kit.addOfficeWorker({
      workerId: 2,
      roles: ['role-1'] // ReferenceSet
    })

    await kit.addOfficeWorker({
      workerId: 3,
      roles: ['role-2'] // ReferenceSet
    })

    await dataSource.collections.role.remove('role-1')
    await dataSource.collections.role.remove('role-2')
  },
  expectations: {
    tables: {
      ...createTableTest('worker', {
        column: (source) => source.discriminatorRefs!.office.roles,
        rows: [{ worker: 1, role: 'role-3' }]
      })
    },
    scheme: {
      role: [mock.Role({ value: 'role-3' })],
      worker: [
        mock.Office({ workerId: 1, roles: ['role-3'] }),
        mock.Office({ workerId: 2 }),
        mock.Office({ workerId: 3 })
      ]
    }
  }
})

export const caseXIA = createCase('#XIA - remove ReferenceSet entity that used from two models', {
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
    // create location (for contact)
    await kit.addLocation({
      locationId: 'location-1',
      legalId: 'legal-1', // ReferenceTo
      location_type: 'option-1', // ReferenceTo
      value_type: 'option-2' // ReferenceTo
    })
    // create contact (for client)
    await kit.addContact({
      contactId: 'contact-1',
      locations: ['location-1'] // ReferenceSet
    })
    // create worker
    await kit.addOfficeWorker({
      workerId: 1,
      password: 'p',
      email: 'm3901@mail.ru',
      name: 'Manager 39'
    })
    // create client
    await kit.addClient({
      clientId: 101,
      managerId: 1, // ReferenceTo
      locations: ['location-1'], // ReferenceSet
      contacts: ['contact-1'] // ReferenceSet
    })
    // remove location
    await dataSource.collections.location.remove('location-1')
  },
  expectations: {
    tables: {
      ...createTableTest('client', {
        column: (source) => source.commonRefs.managerId,
        rows: [{ client: 101, worker: 1 }]
      }),
      ...createTableTest('client', {
        column: (source) => source.commonRefs.contacts,
        rows: [{ client: 101, contact: 'contact-1' }]
      })
    },
    scheme: {
      dictionaries: [
        mock.Dictionary({
          dictionary: 'location_type',
          options: ['option-1']
        }),
        mock.Dictionary({
          dictionary: 'value_type',
          options: ['option-2']
        })
      ],
      options: [
        mock.Option({
          value: 'option-1',
          dictionary: 'location_type'
        }),
        mock.Option({
          value: 'option-2',
          dictionary: 'value_type'
        })
      ],
      legal: [mock.Legal({ legalId: 'legal-1' })],
      location: [],
      contact: [mock.Contact({ contactId: 'contact-1' })],
      worker: [
        mock.Office({
          workerId: 1,
          password: 'p',
          email: 'm3901@mail.ru',
          name: 'Manager 39'
        })
      ],
      client: [
        mock.Client({
          clientId: 101,
          managerId: 1,
          locations: [],
          contacts: ['contact-1']
        })
      ]
    }
  }
})
