import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common'
import type { Response } from 'express'
import { DomainError, ParamsError } from '../lib/scheme'
import { CoreError } from '../lib/server'

/**
 * Отказы библиотеки версии в формат `{ code, message }`: ошибка домена — 400 (неизвестная запись — 404), негодные
 * параметры — 400 с разбором `issues`, ошибка целостности oxeo — 400 с моделью и причиной. Фильтр живёт в версии: классы
 * ошибок — её экземпляр библиотеки, у другой версии они свои. Остальное ловит общий фильтр хоста.
 */
@Catch(DomainError, CoreError)
export class DomainExceptionsFilter implements ExceptionFilter {
  catch(exception: DomainError<string> | CoreError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>()

    if (exception instanceof ParamsError) {
      const { code, message, issues } = exception

      response.status(400).json({ code, message, issues })
      return
    }

    if (exception instanceof DomainError) {
      const status = exception.code === 'notFound' ? 404 : 400

      response.status(status).json({ code: exception.code, message: exception.message })
      return
    }

    const { model, data } = exception

    response.status(400).json({
      code: 'integrity',
      message: `Целостность: ${model} — ${data.reason}`,
      model,
      data
    })
  }
}
