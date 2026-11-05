import { Global, Module } from '@nestjs/common'
import { SystemService } from './system.service'

@Global()
@Module({
  imports: [
    // MongooseModule.forFeature([
    //   { name: Account.name, schema: AccountSchema },
    //   { name: Caches.name, schema: CachesSchema }
    // ])
  ],
  providers: [SystemService],
  exports: [SystemService]
})
export class SystemModule {}
