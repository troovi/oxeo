import { ExtractType, IType, ReferenceScheme, TargetRefsTypes } from '@oxeo/scheme'
import { CoreError, DataSource, TableRow } from '@oxeo/server'
import { TableStore } from '@oxeo-drivers/memory'
import { type MockKit } from '../scheme/scheme.mock-kit'
import { dataScheme, type AppScheme } from '../scheme/scheme'

type Result = { [tableName: string]: { m1: TableStore; m2: TableStore } }

type Row = Partial<{ [name in keyof AppScheme]: IType }>

interface TestOptions {
  column: (refscheme: ReferenceScheme) => TargetRefsTypes
  rows: Row[]
}

const createTableTest = (name: keyof AppScheme, { column, rows }: TestOptions): Result => {
  const field = column(dataScheme.models[dataScheme.collectionsScheme[name].name].refscheme)

  if (field.refType === 'reference-to' || field.refType === 'reference-set') {
    const { rules } = dataScheme.tables.find((table) => table.tableName === field.tableName)!
    const modelsOfTable = { [rules.m1]: 'm1', [rules.m2]: 'm2' } as const

    // const keys = Object.keys(table) as (keyof AppScheme)[]
    const store: { m1: TableStore; m2: TableStore } = { m1: {}, m2: {} }
    const result: Result = {
      [field.tableName]: store
    }

    for (const row of rows) {
      const tableRow = {} as TableRow

      for (const model in row) {
        const side = modelsOfTable[dataScheme.collectionsScheme[model as keyof AppScheme].name]

        if (!side) {
          throw `${model} not belongs to ${JSON.stringify(rules)}`
        }

        tableRow[side] = row[model as keyof AppScheme]!
      }

      if (tableRow.m1 === undefined || tableRow.m2 === undefined) {
        throw 'Row has no m1 and m2'
      }
      // add row to store

      if (!store.m1[tableRow.m1]) {
        store.m1[tableRow.m1] = []
      }

      if (!store.m2[tableRow.m2]) {
        store.m2[tableRow.m2] = []
      }

      store.m1[tableRow.m1].push(tableRow.m2)
      store.m2[tableRow.m2].push(tableRow.m1)
    }

    return result
  }

  throw 'Field is not a table'
}

export { createTableTest }

export interface BaseParams {
  expectations: {
    tables: { [tableName: string]: { m1: TableStore; m2: TableStore } }
    scheme: Partial<{ [K in keyof AppScheme]: ExtractType<AppScheme[K]['model']>[] }>
    error?: CoreError
  }
}

export interface UnitCaseParams extends BaseParams {
  type: 'unit'
  execute: (kit: MockKit, dataSource: DataSource<AppScheme>) => Promise<void>
}

export interface DualCaseParams<T> extends BaseParams {
  type: 'dual'
  execute: (kit: MockKit, dataSource: DataSource<AppScheme>, market: T) => Promise<void>
}

export interface SearchCaseParams {
  type: 'search'
  // prettier-ignore
  execute: (kit: MockKit, dataSource: DataSource<AppScheme>) => Promise<{ result: object | null; expect: object | null }[]>
}

// prettier-ignore
export function createDualCase<T extends string>(name: string, markers: readonly T[], params: Omit<DualCaseParams<T>, 'type'>) {
  return { type: 'dual' as const, markers, name, params }
}

export function createCase(name: string, params: Omit<UnitCaseParams, 'type'>) {
  return { type: 'unit' as const, name, params }
}

export function createSearchCase(name: string, params: Omit<SearchCaseParams, 'type'>) {
  return { type: 'search' as const, name, params }
}

export type UnitCase = ReturnType<typeof createCase>
export type DualCase = ReturnType<typeof createDualCase>
export type SearchCase = ReturnType<typeof createSearchCase>
