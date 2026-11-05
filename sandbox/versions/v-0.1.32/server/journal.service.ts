/**
 * Журнал событий версии: in-memory база (`createBaseDriver`) и серверная оболочка xeo-toolkit над ней —
 * очередь вызовов, контекст, ревизии, снимок. База в памяти вместо Mongo: песочница думает о протоколе
 * библиотеки, а не о хранилище; при перезапуске сервер засевается заново и даёт ту же базу.
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
  BaseCollectionDriver,
  DataSource,
  DomainEvent,
  ServerShell,
  TableRow,
  createBaseDriver,
  createServerShell
} from '../lib'
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

type SandboxSource = DataSource<AppScheme, BaseCollectionDriver<AppScheme>>

/** Дата `YYYY-MM-DD` по UTC: песочнице часовой пояс не важен, важно одно правило на сервере. */
export const toDateISO = (at: number) => {
  return new Date(at).toISOString().slice(0, 10)
}

/**
 * Строки таблиц связей из состояния базового драйвера. Снимок ждёт строки `{ m1, m2 }`, как отдаёт
 * Mongo-драйвер, а `getTables()` базового драйвера — отладочный вид `{ m1: { id: [ids] } }`, где ключи
 * — строки: числовые идентификаторы восстанавливаются по типу идентификатора модели стороны `m1`.
 */
const tableRowsOf = (source: SandboxSource) => {
  const rows: { [table: string]: TableRow[] } = {}
  const state = source.driver.tables.getTables()

  for (const table of dataScheme.tables) {
    const identifier = dataScheme.models[table.rules.m1].scheme.identifier.options.type
    const side = state[table.tableName]?.m1 ?? {}

    rows[table.tableName] = []

    for (const key in side) {
      const m1 = identifier === 'number' ? Number(key) : key

      for (const m2 of side[key]) {
        rows[table.tableName].push({ m1, m2 })
      }
    }
  }

  return rows
}

@Injectable()
export class JournalService implements OnModuleInit {
  readonly messages = new Subject<JournalMessage>()

  /** База версии и серверная оболочка над ней; сброс заменяет обе — пустая база, новая эпоха. */
  source: SandboxSource
  shell: ServerShell<AppDomains, SandboxSource['collections'], Identity, Actor>

  /** Посев: сколько событий и за сколько миллисекунд. */
  seeded = { events: 0, ms: 0 }

  /** Посев идёт без рассылки: события новой эпохи подключённым репликам не нужны — им уходит `resync`. */
  private isSeeding = false

  constructor() {
    this.open()
  }

  async onModuleInit() {
    await this.seedBase()
  }

  /**
   * Сброс базы: пустой in-memory драйвер, новая оболочка (эпоха) и посев заново — та же база, что при старте
   * сервера. Подключённым репликам — `resync`: их состояние с новой эпохой не сходится.
   */
  async reset() {
    this.messages.next({ type: 'resync', data: 'reset' })
    this.open()
    await this.seedBase()

    return { epoch: this.shell.epoch, revision: this.shell.revision }
  }

  /**
   * Вызов из HTTP: операция ищется по реестру схем параметров (нет — 404), тело проверяется схемой (не
   * прошло — 400), затем вызов уходит в очередь оболочки; ответ — событие журнала.
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

  /** Актор — работающий сотрудник; уволенный или неизвестный — отказ. */
  async resolveActor({ workerId }: Identity): Promise<Actor> {
    const worker = await this.source.collections.worker.get(workerId)

    if (!worker || worker.status !== 'working') {
      throw new UnauthorizedException()
    }

    return { workerId }
  }

  /** Сводка для сравнения версий: записи по коллекциям, вес снимка в байтах JSON, посев, ревизия. */
  async stats() {
    const snapshot = await this.shell.snapshot()
    const counts: Record<string, number> = {}

    for (const name in snapshot.entities) {
      counts[name] = snapshot.entities[name as keyof AppScheme].length
    }

    const tableRows = Object.values(snapshot.tables).reduce((sum, rows) => sum + rows.length, 0)

    return {
      epoch: snapshot.epoch,
      revision: snapshot.revision,
      counts,
      tableRows,
      snapshotBytes: Buffer.byteLength(JSON.stringify(snapshot)),
      seeded: this.seeded
    }
  }

  // --------------------------------------------- private ---------------------------------------------

  /** Пустая in-memory база и серверная оболочка над ней — очередь, контекст, ревизии с нуля, новая эпоха. */
  private open() {
    const source: SandboxSource = new DataSource(dataScheme, {
      createDriver: createBaseDriver
    })
    const dataSource = {
      collections: source.collections,
      driver: { tables: { getTables: () => tableRowsOf(source) } }
    }

    this.source = source
    this.shell = createServerShell(appDomains, dataSource, {
      counterCollection: 'counter',
      resolveActor: (identity: Identity) => this.resolveActor(identity),
      today: toDateISO,
      broadcast: (event) => {
        if (!this.isSeeding) {
          this.messages.next({ type: 'event', data: event })
        }
      },
      onPartialWrite: ({ call, mutations }) => {
        Logger.error(
          `${call.domain}.${call.method} failed after ${mutations} writes, resync`,
          'Journal'
        )
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
