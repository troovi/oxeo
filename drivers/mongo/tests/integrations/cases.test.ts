import { writeFile } from 'fs'

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '@jest/globals'
import { IndexedTableStore, TableStore } from '@oxeo-drivers/memory'
import { DataSource, TableRow } from '@oxeo/server'
import { getConnectionToken, getDataSourceToken } from '../../lib'

import { bootstrap } from '../app/bootstrap'
import { MongoCollectionDriver } from '../../lib/drivers/collection.driver'
import {
  AppScheme,
  BaseParams,
  DevtoolsDataIntegrity,
  MockKit,
  SearchCase,
  cases,
  createMockKit,
  dataScheme
} from '@oxeo/devkit'
import { Connection } from 'mongoose'
import { INestApplication } from '@nestjs/common'

interface TestOptions {
  params: BaseParams
  commitChanges: (kit: MockKit, dataSource: DataSource<AppScheme>) => Promise<void>
}

const normalizeMongoResult = <T>(record: T) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return record
  }

  const { _id, __v, ...rest } = record as Record<string, unknown>

  return rest as T
}

const normalizeCollection = <T>(records: T[]) => {
  return records.map(normalizeMongoResult)
}

const normalizeTableState = (tableState: { m1: TableStore; m2: TableStore }) => {
  const normalizeSide = (side: TableStore): TableStore => {
    const normalized: TableStore = {}

    for (const key of Object.keys(side).sort()) {
      normalized[key] = [...side[key]].sort((a, b) => String(a).localeCompare(String(b)))
    }

    return normalized
  }

  return {
    m1: normalizeSide(tableState.m1),
    m2: normalizeSide(tableState.m2)
  }
}

const getTablesState = async (tables: { [name: string]: TableRow[] }) => {
  const state: BaseParams['expectations']['tables'] = {}

  for (const table of dataScheme.tables) {
    const indexedStore = new IndexedTableStore(table)
    indexedStore.initialize(tables[table.tableName] ?? [])
    state[table.tableName] = normalizeTableState(indexedStore.getStore())
  }

  return state
}

const runCaseTest = async (app: INestApplication<any>, { params, commitChanges }: TestOptions) => {
  const { expectations } = params
  const dataSource = app.get<DataSource<AppScheme, MongoCollectionDriver<AppScheme>>>(
    getDataSourceToken(dataScheme)
  )

  const integrity = new DevtoolsDataIntegrity(dataSource, dataScheme)

  const errors = await integrity.check()

  expect(errors).toEqual([])

  await commitChanges(createMockKit(dataSource), dataSource).catch((error) => {
    expect(error).toEqual(expectations.error)
  })

  const snapshot = { result: {} as any, table: {} as object }

  for (const collection in dataSource.collections) {
    const collectionName = collection as keyof AppScheme

    await dataSource.collections[collectionName].getAll().then((result) => {
      snapshot.result[collectionName] = result
      expect(normalizeCollection(result as object[])).toEqual(expectations.scheme[collectionName] ?? [])
    })
  }

  const tableRows = await dataSource.driver.tables.getTables()
  const tables = await getTablesState(tableRows)

  snapshot.table = tableRows

  for (const table of dataScheme.tables) {
    try {
      expect(tables[table.tableName] ?? { m1: {}, m2: {} }).toEqual(
        normalizeTableState(expectations.tables[table.tableName] ?? { m1: {}, m2: {} })
      )
    } catch (error) {
      throw error
    }
  }

  return snapshot
}

const runSearchCase = async (app: INestApplication<any>, { params }: SearchCase) => {
  const dataSource = app.get<DataSource<AppScheme, MongoCollectionDriver<AppScheme>>>(
    getDataSourceToken(dataScheme)
  )

  const result = await params.execute(createMockKit(dataSource), dataSource)

  const normalize = (item: object | null | object[]) => {
    if (item === null) {
      return item
    }

    if (Array.isArray(item)) {
      return item.map(normalizeMongoResult)
    }

    return normalizeMongoResult(item)
  }

  for (const item of result) {
    expect(normalize(item.result)).toEqual(item.expect)
  }
}

describe('DataSource', () => {
  let app: INestApplication

  const buffer: object[] = []

  beforeAll(async () => {
    app = await bootstrap(3222)
  })

  beforeEach(async () => {
    const connection = app.get<Connection>(getConnectionToken())
    await connection.dropDatabase()
  })

  afterAll(async () => {
    const connection = app.get<Connection>(getConnectionToken())

    await new Promise<void>((resolve) => {
      writeFile(`./tests/${Date.now()}.test.json`, JSON.stringify(buffer), (err) => {
        if (err) {
          console.log('writeFile:', err)
          return
        }

        resolve()
      })
    })

    await connection.dropDatabase()
    await app.close()
  })

  for (const item of cases) {
    if (item.type === 'unit') {
      test(item.name, async () => {
        const snapshot = await runCaseTest(app, {
          params: item.params,
          commitChanges: (kit, dataSource) => item.params.execute(kit, dataSource)
        })

        buffer.push({ name: item.name, snapshot })
      })
    }

    if (item.type === 'dual') {
      for (const marker of item.markers) {
        test(`${item.name} / ${marker}`, async () => {
          const snapshot = await runCaseTest(app, {
            params: item.params,
            commitChanges: (kit, dataSource) => item.params.execute(kit, dataSource, marker)
          })

          buffer.push({ name: item.name, snapshot })
        })
      }
    }

    if (item.type === 'search') {
      test(item.name, async () => {
        await runSearchCase(app, item)
      })
    }
  }
})
