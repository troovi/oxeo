/**
 * Рантайм версии: in-memory база (`createMemoryDriver`) и рантайм доменов oxeo над ней — очередь вызовов,
 * контекст, ревизии, события с новыми версиями тронутых записей и пакеты запросов клиентов. Снимка нет: клиент получает
 * данные запросами. База в памяти вместо Mongo: песочница думает о протоколе библиотеки, а не о хранилище; при
 * перезапуске сервер засевается заново и даёт ту же базу.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException
} from '@nestjs/common'
import { Subject } from 'rxjs'
import { DataSource, DomainEvent, DomainRuntime, QueryBatch, createMemoryDriver } from '../lib/server'
import { Actor } from '../core/domains'
import { AppDomains, appDomains } from '../core/domains'
import { appParams } from '../core/domains/params'
import { AppScheme, dataScheme } from '../core/scheme'
import { AppViews, appViews } from '../core/views'
import { appViewParams } from '../core/views/params'
import { seed } from './seed'

/** Идентичность вызова — сотрудник из заголовка `x-worker-id`; без заголовка вызов системный. */
export interface Identity {
  workerId: number
}

export namespace RuntimeMessages {
  export interface Event {
    type: 'event'
    data: DomainEvent
  }

  export interface Resync {
    type: 'resync'
    data: string
  }
}

export type RuntimeMessage = RuntimeMessages.Event | RuntimeMessages.Resync

type SandboxSource = DataSource<AppScheme>

/** Дата `YYYY-MM-DD` по UTC: песочнице часовой пояс не важен, важно одно правило на сервере. */
export const toDateISO = (at: number) => {
  return new Date(at).toISOString().slice(0, 10)
}

@Injectable()
export class RuntimeService implements OnModuleInit {
  readonly messages = new Subject<RuntimeMessage>()

  /** База версии и рантайм над ней; сброс заменяет обоих — пустая база, новая эпоха. */
  source: SandboxSource
  runtime: DomainRuntime<AppDomains, SandboxSource['collections'], Identity, Actor, AppViews>

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
   * Сброс базы: пустой in-memory драйвер, новый рантайм (эпоха) и посев заново — та же база, что при старте сервера.
   * Подключённым клиентам — `resync`: они забывают всё и перезапрашивают то, что читают.
   */
  async reset() {
    this.open()
    await this.seedBase()
    this.messages.next({ type: 'resync', data: 'reset' })

    return { epoch: this.runtime.epoch, revision: this.runtime.revision }
  }

  /** Вызов из HTTP: операцию и тело запроса проверяет рантайм, отказы переводит в ответ фильтр версии. */
  call(domain: string, method: string, body: unknown, identity: Identity | null) {
    // имена домена и метода — строки маршрута; типы вызовов рантайма нужны программному вызову, не HTTP
    return this.runtime.run({ domain, method, params: body } as never, identity)
  }

  /**
   * Пакет запросов клиента; ответ — записи с захватом ссылок и результаты запросов. Идентичность — для представлений: их
   * значение считается для того, кто смотрит.
   */
  query(batch: QueryBatch, identity: Identity | null) {
    if (!Array.isArray(batch?.queries)) {
      throw new BadRequestException({ code: 'params', message: 'Пакет запросов — { queries: [...] }' })
    }

    return this.runtime.query(batch, identity)
  }

  /**
   * Сводка для сравнения версий: записи по коллекциям, вес всей базы в байтах JSON (в 0.1 столько весил снимок, который
   * клиент получал при входе), посев, ревизия.
   */
  async stats() {
    const counts: Record<string, number> = {}
    const base: Record<string, object[]> = {}

    for (const name in dataScheme.collectionsScheme) {
      const records = await this.source.collections[name as keyof AppScheme].getAll()

      counts[name] = records.length
      base[name] = records
    }

    return {
      epoch: this.runtime.epoch,
      revision: this.runtime.revision,
      counts,
      baseBytes: Buffer.byteLength(JSON.stringify(base)),
      seeded: this.seeded
    }
  }

  // --------------------------------------------- private ---------------------------------------------

  /** Пустая in-memory база и рантайм над ней — очередь, ревизии с нуля, новая эпоха. */
  private open() {
    const source: SandboxSource = new DataSource(dataScheme, {
      createDriver: createMemoryDriver
    })

    this.source = source
    this.runtime = new DomainRuntime({
      domains: appDomains,
      params: appParams,
      views: appViews,
      viewParams: appViewParams,
      dataSource: source,
      counterCollection: 'counter',
      /** Актор — работающий сотрудник; уволенный или неизвестный — отказ. */
      resolveActor: async ({ workerId }: Identity) => {
        const worker = await source.collections.worker.get(workerId)

        if (!worker || worker.status !== 'working') {
          throw new UnauthorizedException()
        }

        return { workerId }
      },
      today: toDateISO,
      broadcast: (event) => {
        if (!this.isSeeding) {
          this.messages.next({ type: 'event', data: event })
        }
      },
      onPartialWrite: ({ call, writes }) => {
        Logger.error(`${call.domain}.${call.method} failed after ${writes} writes, resync`, 'Runtime')
        this.messages.next({ type: 'resync', data: 'partial-write' })
      }
    })
  }

  private async seedBase() {
    const started = Date.now()

    this.isSeeding = true
    await seed(this.runtime)
    this.isSeeding = false

    this.seeded = { events: this.runtime.revision, ms: Date.now() - started }
    Logger.log(`Seeded ${this.seeded.events} events in ${this.seeded.ms} ms`, 'Runtime')
  }
}
