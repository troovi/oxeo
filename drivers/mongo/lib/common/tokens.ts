import { DEFAULT_DB_CONNECTION } from '../constants'
import { CollectionScheme, DataScheme } from '@oxeo/scheme'
import { DataSourceStorage } from '../storages/data-source'

/**
 * @publicApi
 */
export const getConnectionToken = (name?: string) => {
  return name && name !== DEFAULT_DB_CONNECTION ? `${name}Connection` : DEFAULT_DB_CONNECTION
}

/**
 * @publicApi
 */
export const getDataSourceToken = (dataScheme: DataScheme<CollectionScheme>) => {
  return DataSourceStorage.getProviderToken(dataScheme)
}
