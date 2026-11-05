import { CollectionScheme, DataScheme } from '@oxeo/scheme'
import { DataSource } from '@oxeo/server'
import { MongoDriverOptions, createMongoDriver } from '../drivers/collection.driver'
import { DATA_SOURCE_TOKEN } from '../constants'

interface Store {
  token: string
  dataSource: DataSource<CollectionScheme> | null
}

class DataSourceStorageService {
  private store = new Map<DataScheme<CollectionScheme>, Store>()

  getProviderToken(dataScheme: DataScheme<CollectionScheme>) {
    if (this.store.has(dataScheme)) {
      return this.store.get(dataScheme)!.token
    }

    const token = `${DATA_SOURCE_TOKEN}-${this.store.size + 1}`

    this.store.set(dataScheme, {
      token,
      dataSource: null
    })

    return token
  }

  getSource(dataScheme: DataScheme<CollectionScheme>, options: MongoDriverOptions) {
    const data = this.store.get(dataScheme)

    if (!data) {
      throw new Error(`[MongoDriver] provided dataScheme not defined`)
    }

    if (!data.dataSource) {
      data.dataSource = new DataSource(dataScheme, {
        createDriver: createMongoDriver(options)
      })
    }

    return data.dataSource
  }
}

export const DataSourceStorage = new DataSourceStorageService()
