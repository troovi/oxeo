import { CollectionScheme, DataScheme, IType, ModelData } from '@oxeo/scheme'
import { DataSource, getGuaranteedValueByAddress } from '@oxeo/server'
import { TargetReferencesStore } from '@oxeo/scheme'

interface IntegrityError {
  reason:
    | 'model-not-exists'
    | 'relation-not-exists'
    | 'table-source-not-exists'
    | 'table-target-not-exists'
    | 'table-relation-not-bound'
  model: string
  itemId: IType
  address: string
  refId: IType
  tableName?: string
}

// interface TableReferenceInfo {
//   model: string
//   address: string
//   ref: RefsTypes.ReferenceSet | RefsTypes.ReferenceTo
// }

export class DevtoolsDataIntegrity<Scheme extends CollectionScheme = CollectionScheme> {
  constructor(
    private dataSource: DataSource<Scheme>,
    private dataScheme: DataScheme<Scheme>
  ) {}

  async check() {
    const errors: IntegrityError[] = []

    for (const name in this.dataSource.collections) {
      const collectionName = name as keyof Scheme

      const collectionInfo = this.dataScheme.collectionsScheme[collectionName]
      const collection = this.dataSource.collections[collectionName]

      const modeldata = this.dataScheme.models[collectionInfo.name]
      const items = await collection.getAll()

      for (const item of items) {
        const refs = this.getModelReferences(modeldata, item)
        const itemId = this.getModelId(modeldata, item)

        for (const address in refs) {
          const ref = refs[address]

          const checkExists = async (model: string, id: IType) => {
            const isExists = await this.dataSource.driver.exists({ model, id })

            if (!isExists) {
              errors.push({
                reason: 'model-not-exists',
                model: collectionInfo.name,
                itemId,
                address,
                refId: id
              })
            }
          }

          // reference

          if (ref.refType === 'reference-set') {
            const refIds = getGuaranteedValueByAddress(item, address) as IType[]

            const relations = await this.dataSource.driver.tables.getRecords({
              tableName: ref.tableName,
              modelSide: collectionInfo.name,
              modelId: itemId
            })

            for (const refId of refIds) {
              await checkExists(ref.model, refId)

              if (!relations.includes(refId)) {
                errors.push({
                  reason: 'relation-not-exists',
                  model: collectionInfo.name,
                  itemId,
                  address,
                  refId,
                  tableName: ref.tableName
                })
              }
            }

            continue
          }

          if (ref.refType === 'reference-to') {
            const refId = getGuaranteedValueByAddress(item, address) as IType

            if (!ref.nullable || (ref.nullable && refId !== null)) {
              await checkExists(ref.model, refId)

              const relations = await this.dataSource.driver.tables.getRecords({
                tableName: ref.tableName,
                modelSide: collectionInfo.name,
                modelId: itemId
              })

              if (!relations.includes(refId)) {
                errors.push({
                  reason: 'relation-not-exists',
                  model: collectionInfo.name,
                  itemId,
                  address,
                  refId,
                  tableName: ref.tableName
                })
              }
            }

            continue
          }

          // ownership

          if (ref.refType === 'belongs-to') {
            const refId = getGuaranteedValueByAddress(item, address) as IType
            await checkExists(ref.model, refId)

            continue
          }

          if (ref.refType === 'has-many') {
            const refIds = getGuaranteedValueByAddress(item, address) as IType[]

            for (const refId of refIds) {
              await checkExists(ref.model, refId)
            }

            continue
          }

          // fallbacks

          if (ref.refType === 'owner-fallback') {
            const refId = getGuaranteedValueByAddress(item, address) as IType
            await checkExists(ref.model, refId)

            continue
          }

          if (ref.refType === 'owner') {
            const refId = getGuaranteedValueByAddress(item, address) as IType
            await checkExists(ref.model, refId)

            continue
          }
        }
      }
    }

    // for (const [tableName, tableRef] of Object.entries(this.getTableReferences())) {
    //   const rows = await this.getTableRows(tableName)

    //   for (const row of rows) {
    //     const source = await this.dataSource.driver.get({ model: tableRef.model, id: row.m1 })

    //     if (!source) {
    //       errors.push({
    //         reason: 'table-source-not-exists',
    //         model: tableRef.model,
    //         itemId: row.m1,
    //         address: tableRef.address,
    //         refId: row.m2,
    //         tableName
    //       })

    //       continue
    //     }

    //     const isTargetExists = await this.dataSource.driver.exists({ model: tableRef.ref.model, id: row.m2 })

    //     if (!isTargetExists) {
    //       errors.push({
    //         reason: 'table-target-not-exists',
    //         model: tableRef.model,
    //         itemId: row.m1,
    //         address: tableRef.address,
    //         refId: row.m2,
    //         tableName
    //       })
    //     }

    //     const sourceValue = getGuaranteedValueByAddress(source, tableRef.address)
    //     const isBound =
    //       tableRef.ref.refType === 'reference-set'
    //         ? (sourceValue as IType[]).includes(row.m2)
    //         : sourceValue === row.m2

    //     if (!isBound) {
    //       errors.push({
    //         reason: 'table-relation-not-bound',
    //         model: tableRef.model,
    //         itemId: row.m1,
    //         address: tableRef.address,
    //         refId: row.m2,
    //         tableName
    //       })
    //     }
    //   }
    // }

    return errors
  }

  private getModelReferences({ refscheme, scheme }: ModelData, data: object): TargetReferencesStore {
    const { commonRefs, discriminatorRefs } = refscheme

    if (scheme.type === 'discriminated' && discriminatorRefs) {
      const discriminator = data[scheme.discriminatorKey as keyof object] as string

      return {
        ...discriminatorRefs[discriminator],
        ...commonRefs
      }
    }

    return { ...commonRefs }
  }

  private getModelId({ scheme }: ModelData, data: object): IType {
    return data[scheme.identifier.propertyKey as keyof object] as IType
  }

  // private getTableReferences() {
  //   const tableRefs: { [tableName: string]: TableReferenceInfo } = {}

  //   for (const model in this.dataScheme.models) {
  //     const { refscheme } = this.dataScheme.models[model]
  //     const stores = [
  //       refscheme.commonRefs,
  //       ...Object.values(refscheme.discriminatorRefs ?? {})
  //     ] as TargetReferencesStore[]

  //     for (const refs of stores) {
  //       for (const address in refs) {
  //         const ref = refs[address]

  //         if (ref.refType === 'reference-set' || ref.refType === 'reference-to') {
  //           tableRefs[ref.tableName] ??= { model, address, ref }
  //         }
  //       }
  //     }
  //   }

  //   return tableRefs
  // }

  // private async getTableRows(tableName: string) {
  //   const tables = this.dataSource.driver.tables as unknown as {
  //     getTables?: () => Promise<Record<string, unknown>> | Record<string, unknown>
  //   }

  //   if (!tables.getTables) {
  //     return []
  //   }

  //   const state = await tables.getTables()
  //   const table = state[tableName]

  //   if (!table) {
  //     return []
  //   }

  //   if (Array.isArray(table)) {
  //     return table as TableRow[]
  //   }

  //   const rows: TableRow[] = []
  //   const store = table as { m1?: Record<string, IType[]> }

  //   for (const modelId in store.m1 ?? {}) {
  //     for (const oppositeId of store.m1?.[modelId] ?? []) {
  //       rows.push({ m1: modelId, m2: oppositeId })
  //     }
  //   }

  //   return rows
  // }
}
