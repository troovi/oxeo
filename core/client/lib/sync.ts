/**
 * Очередь событий журнала на клиенте. HTTP-ответ и сообщение потока попадают сюда одинаково: дубли отбрасываются по
 * ревизии, разрывы ждут недостающую ревизию, смена эпохи и ошибка применения ведут к пересинхронизации. Чистая логика
 * без DOM — одна и та же в браузере и на node.
 */
import type { DomainEvent } from '@oxeo/scheme'

export interface SyncSnapshotMeta {
  epoch: string
  revision: number
}

export interface EventSyncOptions {
  apply: (event: DomainEvent) => Promise<unknown>
  resync: (reason: string) => void
  /** Сколько ждать недостающую ревизию, мс. */
  gapTimeout?: number
}

interface Waiter {
  revision: number
  resolve: () => void
  reject: (error: unknown) => void
}

export class EventSync {
  private epoch: string | null = null
  /** Применено локально. */
  private applied = 0
  /** Поставлено в очередь применения (последняя ревизия). */
  private scheduled = 0
  private buffer = new Map<number, DomainEvent>()
  private waiters: Waiter[] = []
  private chain = Promise.resolve()
  private gapTimer: ReturnType<typeof setTimeout> | null = null
  private broken = false

  constructor(private options: EventSyncOptions) {}

  get revision() {
    return this.applied
  }

  /** Очередь запущена: эпоха и ревизия старта известны. */
  get isStarted() {
    return this.epoch !== null
  }

  /** Эпоха старта — с ней сверяются ответы сервера; `null` — очередь ещё не запущена. */
  get startedEpoch() {
    return this.epoch
  }

  /** Старт с эпохи и ревизии: события до неё отбрасываются, накопленные после — применяются. */
  start({ epoch, revision }: SyncSnapshotMeta) {
    this.epoch = epoch
    this.applied = revision
    this.scheduled = revision

    for (const [key, event] of [...this.buffer]) {
      if (event.epoch !== epoch) {
        this.fail('epoch')
        return
      }

      if (key <= revision) {
        this.buffer.delete(key)
      }
    }

    this.drain()
  }

  /** Событие из любого источника (ответ HTTP или сокет). */
  push(event: DomainEvent) {
    if (this.broken) {
      return
    }

    if (this.epoch !== null && event.epoch !== this.epoch) {
      this.fail('epoch')
      return
    }

    if (this.epoch !== null && event.revision <= this.scheduled) {
      return
    }

    this.buffer.set(event.revision, event)
    this.drain()
  }

  /** Разрешается, когда событие с этой ревизией применено локально. */
  whenApplied(revision: number) {
    if (this.applied >= revision) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      this.waiters.push({ revision, resolve, reject })
    })
  }

  private drain() {
    if (this.epoch === null) {
      return
    }

    while (this.buffer.has(this.scheduled + 1)) {
      const event = this.buffer.get(this.scheduled + 1)!

      this.buffer.delete(event.revision)
      this.scheduled = event.revision
      this.clearGap()

      this.chain = this.chain.then(async () => {
        if (this.broken) {
          return
        }

        try {
          await this.options.apply(event)
          this.applied = event.revision
          this.settle(event.revision)
        } catch (error) {
          this.fail('apply', error)
        }
      })
    }

    if (this.buffer.size > 0 && this.gapTimer === null) {
      this.gapTimer = setTimeout(() => {
        this.gapTimer = null
        this.fail('gap')
      }, this.options.gapTimeout ?? 3000)
    }
  }

  private settle(revision: number) {
    const ready = this.waiters.filter((waiter) => waiter.revision <= revision)

    this.waiters = this.waiters.filter((waiter) => waiter.revision > revision)
    ready.forEach((waiter) => waiter.resolve())
  }

  private clearGap() {
    if (this.gapTimer !== null) {
      clearTimeout(this.gapTimer)
      this.gapTimer = null
    }
  }

  /**
   * Пересинхронизация по внешней причине (команда сервера, переподключение сокета): очередь перестаёт
   * применять события, ожидающие вызовы отклоняются, вызывается `resync` из опций.
   */
  resync(reason: string) {
    this.fail(reason)
  }

  private fail(reason: string, error?: unknown) {
    if (this.broken) {
      return
    }

    this.broken = true
    this.clearGap()
    this.buffer.clear()

    const waiters = this.waiters
    this.waiters = []
    waiters.forEach((waiter) => waiter.reject(error ?? new Error(`sync: ${reason}`)))

    this.options.resync(reason)
  }
}
