/**
 * Сборщик прохода чтения: что колбэк прочитал (для подписки) и чего не хватило (для загрузки). Сборщик один на
 * компонент, каждый проход пишет свой след. Фреймворка он не знает: создаёт его и подписывает привязка
 * (`@oxeo/react`).
 *
 * Работа сборщика по шагам:
 *
 * 1. Проход. `run` заводит новый след и зовёт колбэк с `db` и `views` этого сборщика.
 * 2. Чтение. `db.<collection>` запоминает прочитанное в след, отдаёт запись через прокси, который пишет поля в след своего
 *    прохода, а недостающее кладёт в `needs`. Поля прокси пишет и после возврата колбэка: их читают и дети компонента,
 *    получившие запись пропсом.
 * 3. Фиксация. Фреймворк может вызвать компонент и выбросить результат (React — при отказе от рендера, в прерванном
 *    рендере): тогда на экране остаются дети прежнего рендера с прокси прежнего прохода. Поэтому привязка принимает след
 *    (`commit`), когда рендер его прохода зафиксирован, и принятый след действует, пока не принят следующий.
 * 4. Загрузка. Привязка отправляет `needs` одним пакетом и повторяет проход, когда ответ придёт.
 * 5. Изменение. Событие или ответ меняют данные клиента, и он рассылает `ClientChange` всем подписчикам.
 * 6. Фильтр. `isAffected` сверяет изменение со следом последнего прохода и с принятым следом. Не касается — компонент не
 *    трогаем, касается — новый проход. Сборщик без фиксаций (разовое чтение) сверяет только последний проход.
 *
 * Глобального состояния нет: `db` и `views` существуют только параметрами колбэка и только на время прохода.
 */
import type { Query } from '@oxeo/scheme'
import type { LiveStore } from './live-store'

/** Что изменилось у клиента — по этому привязка решает, кого перерисовать. */
export interface ClientChange {
  /** Записи `collection:id` → изменённые поля; `null` — запись появилась или пропала. */
  records: Map<string, string[] | null>
  /** Ключи запросов, у которых изменился состав или число. */
  queries: Set<string>
  /** Коллекции, загруженные целиком, в которых что-то изменилось. */
  collections: Set<string>
  /** Клиент забыл всё — затронуты все. */
  everything: boolean
}

export const emptyChange = (): ClientChange => {
  return { records: new Map(), queries: new Set(), collections: new Set(), everything: false }
}

/** Колбэк чтения: `db` и значения представлений существуют только внутри него. */
export type Read<Db, Views, R> = (db: Db, views: Views) => R

export interface TrackerOptions {
  /** Простые записи вместо прокси: разовому чтению учёт полей не нужен. */
  plain?: boolean
}

interface Readers<Db, Views> {
  db: Db
  views: Views
}

interface TrackerParams<Db, Views> extends TrackerOptions {
  store: Pick<LiveStore, 'read' | 'changes'>
  /** Читатели сборщика: `read` — чтение запроса в его проходе. */
  createReaders: (read: (query: Query) => unknown) => Readers<Db, Views>
}

export namespace Passes {
  export interface Complete<R> {
    isComplete: true
    value: R
    /** След прохода — его принимает привязка, когда рендер прохода зафиксирован. */
    trace: Trace
  }

  /** Данных не хватило или запрос отказал: результат прохода выброшен. */
  export interface Incomplete {
    isComplete: false
    trace: Trace
  }
}

export type Pass<R> = Passes.Complete<R> | Passes.Incomplete

/**
 * След прохода: что прочитал один проход колбэка — записи с полями, запросы, коллекции — и чего ему не хватило. Прокси
 * записей пишут поля в след своего прохода, сколько бы проходов ни было после него.
 */
export class Trace {
  /** Запросы, которых у клиента нет, — их загрузит привязка. */
  readonly needs = new Map<string, Query>()
  /** Запросы, загрузка которых не удалась, и их ошибки. */
  readonly failures = new Map<string, Error>()
  /** Прочитанные записи `collection:id` → прочитанные поля; пустой набор — важна сама запись. */
  readonly records = new Map<string, Set<string>>()
  /** Ключи прочитанных запросов. */
  readonly queries = new Set<string>()
  /** Коллекции, прочитанные из загруженных целиком. */
  readonly collections = new Set<string>()
  /** Прокси записей прохода: один на запись. */
  readonly proxies = new WeakMap<object, object>()

  /** `seenChanges` — сколько изменений клиента было к началу прохода. */
  constructor(readonly seenChanges: number) {}

  /** Набор прочитанных полей записи; заводится пустым — «важна сама запись». */
  fieldsOf(key: string) {
    if (!this.records.has(key)) {
      this.records.set(key, new Set())
    }

    return this.records.get(key)!
  }

  /** Касается ли изменение прочитанного: поля прочитанной записи, состава запроса или коллекции. */
  isAffected(change: ClientChange) {
    for (const key of this.queries) {
      if (change.queries.has(key)) {
        return true
      }
    }

    for (const collection of this.collections) {
      if (change.collections.has(collection)) {
        return true
      }
    }

    for (const [key, changed] of change.records) {
      const fields = this.records.get(key)

      if (
        fields &&
        (changed === null || fields.size === 0 || changed.some((field) => fields.has(field)))
      ) {
        return true
      }
    }

    return false
  }
}

export class Tracker<Db = unknown, Views = unknown> {
  /** След последнего прохода: в него пишет идущий проход. */
  private latest: Trace
  /** След, рендер которого зафиксирован (`commit`); `null` — фиксаций не было. */
  private committed: Trace | null = null
  private isRunning = false
  private isReleased = false

  private store: TrackerParams<Db, Views>['store']
  private readers: Readers<Db, Views>
  private plain: boolean

  constructor({ store, createReaders, plain = false }: TrackerParams<Db, Views>) {
    this.store = store
    this.readers = createReaders((query) => this.read(query))
    this.plain = plain
    this.latest = new Trace(store.changes)
  }

  /** Запросы последнего прохода, которых у клиента нет, — их загрузит привязка. */
  get needs() {
    return this.latest.needs
  }

  /** Запросы последнего прохода, загрузка которых не удалась, и их ошибки. */
  get failures() {
    return this.latest.failures
  }

  /** Прочитанные последним проходом записи `collection:id` → поля. */
  get records() {
    return this.latest.records
  }

  /** Ключи запросов, прочитанных последним проходом. */
  get queries() {
    return this.latest.queries
  }

  /** Коллекции, прочитанные последним проходом из загруженных целиком. */
  get collections() {
    return this.latest.collections
  }

  /**
   * Проход: новый след, колбэк получает `db` и `views` этого сборщика. Принятый след остаётся, пока привязка не примет
   * новый. Колбэк выполняется целиком: чтения, которым не хватило данных, отдают пустое и копят потребности. Результат
   * такого прохода и его ошибка на пустых данных выбрасываются. Ошибка полного прохода — настоящая, она идёт наверх.
   */
  run<R>(read: Read<Db, Views, R>): Pass<R> {
    const trace = new Trace(this.store.changes)

    this.latest = trace
    this.isRunning = true

    const pass = { value: undefined as R | undefined, thrown: null as unknown, isThrown: false }

    try {
      pass.value = read(this.readers.db, this.readers.views)
    } catch (thrown) {
      pass.thrown = thrown
      pass.isThrown = true
    }

    this.isRunning = false

    if (trace.needs.size > 0 || trace.failures.size > 0) {
      return { isComplete: false, trace }
    }

    if (pass.isThrown) {
      throw pass.thrown
    }

    return { isComplete: true, value: pass.value as R, trace }
  }

  /**
   * Рендер прохода зафиксирован: его след действует, пока не принят следующий. Прокси этого прохода получили дети
   * зафиксированного рендера, и поля, которые они читают, пишутся в этот след, даже если компонент потом вызван снова и
   * результат выброшен.
   */
  commit(trace: Trace) {
    if (!this.isReleased) {
      this.committed = trace
    }
  }

  /** Разовое чтение получило результат: сборщик забывает прочитанное и больше ни на что не реагирует. */
  release() {
    this.latest = new Trace(this.store.changes)
    this.committed = null
    this.isReleased = true
  }

  /** Менялись ли данные клиента после прохода: подписка появляется позже него и этих изменений не видела. */
  hasMissedChanges() {
    return !this.isReleased && this.store.changes !== this.latest.seenChanges
  }

  /** Набор прочитанных полей записи в следе идущего прохода; заводится пустым — «важна сама запись». */
  fieldsOf(key: string) {
    return this.latest.fieldsOf(key)
  }

  /** Запись через прокси, который кладёт прочитанные поля в след своего прохода; один прокси на запись за проход. */
  track<T extends object>(key: string, record: T): T {
    if (this.plain) {
      return record
    }

    const { proxies } = this.latest
    const cached = proxies.get(record)

    if (cached) {
      return cached as T
    }

    const fields = this.latest.fieldsOf(key)
    const proxy = new Proxy(record, {
      get(target, property, receiver) {
        if (typeof property === 'string') {
          fields.add(property)
        }

        return Reflect.get(target, property, receiver)
      }
    })

    proxies.set(record, proxy)
    return proxy
  }

  /**
   * Касается ли изменение прочитанного — следом последнего прохода или принятым: до фиксации нового рендера на экране
   * дети принятого, и поля, которые они читают, — в его следе.
   */
  isAffected(change: ClientChange) {
    if (this.isReleased) {
      return false
    }

    if (change.everything) {
      return true
    }

    if (this.latest.isAffected(change)) {
      return true
    }

    const { committed } = this

    return committed !== null && committed !== this.latest && committed.isAffected(change)
  }

  /** Чтение запроса: `db` живёт только внутри колбэка, ссылка на него, сохранённая на потом, закрыта. */
  private read(query: Query) {
    if (!this.isRunning) {
      throw new Error('oxeo: db доступен только внутри колбэка чтения; вне его читает client.read')
    }

    return this.store.read(query, this)
  }
}
