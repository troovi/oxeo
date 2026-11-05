import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common'
import type { Response } from 'express'

/**
 * Общий фильтр хоста: HTTP-исключения — как есть, остальное — 500 с записью в лог. Отказы библиотеки (ошибка
 * домена, целостности) ловит фильтр самой версии: классы ошибок у каждой версии — её экземпляр библиотеки.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>()

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse())
      return
    }

    Logger.error(exception instanceof Error ? exception.stack : String(exception), 'Sandbox')
    response.status(500).json({
      code: 'internal',
      message: 'Внутренняя ошибка сервера песочницы'
    })
  }
}
