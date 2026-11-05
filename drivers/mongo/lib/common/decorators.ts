import { Inject } from '@nestjs/common'
import { getConnectionToken, getDataSourceToken } from './tokens'
import { CollectionScheme, DataScheme } from '@oxeo/scheme'

/**
 * @publicApi
 */
export const InjectDataSource = (dataSource: DataScheme<CollectionScheme>) => {
  return Inject(getDataSourceToken(dataSource))
}

/**
 * @publicApi
 */
export const InjectConnection = () => {
  return Inject(getConnectionToken())
}
