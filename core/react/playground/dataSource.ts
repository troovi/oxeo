import { DataSource, createBaseDriver } from '@companix/xeo-scheme'
import { dataScheme } from '@companix/xeo-devkit'
import { createDataSourceHooks } from '../lib'

export const dataSource = new DataSource(dataScheme, {
  createDriver: createBaseDriver
})

const hooks = createDataSourceHooks(dataSource)

export const {
  useEntity,
  useEntities,
  useField,
  useAll,
  useFindBy,
  useFindOneBy,
  useExistsBy,
  useCount,
  useExists,
  useMutations
} = hooks
