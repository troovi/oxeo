import { createSearchCase } from '../tools'
import { mock } from '../..'

export const caseFIA = createSearchCase('#FIA - findOneBy returns first matched entity', {
  execute: async (kit, dataSource) => {
    await kit.addOfficeWorker({ workerId: 1, email: 'manager-1@mail.ru', name: 'Manager 1' })
    await kit.addOfficeWorker({ workerId: 2, email: 'manager-2@mail.ru', name: 'Manager 2' })

    const byId = await dataSource.collections.worker.findOneBy({
      workerId: 2
    })

    const missing = await dataSource.collections.worker.findOneBy({
      workerId: 3
    })

    return [
      {
        result: byId,
        expect: mock.Office({ workerId: 2, email: 'manager-2@mail.ru', name: 'Manager 2' })
      },
      {
        result: missing,
        expect: null
      }
    ]
  }
})

export const caseFIB = createSearchCase('#FIB - findBy returns all matched entities', {
  execute: async (kit, dataSource) => {
    await kit.addOfficeWorker({ workerId: 1 })
    await kit.addOfficeWorker({ workerId: 2 })
    await kit.addOfficeWorker({ workerId: 3 })

    await kit.addClient({ clientId: 101, managerId: 1, subManagerId: 3 })
    await kit.addClient({ clientId: 102, managerId: 1, subManagerId: null })
    await kit.addClient({ clientId: 103, managerId: 2, subManagerId: 3 })

    const byManager = await dataSource.collections.client.findBy({ managerId: 1 })
    const bySubManager = await dataSource.collections.client.findBy({ subManagerId: 3 })
    const missing = await dataSource.collections.client.findBy({ managerId: 999 })

    return [
      {
        result: byManager,
        expect: [
          mock.Client({ clientId: 101, managerId: 1, subManagerId: 3 }),
          mock.Client({ clientId: 102, managerId: 1, subManagerId: null })
        ]
      },
      {
        result: bySubManager,
        expect: [
          mock.Client({ clientId: 101, managerId: 1, subManagerId: 3 }),
          mock.Client({ clientId: 103, managerId: 2, subManagerId: 3 })
        ]
      },
      {
        result: missing,
        expect: []
      }
    ]
  }
})

export const caseFIC = createSearchCase('#FIC - find methods support nested filters', {
  execute: async (kit, dataSource) => {
    await kit.addDictionary({ dictionary: 'regions' })
    await kit.addOption({ value: 'option-1', dictionary: 'regions' })
    await kit.addOption({ value: 'option-2', dictionary: 'regions' })

    await kit.addRevisorWorker({
      workerId: 1,
      about: { height: 180, regions: ['option-1'] },
      documents: { passport_number: 'AB1234567' }
    })
    await kit.addRevisorWorker({
      workerId: 2,
      about: { height: 175, regions: ['option-2'] },
      documents: { passport_number: 'CD7654321' }
    })
    await kit.addRevisorWorker({
      workerId: 3,
      about: { height: 180, regions: ['option-1'] },
      documents: { passport_number: 'EF0000001' }
    })

    const one = await dataSource.collections.worker.findOneBy({
      documents: { passport_number: 'CD7654321' }
    })

    const many = await dataSource.collections.worker.findBy({
      about: { height: 180, regions: ['option-1'] }
    })

    return [
      {
        result: one,
        expect: mock.Revisor({
          workerId: 2,
          about: { height: 175, regions: ['option-2'] },
          documents: { passport_number: 'CD7654321' }
        })
      },
      {
        result: many,
        expect: [
          mock.Revisor({
            workerId: 1,
            about: { height: 180, regions: ['option-1'] },
            documents: { passport_number: 'AB1234567' }
          }),
          mock.Revisor({
            workerId: 3,
            about: { height: 180, regions: ['option-1'] },
            documents: { passport_number: 'EF0000001' }
          })
        ]
      }
    ]
  }
})
