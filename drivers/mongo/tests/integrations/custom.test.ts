import { CoreError, DataSource } from '@oxeo/server'
import { getDataSourceToken } from '../../lib'

import { bootstrap } from '../app/bootstrap'
import { MongoCollectionDriver } from '../../lib/drivers/collection.driver'
import { AppScheme, createMockKit, dataScheme } from '@oxeo/devkit'

const runScenario = async (dataSource: DataSource<AppScheme, MongoCollectionDriver<AppScheme>>) => {
  // version: 11
  // const kit = await createMockKit(dataSource)
  // await kit.addDictionary({ dictionary: 'regions' })
  // await kit.addOption({
  //   value: 'option-1',
  //   dictionary: 'regions' // BelongsTo
  // })
  // await kit.addRevisorWorker({ workerId: 2 })
  // await dataSource.collections.worker.update(2, (w) => {
  //   if (w.type === 'revisor') {
  //     w.about.height = 10
  //     w.password = 'password'
  //     // w.job_type = 'self_employed'
  //   }
  // })
  // await kit.addDictionary({
  //   dictionary: 'value_type',
  //   name: 'ТМЦ'
  // })
  // await kit.addOption({
  //   dictionary: 'regions',
  //   value: 'moscow',
  //   title: 'Москва'
  // })
  // await kit.addOption({
  //   dictionary: 'regions',
  //   value: 'shanghai',
  //   title: 'Шанхай'
  // })
  // await dataSource.collections.options.remove('moscow')
  // await kit.addRole({
  //   value: 'director',
  //   title: 'Директор'
  // })
  // await kit.addRevisorWorker({
  //   workerId: 3
  // })
  // await dataSource.collections.worker.remove(1)
}

async function bootstrapTest() {
  const app = await bootstrap()
  const dataSource = app.get<DataSource<AppScheme, MongoCollectionDriver<AppScheme>>>(
    getDataSourceToken(dataScheme)
  )

  try {
    console.log('Run Scenario')
    await runScenario(dataSource)
    console.log('Scenario Done!')
  } catch (error) {
    if (error instanceof CoreError) {
      console.error('CoreError:', error)
      return
    }

    throw error
  }
}

bootstrapTest()
