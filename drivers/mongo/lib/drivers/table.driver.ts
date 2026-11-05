import { CollectionScheme, DataScheme, IType, RelationsTableInfo } from '@oxeo/scheme'
import {
  OppositeSlice,
  RelationRecord,
  TableDriver,
  TableRelationSlice,
  TableRow
} from '@oxeo/server'
import { Connection, Model, Schema, SchemaDefinition } from 'mongoose'

class MongoTableStore {
  private modelKey: { [model: string]: 'm1' | 'm2' } = {}
  private keyMirror = { m1: 'm2' as 'm2', m2: 'm1' as 'm1' }
  private oppositeModels: { m1: string; m2: string } = { m1: '', m2: '' }

  private model: Model<TableRow>

  constructor({ rules, tableName }: RelationsTableInfo, private connection: Connection) {
    this.modelKey[rules.m1] = 'm1'
    this.modelKey[rules.m2] = 'm2'
    this.model = this.useModel<TableRow>(tableName, new Schema(this.getSchemeDefinition()))

    this.oppositeModels.m1 = rules.m2
    this.oppositeModels.m2 = rules.m1
  }

  private getSchemeDefinition(): SchemaDefinition {
    return {
      m1: { type: Schema.Types.Mixed, index: true, required: true },
      m2: { type: Schema.Types.Mixed, index: true, required: true }
    }
  }

  private getRow({ modelId, modelSide, oppositeId }: RelationRecord) {
    const key = this.modelKey[modelSide]
    const row = { [key]: modelId, [this.keyMirror[key]]: oppositeId } as unknown as TableRow

    return row
  }

  async addRow(row: RelationRecord) {
    await this.model.create(this.getRow(row))
  }

  async removeRow(row: RelationRecord) {
    await this.model.deleteOne(this.getRow(row)).exec()
  }

  async removeModel(model: string, modelId: IType) {
    await this.model.deleteMany({ [this.modelKey[model]]: modelId }).exec()
  }

  async getRelations(model: string, modelId: IType) {
    const key = this.modelKey[model]
    const oppositeKey = this.keyMirror[key]

    const rows = await this.model
      .find({ [key]: modelId })
      .select({ [oppositeKey]: 1, _id: 0 })
      .lean()
      .exec()

    return rows.map((row) => row[oppositeKey] as IType)
  }

  private useModel<T>(model: string, schema: Schema): Model<T> {
    return this.connection.models[model] ?? this.connection.model(model, schema)
  }

  getStore() {
    return this.model.find().lean().exec()
  }

  getOppositeModelName(model: string) {
    return this.oppositeModels[this.modelKey[model]]
  }
}

export class MongoRelationsTable<T extends CollectionScheme> implements TableDriver {
  private readonly tables: { [tableName: string]: MongoTableStore } = {}

  constructor(dataScheme: DataScheme<T>, connection: Connection) {
    for (const table of dataScheme.tables) {
      this.tables[table.tableName] = new MongoTableStore(table, connection)
    }
  }

  async createRecord(row: RelationRecord) {
    await this.tables[row.tableName].addRow(row)
  }

  async removeRecord(row: RelationRecord) {
    await this.tables[row.tableName].removeRow(row)
  }

  async removeRecordsByModel(row: TableRelationSlice) {
    await this.tables[row.tableName].removeModel(row.modelSide, row.modelId)
  }

  async getRecords({ tableName, modelSide, modelId }: TableRelationSlice) {
    return this.tables[tableName].getRelations(modelSide, modelId)
  }

  async getTables() {
    const state: { [name: string]: TableRow[] } = {}

    for (const tableName in this.tables) {
      state[tableName] = await this.tables[tableName].getStore()
    }

    return state
  }

  async getOppositeModelName({ tableName, modelSide }: OppositeSlice) {
    return this.tables[tableName].getOppositeModelName(modelSide)
  }
}
