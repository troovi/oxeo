import { CollectionScheme, DataScheme, ExtractType } from '@oxeo/scheme'
import { CollectionDriverParams, CollectionDriverSync } from '@oxeo/server'
import { MemoryTableDriver } from './table.driver'
import { IndexedCollectionStore } from './indexed.collection'

export namespace MutationEvents {
  export interface Remove {
    type: 'remove'
    data: CollectionDriverParams.Record
  }

  export interface Update {
    type: 'update'
    data: CollectionDriverParams.Update
  }

  export interface Create {
    type: 'create'
    data: CollectionDriverParams.Create
  }

  export interface Replace {
    type: 'replace'
    data: CollectionDriverParams.Replace
  }
}

export type MutationEvent =
  MutationEvents.Create | MutationEvents.Remove | MutationEvents.Update | MutationEvents.Replace

export class MemoryCollectionDriver<Scheme extends CollectionScheme> implements CollectionDriverSync {
  readonly type = 'sync'

  private onCreateCallbacks: { [model: string]: ((data: any) => void)[] } = {}
  private onMutationCallbacks: ((mutation: MutationEvent) => void)[] = []

  private collections: { [model: string]: IndexedCollectionStore<object> } = {}
  public tables: MemoryTableDriver<Scheme>

  constructor(private dataScheme: DataScheme<Scheme>) {
    this.tables = new MemoryTableDriver(dataScheme)

    for (const model in dataScheme.collectionsScheme) {
      this.collections[dataScheme.collectionsScheme[model].name] = new IndexedCollectionStore(
        dataScheme.collectionsScheme[model]
      )
    }
  }

  bootstrap(data: { [K in keyof Scheme]: ExtractType<Scheme[K]['model']>[] }) {
    for (const key in data) {
      this.collections[this.dataScheme.collectionsScheme[key].name].initialize(data[key])
    }
  }

  // prettier-ignore
  subscribeCreate<K extends keyof Scheme>(name: K, callback: (data: ExtractType<Scheme[K]['model']>) => void) {
    const model = this.dataScheme.collectionsScheme[name].name

    if (!this.onCreateCallbacks[model]) {
      this.onCreateCallbacks[model] = []
    }

    this.onCreateCallbacks[model].push(callback)
  }

  subscribeOnMutation(callback: (mutation: MutationEvent) => void) {
    this.onMutationCallbacks.push(callback)
  }

  getAll({ model }: CollectionDriverParams.Model) {
    return this.collections[model].getAll()
  }

  get({ model, id }: CollectionDriverParams.Record) {
    return this.collections[model].get(id)
  }

  findOneBy({ model, filter }: CollectionDriverParams.Filter) {
    return this.collections[model].findOneBy(filter)
  }

  findBy({ model, filter }: CollectionDriverParams.Filter) {
    return this.collections[model].findBy(filter)
  }

  exists({ model, id }: CollectionDriverParams.Record) {
    return this.collections[model].exists(id)
  }

  existsBy({ model, filter }: CollectionDriverParams.Filter) {
    return this.collections[model].existsBy(filter)
  }

  count({ model, filter }: CollectionDriverParams.Count) {
    return this.collections[model].count(filter)
  }

  // mutations

  create({ model, data }: CollectionDriverParams.Create) {
    if (this.onCreateCallbacks[model]) {
      this.onCreateCallbacks[model].forEach((cb) => cb(data))
    }

    this.collections[model].create(data)

    this.onMutationCallbacks.forEach((cb) => {
      cb({ type: 'create', data: { model, data } })
    })
  }

  remove({ model, id }: CollectionDriverParams.Record) {
    this.collections[model].remove(id)

    this.onMutationCallbacks.forEach((cb) => {
      cb({ type: 'remove', data: { model, id } })
    })
  }

  update({ model, id, patches }: CollectionDriverParams.Update) {
    this.collections[model].update(id, patches)

    this.onMutationCallbacks.forEach((cb) => {
      cb({ type: 'update', data: { model, id, patches } })
    })
  }

  replace({ model, id, data }: CollectionDriverParams.Replace) {
    this.collections[model].replace(id, data)

    this.onMutationCallbacks.forEach((cb) => {
      cb({ type: 'replace', data: { model, id, data } })
    })
  }
}

export const createMemoryDriver = <T extends CollectionScheme>(dataScheme: DataScheme<T>) => {
  return new MemoryCollectionDriver(dataScheme)
}
