/**
 * Сборщик прохода чтения: что колбэк прочитал (для подписки) и чего не хватило (для загрузки). Сборщик один на
 * компонент, каждый проход заполняет его заново. Фреймворка он не знает: создаёт его и подписывает привязка
 * (`@oxeo/react`).
 *
 * Работа сборщика по шагам:
 *
 * 1. Проход. `run` забывает прошлый проход и зовёт колбэк с `db` и `views` этого сборщика.
 * 2. Чтение. `db.<collection>` запоминает прочитанное, отдаёт запись через прокси, который запоминает поля, а недостающее
 *    кладёт в `needs`.
 * 3. Загрузка. Привязка отправляет `needs` одним пакетом и повторяет проход, когда ответ придёт.
 * 4. Изменение. Событие или ответ меняют данные клиента, и он рассылает `ClientChange` всем подписчикам.
 * 5. Фильтр. `isAffected` сверяет изменение с прочитанным. Не касается — компонент не трогаем, касается — новый проход.
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
  }

  /** Данных не хватило или запрос отказал: результат прохода выброшен. */
  export interface Incomplete {
    isComplete: false
  }
}

export type Pass<R> = Passes.Complete<R> | Passes.Incomplete

export class Tracker<Db = unknown, Views = unknown> {
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

  private proxies = new WeakMap<object, object>()
  /** Сколько изменений клиента было к началу прохода. */
  private seenChanges = 0
  private isRunning = false
  private isReleased = false

  private store: TrackerParams<Db, Views>['store']
  private readers: Readers<Db, Views>
  private plain: boolean

  constructor({ store, createReaders, plain = false }: TrackerParams<Db, Views>) {
    this.store = store
    this.readers = createReaders((query) => this.read(query))
    this.plain = plain
  }

  /**
   * Проход: всё прочитанное прошлым проходом забывается, колбэк получает `db` и `views` этого сборщика. Колбэк выполняется
   * целиком: чтения, которым не хватило данных, отдают пустое и копят потребности. Результат такого прохода и его ошибка
   * на пустых данных выбрасываются. Ошибка полного прохода — настоящая, она идёт наверх.
   */
  run<R>(read: Read<Db, Views, R>): Pass<R> {
    this.clear()
    this.seenChanges = this.store.changes
    this.isRunning = true

    const pass = { value: undefined as R | undefined, thrown: null as unknown, isThrown: false }

    try {
      pass.value = read(this.readers.db, this.readers.views)
    } catch (thrown) {
      pass.thrown = thrown
      pass.isThrown = true
    }

    this.isRunning = false

    if (this.needs.size > 0 || this.failures.size > 0) {
      return { isComplete: false }
    }

    if (pass.isThrown) {
      throw pass.thrown
    }

    return { isComplete: true, value: pass.value as R }
  }

  /** Разовое чтение получило результат: сборщик забывает прочитанное и больше ни на что не реагирует. */
  release() {
    this.clear()
    this.isReleased = true
  }

  /** Менялись ли данные клиента после прохода: подписка появляется позже него и этих изменений не видела. */
  hasMissedChanges() {
    return !this.isReleased && this.store.changes !== this.seenChanges
  }

  /** Набор прочитанных полей записи; заводится пустым — «важна сама запись». */
  fieldsOf(key: string) {
    if (!this.records.has(key)) {
      this.records.set(key, new Set())
    }

    return this.records.get(key)!
  }

  /** Запись через прокси, который кладёт прочитанные поля в набор записи; один прокси на запись за проход. */
  track<T extends object>(key: string, record: T): T {
    if (this.plain) {
      return record
    }

    const cached = this.proxies.get(record)

    if (cached) {
      return cached as T
    }

    const fields = this.fieldsOf(key)
    const proxy = new Proxy(record, {
      get(target, property, receiver) {
        if (typeof property === 'string') {
          fields.add(property)
        }

        return Reflect.get(target, property, receiver)
      }
    })

    this.proxies.set(record, proxy)
    return proxy
  }

  /** Касается ли изменение прочитанного: поля прочитанной записи, состава запроса или коллекции. */
  isAffected(change: ClientChange) {
    if (this.isReleased) {
      return false
    }

    if (change.everything) {
      return true
    }

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

  /** Чтение запроса: `db` живёт только внутри колбэка, ссылка на него, сохранённая на потом, закрыта. */
  private read(query: Query) {
    if (!this.isRunning) {
      throw new Error('oxeo: db доступен только внутри колбэка чтения; вне его читает client.read')
    }

    return this.store.read(query, this)
  }

  private clear() {
    this.needs.clear()
    this.failures.clear()
    this.records.clear()
    this.queries.clear()
    this.collections.clear()
    this.proxies = new WeakMap()
  }
}
