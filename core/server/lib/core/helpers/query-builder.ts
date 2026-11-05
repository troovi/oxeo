import { IType } from '@oxeo/scheme'
import {
  CollectionDriverParams,
  RelationRecord,
  TableRelationSlice,
  UpdatePatch
} from '../types/driver.types'

export interface DriverQueries {
  // models
  'collections.create': CollectionDriverParams.Create
  'collections.remove': CollectionDriverParams.Record
  'collections.update': CollectionDriverParams.Update
  'collections.replace': CollectionDriverParams.Replace
  // table
  'table.removeRecordsByModel': TableRelationSlice
  'table.removeRecord': RelationRecord
  'table.createRecord': RelationRecord
}

export type DriverQueryMap = { [K in keyof DriverQueries]: { action: K; params: DriverQueries[K] } }
export type DriverQuery = DriverQueryMap[keyof DriverQueries]

export const createQueryBuilder = () => {
  const queriesStore: DriverQuery[] = []
  const patchesStore: { [model: string]: Map<IType, UpdatePatch[]> } = {}

  const setPatch = ({ model, id, patches }: CollectionDriverParams.Update) => {
    if (!patchesStore[model]) {
      patchesStore[model] = new Map()
    }

    if (!patchesStore[model].has(id)) {
      patchesStore[model].set(id, [])
    }

    patchesStore[model].get(id)!.push(...patches)
  }

  const getStore = (): DriverQuery[] => {
    const items = [...queriesStore]

    for (const model in patchesStore) {
      for (const id of patchesStore[model].keys()) {
        // id может быть string, а может быть number, но мы возвращаем его как string
        items.push({
          action: 'collections.update',
          params: { model, id, patches: patchesStore[model].get(id) ?? [] }
        })
      }
    }

    return items
  }

  return {
    put<T extends keyof DriverQueries>(action: T, params: DriverQueries[T]) {
      if (action === 'collections.update') {
        setPatch(params as DriverQueries['collections.update'])
        return
      }

      queriesStore.push({ action, params } as DriverQuery)
    },
    build: (options: { optimize?: boolean } = {}): DriverQuery[] => {
      if (options.optimize) {
        const removeModels = queriesStore.filter(
          (item): item is DriverQueryMap['collections.remove'] => {
            return item.action === 'collections.remove'
          }
        )

        // нет смысла вносить изменения в модель, которая удалится
        return getStore().filter(({ action, params }) => {
          const isModelAlreadyRemoving = removeModels.find(({ params: { model, id } }) => {
            return action === 'collections.update' && params.model === model && params.id === id
          })

          return !isModelAlreadyRemoving
        })
      }

      return getStore()
    },
    merge: (queries: DriverQuery[]) => {
      queries.forEach((query) => {
        if (query.action === 'collections.update') {
          setPatch(query.params)
        } else {
          queriesStore.push(query)
        }
      })
    }
  }
}
