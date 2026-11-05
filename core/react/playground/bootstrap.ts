import { createMockKit } from '@companix/xeo-devkit'
import { dataSource } from './dataSource'

export const bootstrap = async () => {
  const kit = createMockKit(dataSource)

  // roles
  await kit.addRole({ value: 'role-1', title: 'Administrator' })
  await kit.addRole({ value: 'role-2', title: 'Manager' })
  await kit.addRole({ value: 'role-3', title: 'Coordinator' })

  // dictionaries & options
  await kit.addDictionary({ dictionary: 'location_type' })
  await kit.addDictionary({ dictionary: 'value_type' })
  await kit.addDictionary({ dictionary: 'type_of_work' })

  await kit.addOption({ value: 'option-loc', dictionary: 'location_type' })
  await kit.addOption({ value: 'option-val', dictionary: 'value_type' })
  await kit.addOption({ value: 'option-work-1', dictionary: 'type_of_work' })
  await kit.addOption({ value: 'option-work-2', dictionary: 'type_of_work' })

  // legal + locations
  await kit.addLegal({ legalId: 'legal-1' })

  await kit.addLocation({
    locationId: 'location-1',
    legalId: 'legal-1',
    location_type: 'option-loc',
    value_type: 'option-val',
    name: 'Warehouse A',
    address: 'st. Lenina 10'
  })

  await kit.addLocation({
    locationId: 'location-2',
    legalId: 'legal-1',
    location_type: 'option-loc',
    value_type: 'option-val',
    name: 'Office B',
    address: 'st. Mira 5'
  })

  // workers
  await kit.addOfficeWorker({
    workerId: 1,
    name: 'Ivan',
    surname: 'Petrov',
    email: 'ivan@mail.ru',
    roles: ['role-1', 'role-2']
  })

  await kit.addOfficeWorker({
    workerId: 2,
    name: 'Anna',
    surname: 'Sidorova',
    email: 'anna@mail.ru',
    roles: ['role-2']
  })

  await kit.addRevisorWorker({
    workerId: 3,
    name: 'Oleg',
    surname: 'Ivanov',
    email: 'oleg@mail.ru'
  })

  await kit.addRevisorWorker({
    workerId: 4,
    name: 'Maria',
    surname: 'Kozlova',
    email: 'maria@mail.ru'
  })

  // clients
  await kit.addClient({ clientId: 101, managerId: 1, companyname: 'Roskosmos' })
  await kit.addClient({ clientId: 102, managerId: 2, companyname: 'Gazprom' })

  // projects
  await kit.addProject({
    projectId: 1001,
    clientId: 101,
    curatorId: 2,
    managerId: 1,
    name: 'Inventory Spring 2025',
    price: 50000
  })

  await kit.addProject({
    projectId: 1002,
    clientId: 102,
    curatorId: 1,
    managerId: 2,
    name: 'Audit Q3',
    price: 120000
  })

  // chats (owner-fallback created before owning shift)
  await kit.addNoteChat({ chatId: 'chat-s1', shiftId: 1 })
  await kit.addNoteChat({ chatId: 'chat-s2', shiftId: 2 })

  // shifts
  await kit.addShift({
    shiftId: 1,
    projectId: 1001,
    locationId: 'location-1',
    chatId: 'chat-s1',
    adname: 'Morning inventory',
    comment: 'Check section A first',
    revisorRate: 150,
    revisorsCount: 2
  })

  await kit.addShift({
    shiftId: 2,
    projectId: 1002,
    locationId: 'location-2',
    chatId: 'chat-s2',
    adname: 'Full audit',
    comment: '',
    revisorRate: 200,
    revisorsCount: 1,
    stage: { type: 'inventory' }
  })
}
