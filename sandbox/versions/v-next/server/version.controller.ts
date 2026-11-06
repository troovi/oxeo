import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  MessageEvent,
  Param,
  Post,
  Sse,
  UseFilters
} from '@nestjs/common'
import { Observable, map } from 'rxjs'
import { QueryBatch } from '../lib/server'
import { DomainExceptionsFilter } from './domain-exceptions.filter'
import { RuntimeService } from './runtime.service'

/**
 * Протокол версии: `POST domains/<domain>/<method>` → событие, `POST data/query` — пакет запросов клиента
 * (записи с захватом ссылок, значения представлений), поток событий всем подключённым — SSE вместо сокета (той же односторонней
 * природы, без зависимостей). Снимка нет. `POST reset` — песочнице: база заново, с посевом.
 */
@Controller()
@UseFilters(DomainExceptionsFilter)
export class VersionController {
  constructor(@Inject(RuntimeService) private readonly runtime: RuntimeService) {}

  @Post('domains/:domain/:method')
  call(
    @Param('domain') domain: string,
    @Param('method') method: string,
    @Body() body: unknown,
    @Headers('x-worker-id') workerId?: string
  ) {
    const identity = workerId ? { workerId: Number(workerId) } : null

    return this.runtime.call(domain, method, body, identity)
  }

  @Post('data/query')
  query(@Body() batch: QueryBatch, @Headers('x-worker-id') workerId?: string) {
    const identity = workerId ? { workerId: Number(workerId) } : null

    return this.runtime.query(batch, identity)
  }

  /** Сброс базы: пустая база, новая эпоха и посев заново; ответ — эпоха и ревизия после посева. */
  @Post('reset')
  reset() {
    return this.runtime.reset()
  }

  @Get('stats')
  getStats() {
    return this.runtime.stats()
  }

  @Sse('events')
  events(): Observable<MessageEvent> {
    return this.runtime.messages.pipe(map((message) => ({ type: message.type, data: message.data })))
  }
}
