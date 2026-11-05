import { Module } from '@nestjs/common'
import { AppModule } from './module/app.module'
import { MongooseDriverModule } from '../../lib'
import { getMongoConnectionOptions, getMongoConnectionURL } from './db'
import { dataScheme } from '@oxeo/devkit'
import { SystemDataScheme } from './server.scheme'
import { SystemModule } from './system/system.module'

@Module({
  imports: [
    MongooseDriverModule.forRoot({
      uri: getMongoConnectionURL(),
      mongoOptions: getMongoConnectionOptions(),
      schemas: [{ dataScheme }, { dataScheme: SystemDataScheme }]
    }),
    AppModule,
    SystemModule
  ]
})
export class RootModule {}
