import { Module } from '@nestjs/common'
import { RouterModule } from '@nestjs/core'
import { versions } from './versions'

/** Корень сервера: модуль каждой версии под префиксом её ключа. */
@Module({
  imports: [
    RouterModule.register(versions.map(({ key, module }) => ({ path: key, module }))),
    ...versions.map(({ module }) => module)
  ]
})
export class AppModule {}
