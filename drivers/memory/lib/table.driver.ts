import { CollectionScheme, DataScheme, IType, RelationsTableInfo } from '@oxeo/scheme'
import {
  OppositeSlice,
  RelationRecord,
  TableDriver,
  TableRelationSlice,
  TableRow,
  __DEV__,
  styles,
  xRay
} from '@oxeo/server'

export interface TableStore {
  [modelId: IType]: IType[]
}

export class IndexedTableStore {
  private tableName: string
  private modelKey: { [model: string]: 'm1' | 'm2' } = {}
  private keyMirror = { m1: 'm2' as 'm2', m2: 'm1' as 'm1' }
  private oppositeModels: { m1: string; m2: string } = { m1: '', m2: '' }

  // { m1: modelId1, m2: modelId2 } (modelId1 может иметь такое же значение как и modelId2 - ведь они принадлежат к разным моделям)
  // { m1: modelId1, m2: modelId3 }
  // { m1: modelId1, m2: modelId4 }
  // { m1: modelId1, m2: modelId5 }

  // коллекция ключей m1:
  // modelId1: [modelId2, modelId3, modelId4, modelId5]

  // коллекция ключей m2:
  // modelId2: [modelId1]
  // modelId3: [modelId1]
  // modelId4: [modelId1]
  // modelId5: [modelId1]

  private store: { m1: TableStore; m2: TableStore } = {
    m1: {},
    m2: {}
  }

  constructor(table: RelationsTableInfo) {
    this.tableName = table.tableName

    this.modelKey[table.rules.m1] = 'm1'
    this.modelKey[table.rules.m2] = 'm2'

    this.oppositeModels.m1 = table.rules.m2
    this.oppositeModels.m2 = table.rules.m1
  }

  getStore() {
    return this.store
  }

  initialize(rows: TableRow[]) {
    rows.forEach((row) => this.createRow(row))
  }

  private getRow({ modelId, modelSide, oppositeId }: Omit<RelationRecord, 'tableName'>) {
    const key = this.modelKey[modelSide]
    const row = { [key]: modelId, [this.keyMirror[key]]: oppositeId } as unknown as TableRow

    return row
  }

  private createRow(row: TableRow) {
    if (!this.store.m1[row.m1]) {
      this.store.m1[row.m1] = []
    }

    if (!this.store.m2[row.m2]) {
      this.store.m2[row.m2] = []
    }

    this.store.m1[row.m1].push(row.m2)
    this.store.m2[row.m2].push(row.m1)
  }

  addRow({ modelId, modelSide, oppositeId }: RelationRecord) {
    const row = this.getRow({ modelId, modelSide, oppositeId })

    this.createRow(row)

    if (__DEV__) {
      // prettier-ignore
      xRay.print('TABLE:ADD-ROW', styles.boldPink)({ modelId, modelSide, oppositeId }, { row, store: this.store, modelKey: this.modelKey, tableName: this.tableName })
    }
  }

  removeRow({ modelId, modelSide, oppositeId }: RelationRecord) {
    const row = this.getRow({ modelId, modelSide, oppositeId })

    ;(['m1', 'm2'] as const).forEach((side) => {
      const source = this.store[side][row[side]] ?? []

      const index = source.findIndex((id) => {
        return id === row[this.keyMirror[side]]
      })

      if (index !== -1) {
        source.splice(index, 1)
      }

      if (source.length === 0) {
        delete this.store[side][row[side]]
      }
    })

    // this.addRow(row)
    if (__DEV__) {
      // prettier-ignore
      xRay.print('TABLE:REMOVE-ROW', styles.boldPink)({ modelId, modelSide, oppositeId }, { row, store: this.store, modelKey: this.modelKey, tableName: this.tableName })
    }
  }

  removeModel(model: string, modelId: IType) {
    const key = this.modelKey[model]

    ;(this.store[key][modelId] ?? []).forEach((oppositeId) => {
      const source = this.store[this.keyMirror[key]][oppositeId]

      const index = source.findIndex((item) => {
        return item === modelId
      })

      if (index !== -1) {
        source.splice(index, 1)
      }

      if (source.length === 0) {
        delete this.store[this.keyMirror[key]][oppositeId]
      }
    })

    delete this.store[key][modelId]

    if (__DEV__) {
      // prettier-ignore
      xRay.print('TABLE:REMOVE-MODEL', styles.boldPink)({ model, modelId }, this.store, 'where:', this.modelKey, this.tableName)
    }
  }

  getRelations(model: string, modelId: IType) {
    if (!this.modelKey[model] || !this.store[this.modelKey[model]]) {
      return []
    }

    return this.store[this.modelKey[model]][modelId] ?? []
  }

  getOppositeModelName(model: string) {
    return this.oppositeModels[this.modelKey[model]]
  }
}

export class MemoryTableDriver<T extends CollectionScheme> implements TableDriver {
  private tables: { [tableName: string]: IndexedTableStore } = {}

  constructor(dataScheme: DataScheme<T>) {
    dataScheme.tables.forEach((table) => {
      this.tables[table.tableName] = new IndexedTableStore(table)
    })
  }

  bootstrap(tables: { [tableName: string]: TableRow[] }) {
    for (const tableName in tables) {
      this.tables[tableName].initialize(tables[tableName])
    }
  }

  async createRecord(row: RelationRecord) {
    if (__DEV__) {
      xRay.print('TABLE:ADD-RECORD', styles.pink)(row)
    }

    this.tables[row.tableName].addRow(row)
  }

  async removeRecord(row: RelationRecord) {
    if (__DEV__) {
      xRay.print('TABLE:REMOVE-RECORD', styles.pink)(row)
    }

    this.tables[row.tableName].removeRow(row)
  }

  async removeRecordsByModel(row: TableRelationSlice) {
    if (__DEV__) {
      xRay.print('TABLE:REMOVE-MODEL', styles.pink)(row)
    }

    this.tables[row.tableName].removeModel(row.modelSide, row.modelId)
  }

  async getRecords({ tableName, modelSide, modelId }: TableRelationSlice) {
    if (!this.tables[tableName]) {
      return []
    }

    return this.tables[tableName].getRelations(modelSide, modelId)
  }

  async getOppositeModelName({ tableName, modelSide }: OppositeSlice) {
    return this.tables[tableName].getOppositeModelName(modelSide)
  }

  // development

  getTables() {
    const state: { [name: string]: { m1: TableStore; c1: number; m2: TableStore; c2: number } } = {}

    for (const tableName in this.tables) {
      const { m1, m2 } = this.tables[tableName].getStore()

      const getLength = (o: object) => {
        return Object.keys(o).length
      }

      state[tableName] = { m1, c1: getLength(m1), m2, c2: getLength(m2) }
    }

    return state
  }
}
