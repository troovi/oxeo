import { Module } from '@nestjs/common'
import { AppService } from './app.service'
import { AppController } from './app.controller'
import { SystemService } from '../system/system.service'

@Module({
  controllers: [AppController],
  providers: [AppService, SystemService]
})
export class AppModule {}
