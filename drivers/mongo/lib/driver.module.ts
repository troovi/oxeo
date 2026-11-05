import { Provider } from '@nestjs/common'
import { DynamicModule, Module } from '@nestjs/common'
import { getConnectionToken, getDataSourceToken } from './common/tokens'
import { Connection } from 'mongoose'
import { CollectionScheme, DataScheme } from '@oxeo/scheme'
import { DataSource } from '@oxeo/server'
import { MongooseCoreModule } from './mongoose.module'
import { MongooseModuleOptions } from './mongoose-options.interface'
import { DataSourceStorage } from './storages/data-source'
import { MongoDriverOptions } from './drivers/collection.driver'

interface RootOptions {
  uri: string
  mongoOptions?: MongooseModuleOptions
  schemas: {
    dataScheme: DataScheme<CollectionScheme>
    driverOptions?: Omit<MongoDriverOptions, 'connection'>
  }[]
}

/**
 * @publicApi
 */
@Module({})
export class MongooseDriverModule {
  static forRoot(options: RootOptions): DynamicModule {
    const { uri, schemas, mongoOptions = {} } = options

    const providers: Provider[] = schemas.map(({ dataScheme, driverOptions = {} }) => {
      return {
        provide: getDataSourceToken(dataScheme),
        useFactory: (connection: Connection): DataSource<CollectionScheme> => {
          return DataSourceStorage.getSource(dataScheme, { connection, ...driverOptions })
        },
        inject: [getConnectionToken(mongoOptions.connectionName)]
      }
    })

    return {
      global: true,
      module: MongooseDriverModule,
      imports: [MongooseCoreModule.forRoot(uri, mongoOptions)],
      providers: providers,
      exports: providers
    }
  }

  // static forFeature(dataSource: DataScheme<CollectionScheme>, connectionName?: string): DynamicModule {
  //   const provider: Provider = {
  //     provide: getDataSourceToken(dataSource),
  //     useFactory: (connection: Connection): DataSource<CollectionScheme> => {
  //       return DataSourceStorage.getSource(dataSource, connection)
  //     },
  //     inject: [getConnectionToken(connectionName)]
  //   }

  //   return {
  //     module: MongooseDriverModule,
  //     providers: [provider],
  //     exports: [provider]
  //   }
  // }
}
