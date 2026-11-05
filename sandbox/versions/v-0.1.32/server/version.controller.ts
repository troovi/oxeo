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
import { DomainExceptionsFilter } from './domain-exceptions.filter'
import { JournalService } from './journal.service'

/**
 * Протокол версии — как у CRM: `POST domains/<domain>/<method>` → событие журнала, `GET
 * snapshot` — вся база, поток событий всем подключённым — SSE вместо сокета (той же односторонней
 * природы, без зависимостей). `POST reset` — песочнице: база заново, с посевом.
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

  @Get('snapshot')
  getSnapshot() {
    return this.journal.shell.snapshot()
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
