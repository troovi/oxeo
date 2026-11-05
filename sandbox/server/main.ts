/**
 * Хост сервера песочницы: NestJS без базы и авторизации. Каждая версия набросков приносит свой модуль
 * (`versions/<version>/server`), хост монтирует его под префиксом ключа версии — `/v-0.1.32/...`.
 * Запуск — `tsx watch`: esbuild не пишет метаданные декораторов, поэтому зависимости в конструкторах
 * указываются явно, `@Inject(Service)`.
 */
import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './filters'

const PORT = 4500

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule)

  app.useGlobalFilters(new AllExceptionsFilter())

  await app.listen(PORT)
  Logger.log(`Sandbox server: http://localhost:${PORT}`, 'Sandbox')
}

bootstrap()
