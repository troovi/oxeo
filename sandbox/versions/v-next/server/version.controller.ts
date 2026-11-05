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
import { JournalService } from './journal.service'

/**
 * Протокол версии: `POST domains/<domain>/<method>` → событие журнала, `POST data/query` — пакет запросов клиента
 * (записи с захватом ссылок и ревизия), поток событий всем подключённым — SSE вместо сокета (той же односторонней
 * природы, без зависимостей). Снимка нет. `POST reset` — песочнице: база заново, с посевом.
 */
@Controller()
@UseFilters(DomainExceptionsFilter)
export class VersionController {
  constructor(@Inject(JournalService) private readonly journal: JournalService) {}

  @Post('domains/:domain/:method')
  call(
    @Param('domain') domain: string,
    @Param('method') method: string,
    @Body() body: unknown,
    @Headers('x-worker-id') workerId?: string
  ) {
    const identity = workerId ? { workerId: Number(workerId) } : null

    return this.journal.call(domain, method, body, identity)
  }

  @Post('data/query')
  query(@Body() batch: QueryBatch) {
    return this.journal.query(batch)
  }

  /** Сброс базы: пустая база, новая эпоха и посев заново; ответ — эпоха и ревизия после посева. */
  @Post('reset')
  reset() {
    return this.journal.reset()
  }

  @Get('stats')
  getStats() {
    return this.journal.stats()
  }

  @Sse('events')
  events(): Observable<MessageEvent> {
    return this.journal.messages.pipe(map((message) => ({ type: message.type, data: message.data })))
  }
}
