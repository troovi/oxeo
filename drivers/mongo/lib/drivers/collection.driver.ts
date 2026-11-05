import { CollectionScheme, DataScheme, ExtractType } from '@oxeo/scheme'
import { CollectionDriverAsync, CollectionDriverParams } from '@oxeo/server'
import { MongoRelationsTable } from './table.driver'
import { Connection, Model, Schema } from 'mongoose'
import { DefinitionsFactory } from '../factories/definitions.factory'
import { Logger } from '@nestjs/common'
import { buildFlattenMap } from '../utils/flatten'

/** Модель с любыми параметрами: `discriminator` возвращает модель со своими виртуальными полями. */
type AnyModel = Model<any, any, any, any, any, any, any>

interface DiscriminatedModels {
  [model: string]: {
    discriminatorKey: string
    models: {
      [value: string]: AnyModel
    }
  }
}

export interface MongoDriverOptions {
  connection: Connection
  dev?: boolean
}

export class MongoCollectionDriver<Scheme extends CollectionScheme> implements CollectionDriverAsync {
  readonly type = 'async'

  private dev = false
  private onClenupCallbacks: { [model: string]: ((data: any) => void)[] } = {}
  private collections: { [model: string]: Model<any> } = {}
  private discriminatedModels: DiscriminatedModels = {}

  public tables: MongoRelationsTable<Scheme>

  constructor(
    private dataScheme: DataScheme<Scheme>,
    { connection, dev }: MongoDriverOptions
  ) {
    Logger.log('Driver bootstrap', 'MongoDriver')

    this.dev = dev ?? false
    this.tables = new MongoRelationsTable(dataScheme, connection)

    const factory = new DefinitionsFactory(dataScheme)

    const getModel = <T>(model: string, schema: Schema): Model<T> => {
      return connection.models[model] ?? connection.model(model, schema)
    }

    for (const name in dataScheme.collectionsScheme) {
      const model = dataScheme.collectionsScheme[name].name
      const scheme = dataScheme.models[model].scheme

      const baseDefinition = factory.createForScheme(scheme)

      if (scheme.type === 'base') {
        this.collections[model] = getModel(model, new Schema(baseDefinition))
      }

      if (scheme.type === 'discriminated') {
        this.collections[model] = getModel(
          model,
          new Schema(baseDefinition, {
            discriminatorKey: scheme.discriminatorKey
          })
        )

        this.discriminatedModels[model] = {
          discriminatorKey: scheme.discriminatorKey,
          models: {}
        }

        for (const discriminator of scheme.discriminators) {
          const discriminatedModel = this.collections[model].discriminator(
            discriminator.name,
            new Schema(factory.createDefinitionScheme(discriminator)),
            discriminator.value
          )

          this.discriminatedModels[model].models[discriminator.value] = discriminatedModel
        }
      }
    }
  }

  // prettier-ignore
  subscribeCleanup<K extends keyof Scheme>(name: K, callback: (data: ExtractType<Scheme[K]['model']>) => void){
    const model = this.dataScheme.collectionsScheme[name].name

    if(!this.onClenupCallbacks[model]){
      this.onClenupCallbacks[model] = []
    }

    this.onClenupCallbacks[model].push(callback)
  }

  async findOneBy({ model, filter }: CollectionDriverParams.Filter) {
    return this.collections[model].findOne(buildFlattenMap(filter)).lean().exec()
  }

  async findBy({ model, filter }: CollectionDriverParams.Filter) {
    return this.collections[model].find(buildFlattenMap(filter)).lean().exec()
  }

  async getAll({ model }: CollectionDriverParams.Model) {
    return this.collections[model].find().lean().exec()
  }

  async get({ model, id }: CollectionDriverParams.Record) {
    return this.collections[model].findOne({ [this.getIdentifierKey(model)]: id }).lean()
  }

  async exists({ model, id }: CollectionDriverParams.Record) {
    const result = await this.collections[model].exists({
      [this.getIdentifierKey(model)]: id
    })

    return result !== null
  }

  async count({ model, filter }: CollectionDriverParams.Count) {
    return this.collections[model].countDocuments(buildFlattenMap(filter ?? {}))
  }

  async existsBy({ model, filter }: CollectionDriverParams.Filter) {
    const result = await this.collections[model].exists(buildFlattenMap(filter))

    return result !== null
  }

  // setters

  async create({ model, data }: CollectionDriverParams.Create) {
    if (this.dev) {
      this.log({ op: 'COLLECTIONS:CREATE', model, data })
    }

    await new this.collections[model](data).save()
  }

  async remove({ model, id }: CollectionDriverParams.Record) {
    if (this.dev) {
      this.log({ op: 'COLLECTIONS:REMOVE', model, id })
    }

    const cache = { data: null as null | object }

    if (this.onClenupCallbacks[model]) {
      cache.data = await this.get({ model, id })
    }

    await this.collections[model].deleteOne({ [this.getIdentifierKey(model)]: id }).exec()

    if (cache.data) {
      this.onClenupCallbacks[model].forEach((cb) => {
        cb(cache.data)
      })
    }
  }

  // при update для discriminated collection нельзя всегда использовать только this.collections[model]
  // нужно сначала получить документ по id, узнать его discriminatorKey (type), и если это дискриминатор, выполнять updateOne() через соответствующую discriminator model
  async update({ model, id, patches }: CollectionDriverParams.Update) {
    const identifierKey = this.getIdentifierKey(model)
    const collection = await this.getCollection({ model, id })

    const responses = await Promise.all(
      patches.map(async (patch) => {
        switch (patch.type) {
          case 'set': {
            return collection.updateOne(
              { [identifierKey]: id },
              { $set: { [patch.address]: patch.value } }
            )
          }
          case 'push': {
            return collection.updateOne(
              { [identifierKey]: id },
              { $push: { [patch.address]: { $each: patch.items } } }
            )
          }
          case 'pull': {
            return collection.updateOne(
              { [identifierKey]: id },
              { $pull: { [patch.address]: { $in: patch.items } } }
            )
          }
        }
      })
    )

    // check transaction
    for (const response of responses) {
      if (!response.acknowledged) {
        console.log('MongoDB Write Warning', { model, id, patches }, responses)
      }
    }

    if (this.dev) {
      this.log({ op: 'COLLECTIONS:UPDATE', id, patches })
    }
  }

  // полная замена документа по id (используется при смене дискриминатора).
  // replaceOne по базовой модели перезаписывает документ целиком, включая поле-дискриминатор
  async replace({ model, id, data }: CollectionDriverParams.Replace) {
    if (this.dev) {
      this.log({ op: 'COLLECTIONS:REPLACE', model, id, data })
    }

    await this.collections[model].replaceOne({ [this.getIdentifierKey(model)]: id }, data).exec()
  }

  private async getCollection({ model, id }: CollectionDriverParams.Record) {
    if (this.discriminatedModels[model]) {
      const target = await this.get({ model, id })
      const discriminatorValue = target[this.discriminatedModels[model].discriminatorKey] as string

      return this.discriminatedModels[model].models[discriminatorValue]
    }

    return this.collections[model]
  }

  private getIdentifierKey(model: string) {
    return this.dataScheme.models[model].scheme.identifier.propertyKey
  }

  private log(item: object) {
    console.dir(item, { depth: null, colors: true })
  }
}

export const createMongoDriver = (options: MongoDriverOptions) => {
  return <T extends CollectionScheme>(dataScheme: DataScheme<T>) => {
    return new MongoCollectionDriver(dataScheme, options)
  }
}
