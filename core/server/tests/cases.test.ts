import { describe, expect, test } from 'vitest'
import { cases, MockKit, createMockKit, AppScheme, dataScheme } from '@oxeo/devkit'
import { DevtoolsDataIntegrity } from '@oxeo/devkit'
import { createMemoryDriver } from '@oxeo-drivers/memory'
import { DataSource } from '../lib'
import { BaseParams, SearchCase } from '@oxeo/devkit'

type CommitChanges = (kit: MockKit, dataSource: DataSource<AppScheme>) => Promise<void>

const runCaseTest = async (params: BaseParams, commitChanges: CommitChanges) => {
  const { expectations } = params

  const dataSource = new DataSource(dataScheme, {
    createDriver: createMemoryDriver
  })

  const integrity = new DevtoolsDataIntegrity(dataSource, dataScheme)

  const errors = await integrity.check()

  expect(errors).toEqual([])

  await commitChanges(createMockKit(dataSource), dataSource).catch((error) => {
    expect(expectations.error).toEqual(error)
  })

  for (const collection in dataSource.collections) {
    const collectionName = collection as keyof AppScheme

    const result = await dataSource.collections[collectionName].getAll()
    // если схема не передана, значит, мы считаем, что она должна быть пустой
    expect(expectations.scheme[collectionName] ?? []).toEqual(result)
  }

  const tables = dataSource.driver.tables.getTables()

  for (const name in tables) {
    const { m1, m2 } = tables[name]
    try {
      // если таблица не была указана, значит, мы считаем, что она должна быть пустой
      expect(expectations.tables[name] ?? { m1: {}, m2: {} }).toEqual({ m1, m2 })
    } catch (e) {
      console.log('expected:', tables[name])
      console.log('recieved:', expectations.tables)
      throw e
    }
  }
}

const runSearchCase = async ({ params }: SearchCase) => {
  const dataSource = new DataSource(dataScheme, {
    createDriver: createMemoryDriver
  })

  const result = await params.execute(createMockKit(dataSource), dataSource)

  for (const item of result) {
    expect(item.expect).toEqual(item.result)
  }
}

describe('DataSource', async () => {
  for await (const item of cases) {
    if (item.type === 'unit') {
      test(item.name, async () => {
        await runCaseTest(item.params, (kit, dataSource) => item.params.execute(kit, dataSource))
      })
    }

    if (item.type === 'dual') {
      for await (const marker of item.markers) {
        test(`${item.name} / ${marker}`, async () => {
          await runCaseTest(item.params, (kit, dataSource) =>
            item.params.execute(kit, dataSource, marker)
          )
        })
      }
    }

    if (item.type === 'search') {
      test(item.name, async () => {
        await runSearchCase(item)
      })
    }
  }
})
