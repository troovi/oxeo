import { ConnectOptions, Connection, MongooseError } from 'mongoose'

/**
 * @publicApi
 */
export interface MongooseModuleOptions extends ConnectOptions {
  uri?: string
  retryAttempts?: number
  retryDelay?: number
  connectionName?: string
  connectionFactory?: (connection: any, name: string) => any
  connectionErrorFactory?: (error: MongooseError) => MongooseError
  lazyConnection?: boolean
  onConnectionCreate?: (connection: Connection) => void
  /**
   * If `true`, will show verbose error messages on each connection retry.
   */
  verboseRetryLog?: boolean
}
