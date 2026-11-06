import { CollectionScheme, DataScheme } from '@oxeo/scheme'
import { CollectionDriver, CollectionDriverParams } from '@oxeo/server'
import { MemoryTableDriver } from './table.driver'
import { IndexedCollectionStore } from './indexed.collection'

export class MemoryCollectionDriver<Scheme extends CollectionScheme> implements CollectionDriver {
  private collections: { [model: string]: IndexedCollectionStore<object> } = {}
  public tables: MemoryTableDriver<Scheme>

  constructor(dataScheme: DataScheme<Scheme>) {
    this.tables = new MemoryTableDriver(dataScheme)

    for (const model in dataScheme.collectionsScheme) {
      this.collections[dataScheme.collectionsScheme[model].name] = new IndexedCollectionStore(
        dataScheme.collectionsScheme[model]
      )
    }
  }

  async getAll({ model }: CollectionDriverParams.Model) {
    return this.collections[model].getAll()
  }

  async get({ model, id }: CollectionDriverParams.Record) {
    return this.collections[model].get(id)
  }

  async findOneBy({ model, filter }: CollectionDriverParams.Filter) {
    return this.collections[model].findOneBy(filter)
  }

  async findBy({ model, filter, opts }: CollectionDriverParams.Find) {
    return this.collections[model].findBy(filter, opts)
  }

  async exists({ model, id }: CollectionDriverParams.Record) {
    return this.collections[model].exists(id)
  }

  async existsBy({ model, filter }: CollectionDriverParams.Filter) {
    return this.collections[model].existsBy(filter)
  }

  async count({ model, filter }: CollectionDriverParams.Count) {
    return this.collections[model].count(filter)
  }

  // mutations

  async create({ model, data }: CollectionDriverParams.Create) {
    this.collections[model].create(data)
  }

  async remove({ model, id }: CollectionDriverParams.Record) {
    this.collections[model].remove(id)
  }

  async update({ model, id, patches }: CollectionDriverParams.Update) {
    this.collections[model].update(id, patches)
  }

  async replace({ model, id, data }: CollectionDriverParams.Replace) {
    this.collections[model].replace(id, data)
  }
}

export const createMemoryDriver = <T extends CollectionScheme>(dataScheme: DataScheme<T>) => {
  return new MemoryCollectionDriver(dataScheme)
}
