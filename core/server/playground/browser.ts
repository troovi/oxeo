import { dataScheme, caseMOS, createMockKit } from '@oxeo/devkit'
import { createMemoryDriver } from '@oxeo-drivers/memory'
import { DataSource } from '../lib'

const dataSource = new DataSource(dataScheme, {
  createDriver: createMemoryDriver
})

// dataSource.collections.contact.getAll()

// dataSource.collections.worker.findBy({ tgid: '' })

// dataSource.driver.relationsTable.bootstrap()
// dataSource.driver.bootstrap({
//   dictionaries: [{ dictionary: 'employment', name: '', options: [''] }],
//   options: [{ title: '', dictionary: 'employment', value: '' }],
//   worker: [],
//   bankCard: [],
//   bankDetail: [],
//   role: [],
//   chat: [],
//   client: [],
//   contact: [],
//   scan: [],
//   seat: [],
//   shift: [],
//   project: [],
//   legal: [],
//   location: []
// })

//
;(async () => {
  await caseMOS.params.execute(createMockKit(dataSource), dataSource)

  // INSPECT APP STATE

  console.log('APP STATE:', {
    worker: await dataSource.collections.worker.getAll(),
    scan: await dataSource.collections.scan.getAll(),
    bankCard: await dataSource.collections.bankCard.getAll(),
    bankDetail: await dataSource.collections.bankDetail.getAll(),
    // chat
    chat: await dataSource.collections.chat.getAll(),
    // client
    client: await dataSource.collections.client.getAll(),
    contact: await dataSource.collections.contact.getAll(),
    legal: await dataSource.collections.legal.getAll(),
    location: await dataSource.collections.location.getAll(),
    // project
    project: await dataSource.collections.project.getAll(),
    // role
    role: await dataSource.collections.role.getAll(),
    // options
    dictionaries: await dataSource.collections.dictionaries.getAll(),
    options: await dataSource.collections.options.getAll(),
    // shift
    seat: await dataSource.collections.seat.getAll(),
    shift: await dataSource.collections.shift.getAll()
  })

  // INSPECT TABLES
  console.log('TABLE STATE:', dataSource.driver.tables.getTables())
})()
