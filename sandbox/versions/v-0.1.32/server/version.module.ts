import { Module } from '@nestjs/common'
import { JournalService } from './journal.service'
import { VersionController } from './version.controller'

/** Серверный модуль версии: хост монтирует его под префиксом ключа версии (`server/versions.ts`). */
@Module({
  controllers: [VersionController],
  providers: [JournalService]
})
export class VersionModule {}
