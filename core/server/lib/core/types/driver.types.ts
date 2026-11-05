import { IType, Promisify } from '@oxeo/scheme'

export namespace PatchActions {
  interface BasePatch {
    address: string
  }

  export interface Set extends BasePatch {
    type: 'set'
    value: unknown // maybe value, maybe null
  }

  // WARNING: не работает с вложенными массивами внутри массивов (работаем только с массивами идентификаторов)
  export interface Push extends BasePatch {
    type: 'push'
    items: IType[]
  }

  // WARNING: не работает с вложенными массивами внутри массивов (работаем только с массивами идентификаторов)
  export interface Pull extends BasePatch {
    type: 'pull'
    items: IType[] // { predicateKey: string | null; value: IType }
  }
}

export type UpdatePatch = PatchActions.Set | PatchActions.Push | PatchActions.Pull

export namespace CollectionDriverParams {
  export interface Model {
    model: string
  }

  export interface Record extends Model {
    id: IType
  }

  export interface Create extends Model {
    data: object
  }

  // полная замена документа по id (используется при смене дискриминатора —
  // нужно выкинуть скалярные поля старой формы, чего set-патчи не умеют)
  export interface Replace extends Record {
    data: object
  }

  export interface Update extends Record {
    patches: UpdatePatch[]
  }

  /** Фильтр — `Where` модели: равенство, операторы, вложенные embedded. */
  export interface Filter extends Model {
    filter: object
  }

  /** Число записей; без фильтра — всех. */
  export interface Count extends Model {
    filter?: object
  }
}

interface CollectionDriverSyncApis {
  // getters (public)
  getAll: (params: CollectionDriverParams.Model) => object[]
  get: (params: CollectionDriverParams.Record) => object | null
  exists: (params: CollectionDriverParams.Record) => boolean
  findOneBy: (params: CollectionDriverParams.Filter) => object | null
  findBy: (params: CollectionDriverParams.Filter) => object[]
  existsBy: (filter: CollectionDriverParams.Filter) => boolean
  count: (params: CollectionDriverParams.Count) => number
  // setters (private - cannot be accesed from dataSource level)
  create: (params: CollectionDriverParams.Create) => void
  remove: (params: CollectionDriverParams.Record) => void
  update: (params: CollectionDriverParams.Update) => void
  replace: (params: CollectionDriverParams.Replace) => void
}

export interface CollectionDriverSync extends CollectionDriverSyncApis {
  type: 'sync'
  tables: TableDriver
}

export interface CollectionDriverAsync extends Promisify<CollectionDriverSyncApis> {
  type: 'async'
  tables: TableDriver
}

export type AppCollectionDriver = CollectionDriverSync | CollectionDriverAsync

export interface TableRow {
  m1: IType
  m2: IType
}

export interface TableRelationSlice {
  tableName: string
  modelSide: string // относительно какой модели
  modelId: IType // воспринимать данный id
}

export interface OppositeSlice {
  tableName: string
  modelSide: string
}

export interface RelationRecord extends TableRelationSlice {
  oppositeId: IType
}

export abstract class TableDriver {
  getRecords: (_: TableRelationSlice) => Promise<IType[]>
  // при удалении модели
  removeRecordsByModel: (_: TableRelationSlice) => Promise<void>
  // при удалении связи (модели остаются)
  removeRecord: (_: RelationRecord) => Promise<void>
  createRecord: (_: RelationRecord) => Promise<void>
  // утилиты
  getOppositeModelName: (_: OppositeSlice) => Promise<string>
}
