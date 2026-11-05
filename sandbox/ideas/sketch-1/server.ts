// @ts-nocheck
/* eslint-disable */

// Сервер xeo 1.0: как его собирает версия песочницы и как устроена оболочка журнала внутри. Домены не меняются: сервер
// исполняет операцию, рассылает новые версии затронутых записей и отвечает на пакеты запросов с захватом ссылок

import { Body, Controller, Headers, Injectable, Param, Post, Sse } from '@nestjs/common'
import { Subject, map } from 'rxjs'
import { hash, QueueManager } from '@companix/utils-js'
import { DataSource, createBaseDriver, getGuaranteedValueByAddress } from '../lib'
import { appDomains } from '../core/domains'
import { dataScheme } from '../core/scheme'
import { JournalEvent, Query, QueryAnswer, QueryBatch, QueryResult, RecordVersion, StreamMessage } from './protocol'

// ------------------------------------------------ usage -------------------------------------------------

/**
 * Журнал версии: база (in-memory в песочнице, Mongo в CRM), оболочка над ней и поток сообщений всем клиентам. Снимка
 * больше нет: клиент получает данные пакетами запросов.
 */
@Injectable()
export class JournalService {
  readonly messages = new Subject<StreamMessage>()

  source = new DataSource(dataScheme, { createDriver: createBaseDriver })

  shell = createServerShell(appDomains, this.source, {
    counterCollection: 'counter',
    resolveActor: (identity) => this.resolveActor(identity),
    today: toDateISO,
    broadcast: (event) => this.messages.next({ type: 'event', data: event }),
    onPartialWrite: () => this.messages.next({ type: 'resync', data: 'partial-write' })
  })
}

/** Протокол: вызов операции, пакет запросов, поток событий. */
@Controller()
export class VersionController {
  constructor(private readonly journal: JournalService) {}

  /** Ответ — событие журнала: вызывающий клиент кладёт его в свою очередь так же, как событие из потока. */
  @Post('domains/:domain/:method')
  call(@Param('domain') domain: string, @Param('method') method: string, @Body() body: unknown) {
    return this.journal.call(domain, method, body, null)
  }

  @Post('data/query')
  query(@Body() batch: QueryBatch) {
    return this.journal.shell.query(batch)
  }

  @Sse('events')
  events() {
    return this.journal.messages.pipe(map((message) => ({ type: message.type, data: message.data })))
  }
}

// ----------------------------------------------- library ------------------------------------------------

/** Связи, по которым сервер захватывает записи вместе с отданной: на один уровень, `HasMany` — нет. */
const CAPTURED = new Set(['reference-to', 'reference-set', 'belongs-to'])

/**
 * Оболочка журнала. Как в 0.1: очередь вызовов, актор, момент, идентификаторы, ревизии и эпоха. Отличия: событие несёт
 * новые версии затронутых записей, а не ленту для повтора; снимка нет — вместо него `query`, пакет запросов, который
 * выполняется в той же очереди и снимает ответ на точной ревизии.
 */
export const createServerShell = (domains, dataSource, options) => {
  const epoch = hash()
  const queue = new QueueManager()
  const names = namesOf(dataSource.scheme)
  const services = initializeDomains(domains, dataSource.collections)
  const counter = dataSource.collections[options.counterCollection]

  // записи вызова: какие записи он тронул — коллекция счётчиков клиентам не нужна
  const touched = new Map<string, { model: string; id: IType }>()

  dataSource.subscribeWrites(({ model, id }) => {
    if (model !== names.modelOf[options.counterCollection]) {
      touched.set(`${model}:${id}`, { model, id })
    }
  })

  let revision = 0

  /** Новые версии тронутых записей: каждая читается из базы после операции; нет в базе — удалена. */
  const changesOf = async () => {
    const changes: RecordVersion[] = []

    for (const { model, id } of touched.values()) {
      const record = await dataSource.driver.get({ model, id })

      changes.push({ collection: names.collectionOf[model], id, record: record && serialize(record) })
    }

    return changes
  }

  /**
   * Выполнить вызов от имени идентичности или системы (`null`). Ответ — событие журнала, оно же уходит всем.
   * Упал после первой записи — команда пересинхронизации всем клиентам, как в 0.1.
   */
  const run = (call, identity, opts = {}) => {
    return queue.add(async () => {
      const actor = identity === null ? null : await options.resolveActor(identity)
      const at = opts.at ?? Date.now()
      const ctx = { actor, at, today: options.today(at), ids: createIdSource(counter) }

      touched.clear()

      try {
        const result = await methodOf(services, call)(call.params, ctx)
        const changes = await changesOf()

        const event: JournalEvent = {
          epoch,
          revision: ++revision,
          domain: call.domain,
          method: call.method,
          params: call.params,
          ctx: { actor, at, today: ctx.today },
          result,
          changes
        }

        options.broadcast(event)
        return event
      } catch (error) {
        if (touched.size > 0) {
          options.onPartialWrite({ call, error })
        }

        throw error
      }
    })
  }

  /**
   * Пакет запросов в очереди журнала: между вызовами, поэтому ревизия ответа точна. Сначала каждый запрос пакета, затем
   * захват — записи, на которые ведут ссылки отданных записей, на один уровень; каждая запись в ответе один раз.
   */
  const query = ({ queries }: QueryBatch) => {
    return queue.add(async (): Promise<QueryAnswer> => {
      const answer = createAnswer(names)
      const results: QueryResult[] = []

      for (const item of queries) {
        results.push(await resolve(dataSource, item, answer))
      }

      await capture(dataSource, answer)

      return { epoch, revision, records: answer.list(), results }
    })
  }

  return {
    epoch,
    get revision() {
      return revision
    },
    run,
    query
  }
}

/** Один запрос пакета: записи кладутся в ответ, результат — их id или число. */
const resolve = async (dataSource, item: Query, answer) => {
  const collection = dataSource.collections[item.collection]

  if (item.kind === 'count') {
    const count = await collection.count(item.where ?? {})

    return { count }
  }

  if (item.kind === 'get') {
    const idKey = dataSource.scheme.collectionsScheme[item.collection].identifierKey
    const found = await collection.findBy({ [idKey]: { in: item.ids } })

    return { ids: answer.addAll(item.collection, found) }
  }

  const found = item.where === null ? await collection.getAll() : await collection.findBy(item.where)

  return { ids: answer.addAll(item.collection, found) }
}

/**
 * Захват по ссылкам: для каждой записи ответа — поля `ReferenceTo`, `ReferenceSet`, `BelongsTo` по карте связей схемы
 * (общей и её дискриминатора); недостающие цели читаются одним `findBy` с `in` на модель. Захваченные записи сами
 * дальше не захватывают.
 */
const capture = async (dataSource, answer) => {
  const wanted = new Map<string, Set<IType>>()

  for (const { collection, record } of answer.list()) {
    const model = dataSource.scheme.collectionsScheme[collection].name
    const refs = referencesOf(dataSource.scheme.models[model], record)

    for (const address in refs) {
      const ref = refs[address]

      if (!CAPTURED.has(ref.refType)) {
        continue
      }

      const value = getGuaranteedValueByAddress(record, address)
      const ids = Array.isArray(value) ? value : [value]

      for (const id of ids) {
        if (id !== null && !answer.has(ref.model, id)) {
          wanted.set(ref.model, (wanted.get(ref.model) ?? new Set()).add(id))
        }
      }
    }
  }

  for (const [model, ids] of wanted) {
    const idKey = dataSource.scheme.models[model].scheme.identifier.propertyKey
    const found = await dataSource.driver.findBy({ model, filter: { [idKey]: { in: [...ids] } } })

    answer.addAll(answer.collectionOf(model), found)
  }
}

/** Имена моделей схемы (`Worker`) и ключи коллекций протокола (`worker`) — в обе стороны. */
const namesOf = (scheme) => {
  const collectionOf: { [model: string]: string } = {}
  const modelOf: { [collection: string]: string } = {}

  for (const collection in scheme.collectionsScheme) {
    const model = scheme.collectionsScheme[collection].name

    collectionOf[model] = collection
    modelOf[collection] = model
  }

  return { collectionOf, modelOf }
}

/** Ответ пакета: версии записей без повторов — запись, найденная двумя запросами или захваченная дважды, одна. */
const createAnswer = (names) => {
  const records = new Map<string, RecordVersion>()

  const addAll = (collection: string, found: object[]) => {
    const idKey = identifierKeyOf(collection)

    return found.map((record) => {
      const id = record[idKey]

      records.set(`${collection}:${id}`, { collection, id, record: serialize(record) })
      return id
    })
  }

  return {
    addAll,
    has: (model: string, id: IType) => records.has(`${names.collectionOf[model]}:${id}`),
    collectionOf: (model: string) => names.collectionOf[model],
    list: () => [...records.values()]
  }
}

// referencesOf(modelData, record) — карта связей записи: общая плюс её дискриминатора, как
// `DataProcessor.getModelReferences`; serialize — документ без `_id`/`__v` (опция оболочки, как в 0.1)

// ------------------------------------------ xeo-scheme changes ------------------------------------------

// `DataSource.subscribeWrites(listener)` — слушатель каждой записи в базу: `DataProcessor.save` перед выполнением
// запросов к драйверу сообщает модель и id каждого `collections.*` (create — id из данных). Не зависит от драйвера:
// у Mongo-драйвера своих событий мутаций нет, у базового они остаются для тестов.
//
// `findBy` и `count` коллекций принимают фильтр с операторами (`protocol.ts`, `Where`); `count(where)` — с фильтром.
// In-memory драйвер сверяет записи `matches` из `matcher.ts`; Mongo-драйвер переводит фильтр так:

/** Фильтр xeo в фильтр Mongo: embedded — путями через точку, операторы — с `$`. */
export const toMongoFilter = (where: object, prefix = '') => {
  const filter = {}

  for (const key in where) {
    const path = prefix ? `${prefix}.${key}` : key
    const condition = where[key]

    if (condition === null || typeof condition !== 'object' || Array.isArray(condition)) {
      filter[path] = condition
      continue
    }

    if (isOperators(condition)) {
      filter[path] = Object.fromEntries(Object.entries(condition).map(([name, value]) => [`$${name}`, value]))
      continue
    }

    Object.assign(filter, toMongoFilter(condition, path))
  }

  return filter
}

// ---------------------------------------------- toolkit changes -----------------------------------------
//
// Ленты идентификаторов больше нет: реплики не повторяют операции. `ctx.ids.string(label)` — `hash()`,
// `ctx.ids.number(source)` — следующий номер счётчика; метки остаются для читаемости доменов. Уходят `Context.replay`,
// `ReplayTape`, `replayMismatch`, `createClientShell` с повтором и правила детерминизма как условие паритета.
