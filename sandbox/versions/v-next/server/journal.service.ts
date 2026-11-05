/**
 * Журнал событий версии: in-memory база (`createMemoryDriver`) и серверная оболочка oxeo над ней — очередь вызовов,
 * контекст, ревизии, события с новыми версиями тронутых записей и пакеты запросов клиентов. Снимка нет: клиент получает
 * данные запросами. База в памяти вместо Mongo: песочница думает о протоколе библиотеки, а не о хранилище; при
 * перезапуске сервер засевается заново и даёт ту же базу.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException
} from '@nestjs/common'
import { Subject } from 'rxjs'
import { z } from 'zod'
import {
  DataSource,
  DomainEvent,
  MemoryCollectionDriver,
  QueryBatch,
  ServerShell,
  createMemoryDriver,
  createServerShell
} from '../lib/server'
import { Actor } from '../core/domains'
import { AppDomains, appDomains } from '../core/domains'
import { domainParams } from '../core/domains/params'
import { AppScheme, dataScheme } from '../core/scheme'
import { seed } from './seed'

/** Идентичность вызова — сотрудник из заголовка `x-worker-id`; без заголовка вызов системный. */
export interface Identity {
  workerId: number
}

export namespace JournalMessages {
  export interface Event {
    type: 'event'
    data: DomainEvent
  }

  export interface Resync {
    type: 'resync'
    data: string
  }
}

export type JournalMessage = JournalMessages.Event | JournalMessages.Resync

interface RawCall {
  domain: string
  method: string
  params: unknown
}

type SandboxSource = DataSource<AppScheme, MemoryCollectionDriver<AppScheme>>

/** Дата `YYYY-MM-DD` по UTC: песочнице часовой пояс не важен, важно одно правило на сервере. */
export const toDateISO = (at: number) => {
  return new Date(at).toISOString().slice(0, 10)
}

@Injectable()
export class JournalService implements OnModuleInit {
  readonly messages = new Subject<JournalMessage>()

  /** База версии и серверная оболочка над ней; сброс заменяет обе — пустая база, новая эпоха. */
  source: SandboxSource
  shell: ServerShell<AppDomains, SandboxSource['collections'], Identity, Actor>

  /** Посев: сколько событий и за сколько миллисекунд. */
  seeded = { events: 0, ms: 0 }

  /** Посев идёт без рассылки: события новой эпохи подключённым клиентам не нужны — им уходит `resync`. */
  private isSeeding = false

  constructor() {
    this.open()
  }

  async onModuleInit() {
    await this.seedBase()
  }

  /**
   * Сброс базы: пустой in-memory драйвер, новая оболочка (эпоха) и посев заново — та же база, что при старте сервера.
   * Подключённым клиентам — `resync`: они забывают всё и перезапрашивают то, что читают.
   */
  async reset() {
    this.open()
    await this.seedBase()
    this.messages.next({ type: 'resync', data: 'reset' })

    return { epoch: this.shell.epoch, revision: this.shell.revision }
  }

  /**
   * Вызов из HTTP: операция ищется по реестру схем параметров (нет — 404), тело проверяется схемой (не прошло — 400),
   * затем вызов уходит в очередь оболочки; ответ — событие журнала.
   */
  call(domain: string, method: string, body: unknown, identity: Identity | null) {
    const schemas = domainParams as Record<string, Record<string, z.ZodType> | undefined>
    const schema = schemas[domain]?.[method]

    if (!schema) {
      throw new NotFoundException(`Операция ${domain}.${method} не найдена`)
    }

    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      const issues = parsed.error.issues

      throw new BadRequestException({
        code: 'params',
        message: 'Параметры не прошли проверку',
        issues
      })
    }

    // имена домена и метода — строки маршрута; типы вызовов оболочки нужны программному вызову, не HTTP
    const run = this.shell.run as (call: RawCall, identity: Identity | null) => Promise<DomainEvent>

    return run({ domain, method, params: parsed.data }, identity)
  }

  /** Пакет запросов клиента; ответ — записи с захватом ссылок и результаты запросов. */
  query(batch: QueryBatch) {
    if (!Array.isArray(batch?.queries)) {
      throw new BadRequestException({ code: 'params', message: 'Пакет запросов — { queries: [...] }' })
    }

    return this.shell.query(batch)
  }

  /** Актор — работающий сотрудник; уволенный или неизвестный — отказ. */
  async resolveActor({ workerId }: Identity): Promise<Actor> {
    const worker = await this.source.collections.worker.get(workerId)

    if (!worker || worker.status !== 'working') {
      throw new UnauthorizedException()
    }

    return { workerId }
  }

  /**
   * Сводка для сравнения версий: записи по коллекциям, вес всей базы в байтах JSON (в 0.1 столько весил снимок, который
   * клиент получал при входе), посев, ревизия.
   */
  stats() {
    const counts: Record<string, number> = {}
    const base: Record<string, object[]> = {}

    for (const name in dataScheme.collectionsScheme) {
      const records = this.source.collections[name as keyof AppScheme].getAll()

      counts[name] = records.length
      base[name] = records
    }

    return {
      epoch: this.shell.epoch,
      revision: this.shell.revision,
      counts,
      baseBytes: Buffer.byteLength(JSON.stringify(base)),
      seeded: this.seeded
    }
  }

  // --------------------------------------------- private ---------------------------------------------

  /** Пустая in-memory база и серверная оболочка над ней — очередь, ревизии с нуля, новая эпоха. */
  private open() {
    const source: SandboxSource = new DataSource(dataScheme, {
      createDriver: createMemoryDriver
    })

    this.source = source
    this.shell = createServerShell(appDomains, source, {
      counterCollection: 'counter',
      resolveActor: (identity: Identity) => this.resolveActor(identity),
      today: toDateISO,
      broadcast: (event) => {
        if (!this.isSeeding) {
          this.messages.next({ type: 'event', data: event })
        }
      },
      onPartialWrite: ({ call, writes }) => {
        Logger.error(`${call.domain}.${call.method} failed after ${writes} writes, resync`, 'Journal')
        this.messages.next({ type: 'resync', data: 'partial-write' })
      }
    })
  }

  private async seedBase() {
    const started = Date.now()

    this.isSeeding = true
    await seed(this.shell)
    this.isSeeding = false

    this.seeded = { events: this.shell.revision, ms: Date.now() - started }
    Logger.log(`Seeded ${this.seeded.events} events in ${this.seeded.ms} ms`, 'Journal')
  }
}
