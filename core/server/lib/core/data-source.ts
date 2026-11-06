import { CollectionApi, CollectionScheme, Collections, DataScheme, IType } from '@oxeo/scheme'
import { xRay } from '../utils/x-ray'
import { __DEV__ } from '../utils'

import { CollectionWrite, DataProcessor } from './data-processor'
import { CollectionDriver } from './types/driver.types'

type CollectionApiShape = {
  [K in keyof CollectionApi]: (...params: Parameters<CollectionApi[K]>) => unknown
}

interface DataSourceOptions<Scheme extends CollectionScheme, Driver extends CollectionDriver> {
  createDriver: (dataScheme: DataScheme<Scheme>) => Driver
}

// prettier-ignore
export class DataSource<Scheme extends CollectionScheme, Driver extends CollectionDriver = CollectionDriver> {
  public driver: Driver
  public scheme: DataScheme<Scheme>
  public collections = {} as Collections<Scheme>

  private writeListeners = new Set<(write: CollectionWrite) => void>()

  constructor(dataScheme: DataScheme<Scheme>, { createDriver }: DataSourceOptions<Scheme, Driver>) {
    const driver = createDriver(dataScheme)
    const processor = new DataProcessor(dataScheme, driver, (write) => {
      this.writeListeners.forEach((listener) => listener(write))
    })

    if (__DEV__) {
      xRay.print('dataScheme')(dataScheme)
    }

    this.driver = driver
    this.scheme = dataScheme

    for (const name in dataScheme.collectionsScheme) {
      const collectionScheme = dataScheme.collectionsScheme[name]

      const baseCollectionApi: CollectionApiShape = {
        // driver methods
        getAll: () => {
          return driver.getAll({ model: collectionScheme.name })
        },
        get: (id) => {
          return driver.get({ model: collectionScheme.name, id })
        },
        findOneBy: (filter) => {
          return driver.findOneBy({ model: collectionScheme.name, filter })
        },
        findBy: (filter, opts) => {
          return driver.findBy({ model: collectionScheme.name, filter, opts })
        },
        existsBy: (filter) => {
          return driver.existsBy({ model: collectionScheme.name, filter })
        },
        exists: (id) => {
          return driver.exists({ model: collectionScheme.name, id })
        },
        count: (filter = {}) => {
          return driver.count({ model: collectionScheme.name, filter })
        },
        // data changing
        create: (data) => {
          return processor.create(data, collectionScheme.name)
        },
        remove: (id) => {
          return processor.remove(id, collectionScheme.name)
        },
        update: (id, mutate) => {
          return processor.update(id, collectionScheme.name, mutate)
        },
        getExternalRelations: (id) => {
          return processor.getExternalRelations(id, collectionScheme.name)
        }
      }

      // changeDiscriminator существует в рантайме у всех коллекций, но в типах открыт только у
      // дискриминированных (см. DiscriminatedExtension); на обычной коллекции бросит CoreError
      const collection = {
        ...baseCollectionApi,
        changeDiscriminator: (id: IType, nextValue: string, patch: object) => {
          return processor.changeDiscriminator(id, collectionScheme.name, nextValue, patch)
        }
      }

      ;(this.collections as Record<string, unknown>)[name] = collection
    }
  }

  /**
   * Слушатель записей в базу: каждая запись коллекции (`create`, `update`, `remove`, `replace`), которую делает
   * `DataProcessor`, — модель и id, до выполнения запросов к драйверу. Не зависит от драйвера; строки таблиц связей не
   * сообщаются. Так рантайм доменов узнаёт, какие записи тронула операция.
   */
  subscribeWrites(listener: (write: CollectionWrite) => void) {
    this.writeListeners.add(listener)

    return () => {
      this.writeListeners.delete(listener)
    }
  }
}
