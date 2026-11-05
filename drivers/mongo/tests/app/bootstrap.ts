import { NestFactory } from '@nestjs/core'
import { RootModule } from './root.module'
import { ValidationPipe } from '@nestjs/common'
import { AllExceptionsFilter } from './filters'

export const bootstrap = async (port = 3111) => {
  const app = await NestFactory.create(RootModule)

  app.useGlobalFilters(new AllExceptionsFilter())
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))

  await app.listen(port)
  console.log(`Application is running on: http://localhost:${port}/app`)

  return app
}
