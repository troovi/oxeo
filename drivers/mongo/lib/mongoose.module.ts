import * as mongoose from 'mongoose'
import { DynamicModule, Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { ConnectOptions, Connection } from 'mongoose'
import { defer, lastValueFrom } from 'rxjs'
import { catchError } from 'rxjs/operators'
import { MONGOOSE_CONNECTION_NAME } from './constants'
import { getConnectionToken, handleRetry } from './common'
import { MongooseModuleOptions } from './mongoose-options.interface'

@Global()
@Module({})
export class MongooseCoreModule implements OnApplicationShutdown {
  constructor(
    @Inject(MONGOOSE_CONNECTION_NAME) private readonly connectionName: string,
    private readonly moduleRef: ModuleRef
  ) {}

  static forRoot(uri: string, options: MongooseModuleOptions = {}): DynamicModule {
    const {
      retryAttempts,
      retryDelay,
      connectionName,
      connectionFactory,
      connectionErrorFactory,
      lazyConnection,
      onConnectionCreate,
      verboseRetryLog,
      ...mongooseOptions
    } = options

    const mongooseConnectionFactory = connectionFactory || ((connection) => connection)

    const mongooseConnectionError = connectionErrorFactory || ((error) => error)

    const mongooseConnectionName = getConnectionToken(connectionName)

    const mongooseConnectionNameProvider = {
      provide: MONGOOSE_CONNECTION_NAME,
      useValue: mongooseConnectionName
    }

    const connectionProvider = {
      provide: mongooseConnectionName,
      useFactory: async (): Promise<any> =>
        await lastValueFrom(
          defer(async () =>
            mongooseConnectionFactory(
              await this.createMongooseConnection(uri, mongooseOptions, {
                lazyConnection,
                onConnectionCreate
              }),
              mongooseConnectionName
            )
          ).pipe(
            handleRetry(retryAttempts, retryDelay, verboseRetryLog),
            catchError((error) => {
              throw mongooseConnectionError(error)
            })
          )
        )
    }
    return {
      module: MongooseCoreModule,
      providers: [connectionProvider, mongooseConnectionNameProvider],
      exports: [connectionProvider]
    }
  }

  private static async createMongooseConnection(
    uri: string,
    mongooseOptions: ConnectOptions,
    factoryOptions: {
      lazyConnection?: boolean
      onConnectionCreate?: MongooseModuleOptions['onConnectionCreate']
    }
  ): Promise<Connection> {
    const connection = mongoose.createConnection(uri, mongooseOptions)

    if (factoryOptions?.lazyConnection) {
      return connection
    }

    factoryOptions?.onConnectionCreate?.(connection)

    return connection.asPromise()
  }

  async onApplicationShutdown() {
    const connection = this.moduleRef.get<any>(this.connectionName)
    if (connection) {
      await connection.close()
    }
  }
}
