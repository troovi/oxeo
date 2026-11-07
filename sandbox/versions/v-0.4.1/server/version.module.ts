import { Module } from '@nestjs/common'
import { RuntimeService } from './runtime.service'
import { VersionController } from './version.controller'

/** Серверный модуль версии: хост монтирует его под префиксом ключа версии (`server/versions.ts`). */
@Module({
  controllers: [VersionController],
  providers: [RuntimeService]
})
export class VersionModule {}
