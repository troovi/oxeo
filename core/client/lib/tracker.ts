/**
 * Сборщик одного прохода рендера: что тело прочитало (для подписки) и чего не хватило (для загрузки). Привязка к
 * фреймворку (`@oxeo/react`) ставит его на время прохода; чтения клиента видят его через `Tracker.current`.
 */
import type { Query } from '@oxeo/scheme'

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

export class Tracker {
  /** Сборщик прохода, который идёт сейчас; `null` — чтение вне рендера. */
  static current: Tracker | null = null

  /** Запросы, которых у клиента нет, — их загрузит привязка. */
  readonly needs = new Map<string, Query>()
  /** Запросы, загрузка которых не удалась после повторов. */
  readonly failures = new Set<string>()
  /** Прочитанные записи `collection:id` → прочитанные поля; пустой набор — важна сама запись. */
  readonly records = new Map<string, Set<string>>()
  /** Ключи прочитанных запросов. */
  readonly queries = new Set<string>()
  /** Коллекции, прочитанные из загруженных целиком. */
  readonly collections = new Set<string>()

  /** Снимок подписки: растёт с каждым изменением прочитанного. */
  version = 0

  private proxies = new WeakMap<object, object>()

  /** Проход: всё прочитанное прошлым проходом забывается, сборщик становится текущим на время `body`. */
  run<R>(body: () => R) {
    const prev = Tracker.current

    this.needs.clear()
    this.failures.clear()
    this.records.clear()
    this.queries.clear()
    this.collections.clear()
    this.proxies = new WeakMap()

    Tracker.current = this

    try {
      return body()
    } finally {
      Tracker.current = prev
    }
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

  /** Снимок подписки для `useSyncExternalStore` — и на клиенте, и при серверном рендере. */
  snapshot = () => {
    return this.version
  }

  /** Новый снимок подписки и уведомление фреймворка. */
  bump(onChange?: () => void) {
    this.version += 1
    onChange?.()
  }
}
