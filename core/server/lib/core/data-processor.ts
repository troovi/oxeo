import { getArrayCommits } from '@companix/utils-js'
import { __DEV__ } from '../utils'
import { getGuaranteedValueByAddress } from '../utils/get-deep-value'
import { CoreError } from './helpers/errors'
import {
  CollectionScheme,
  DataScheme,
  IType,
  ModelData,
  PropertyMap,
  TargetReferencesStore
} from '@oxeo/scheme'
import { CollectionDriver } from './types/driver.types'
import { changesTracker } from './changes-tracker'
import { styles, xRay } from '../utils/x-ray'
import { DriverQuery, createQueryBuilder } from './helpers/query-builder'

/** Запись в коллекцию: модель и id записи. */
export interface CollectionWrite {
  model: string
  id: IType
}

interface Options {
  id: IType
  model: string
  isBase?: boolean
}

const isUniqe = (items: (string | number)[]) => {
  return items.length === Array.from(new Set(items)).length
}

export class DataProcessor<T extends CollectionScheme> {
  constructor(
    private dataScheme: DataScheme<T>,
    private driver: CollectionDriver,
    private onWrite: (write: CollectionWrite) => void = () => {}
  ) {}

  async create(data: object, model: string) {
    const modeldata = this.dataScheme.models[model]

    const refs = this.getModelReferences(modeldata, data)
    const id = this.getModelId(modeldata, data)

    if (await this.driver.exists({ id, model })) {
      throw new CoreError(model, { reason: 'EXISTS', id })
    }

    if (__DEV__) {
      xRay.splitter()
      xRay.print('➕ PROCESSOR.CREATE', styles.yellow)('"model":', model, '"data":', data)
      xRay.print('MODEL DATA', styles.info)(modeldata)
      xRay.print('CURRENT MODEL DATA', styles.info)({ id }, 'refs:', refs)
    }

    const queryBuilder = createQueryBuilder()

    // create this model
    queryBuilder.put('collections.create', { model, data })

    for (const address in refs) {
      const ref = refs[address]

      if (ref.refType === 'owner-fallback') {
        if (__DEV__) {
          xRay.print('ref:')({ address, type: ref.refType }, 'fallback')
        }

        // мы не проводим проверку ссылки owner-fallback, поскольку зависимая модель создается всегда первее владеющей
        continue
      }

      if (ref.refType === 'owner') {
        // проверяем ссылку на зависимую модель (todo, проверить что owner-fallback id ссылается на owner)
        const refId = getGuaranteedValueByAddress(data, address)
        const isExists = await this.driver.exists({ model: ref.model, id: refId })

        if (!isExists) {
          throw new CoreError(ref.model, { reason: 'NOT_EXISTS', refId })
        }

        if (__DEV__) {
          xRay.print('ref:')({ address, type: ref.refType, refId })
        }

        continue
      }

      // при cascadeCleanup нам необходимо удалить модели указанные в массиве ссылок. То есть, мы должны проверить возможность удаления связанной модели.
      // Связанная модель может блокировать удаление, либо содержать ссылки reference-set с cascadeClenup, модели которых тоже могут блокировать удаление. Необходимо рекурсивно проверить, возможно ли удалить сущность
      if (ref.refType === 'reference-set') {
        const refSet = getGuaranteedValueByAddress(data, address) as IType[]

        // проверяем все ли элементы в refSet уникальны
        if (!isUniqe(refSet)) {
          throw new CoreError(ref.model, { reason: 'RELATION_RESTRICT', address, info: 'unique' })
        }

        for (const refId of refSet) {
          const isExists = await this.driver.exists({ model: ref.model, id: refId })

          if (!isExists) {
            throw new CoreError(ref.model, { reason: 'NOT_EXISTS', refId })
          }

          queryBuilder.put('table.createRecord', {
            tableName: ref.tableName,
            modelSide: model,
            modelId: id,
            oppositeId: refId
          })
        }

        if (__DEV__) {
          xRay.print('ref:')({ address, type: ref.refType, refSet })
        }

        continue
      }

      if (ref.refType === 'reference-to') {
        const refId = getGuaranteedValueByAddress(data, address) as IType

        if (!ref.nullable || (ref.nullable && refId !== null)) {
          const isExists = await this.driver.exists({ model: ref.model, id: refId })

          if (!isExists) {
            throw new CoreError(ref.model, { reason: 'NOT_EXISTS', refId })
          }

          queryBuilder.put('table.createRecord', {
            tableName: ref.tableName,
            modelSide: model,
            modelId: id,
            oppositeId: refId
          })

          if (__DEV__) {
            xRay.print('ref:')({ address, type: ref.refType, refId })
          }
        }

        continue
      }

      if (ref.refType === 'has-many') {
        const refSet = getGuaranteedValueByAddress(data, address) as IType[]

        // has-many массив должен создаваться пустым
        if (refSet.length > 0) {
          throw new CoreError(ref.model, { reason: 'RELATION_RESTRICT', address, info: 'has-many >0' })
        }

        if (__DEV__) {
          xRay.print('ref:')({ address, type: ref.refType, refSet })
        }

        continue
      }

      if (ref.refType === 'belongs-to') {
        const refId = getGuaranteedValueByAddress(data, address)

        const refTarget = await this.driver.get({ model: ref.model, id: refId })

        if (!refTarget) {
          throw new CoreError(ref.model, { reason: 'NOT_EXISTS', refId })
        }

        // ref.modelHasManyProperty может указывать на поле в дискриминированной модели
        // в таком случае, нужно проверить, что сущность refId по ref.model имеет правильную дискриминацию
        const refScheme = this.dataScheme.models[ref.model].scheme

        if (refScheme.type === 'discriminated' && ref.modelDiscriminatorValue) {
          if (refTarget[refScheme.discriminatorKey as keyof object] !== ref.modelDiscriminatorValue) {
            throw new CoreError(ref.model, {
              reason: 'RELATION_RESTRICT',
              info: 'invalid discriminator',
              address
            })
          }
        }

        // без вышеуказанной проверки, патч мог бы быть неприменим к неправильно дискриминированной модели
        queryBuilder.put('collections.update', {
          model: ref.model,
          id: refId,
          patches: [{ type: 'push', items: [id], address: ref.modelHasManyProperty }]
        })

        if (__DEV__) {
          xRay.print('ref:')({ address, type: ref.refType, refId })
        }

        continue
      }
    }

    if (__DEV__) {
      xRay.print('QUERIES')(queryBuilder.build())
    }

    return this.save(queryBuilder.build())
  }

  async remove(id: IType, model: string) {
    const queries = await this.getRemoveQueries({ id, model, isBase: true })

    if (__DEV__) {
      xRay.print('QUERIES')(queries)
    }

    return this.save(queries)
  }

  async update(id: IType, model: string, mutate: (draft: object) => void) {
    const modeldata = this.dataScheme.models[model]
    const data = await this.driver.get({ model, id })

    if (!data) {
      throw new CoreError(model, { reason: 'NOT_EXISTS', refId: id })
    }

    const refs = this.getModelReferences(modeldata, data)
    const map = this.getModelProperiesMap(modeldata, data)

    if (__DEV__) {
      xRay.splitter()
      xRay.print('✏️ PROCESSOR.UPDATE', styles.yellow)('id', id, '"model":', model)
      xRay.print('PREV DATA', styles.info)(data)
      xRay.print('MODEL DATA', styles.info)(modeldata)
      xRay.print('CURRENT MODEL DATA', styles.info)({ id }, 'refs:', refs)
    }

    // есть два пути отслеживания изменений:
    // 1. склонировать весь объект, провести его мутацию, а затем, пройтись по всем его свойствам (задекларированных в модели) сравнив их со свойствами оригинального объекта. На основе этого и определить разницу
    // 2. проксировать объект (не глубоко), а затем проксировать каждый новый вложенный объект при обращении по ключу, и делать не глубокие копии при изменении его свойств. На основе этого, можно определить,
    // какие свойства были затронуты, и сравнить изменения только по данным адресам

    // на выходе мы должны получить объект updates с адресами полей (согласно объявленным в модели данных) и их новыми значениями { [address: string]: value }
    // пример: если в модели есть свойство profile с типом json, и было изменено какое то глубокое свойство данного объекта, пусть profile.info.name, то мы перезаписываем весь объект profile
    // поскольку, у json может быть любой формат и изменения могут быть глубоко во вложенных массивах, в таком случае нет способа описать mongodb как именно обновить такой объект, так как он не работает с индексами, и на них нельзя полагаться.
    // Но если profile и profile.info будут embedded сущностями с объявленным полем name, то при его изменении мы бы изменили только profile.info.name, вместо всего объекта

    const { changedPaths, nextState } = changesTracker(data, mutate)

    // дискриминатор нельзя менять через update — у новой формы другой набор полей/связей,
    // которые update (резолвящий по карте СТАРОЙ формы) либо уронит, либо тихо испортит.
    // Для смены формы есть отдельный changeDiscriminator.
    if (modeldata.scheme.type === 'discriminated') {
      const discriminatorKey = modeldata.scheme.discriminatorKey

      if (changedPaths.some((path) => path.length === 1 && path[0] === discriminatorKey)) {
        throw new CoreError(model, {
          reason: 'RELATION_RESTRICT',
          address: discriminatorKey,
          info: 'discriminator-immutable'
        })
      }
    }

    const relationsBuffer: { address: string; prevValue: unknown; nextValue: unknown }[] = []

    const queryBuilder = createQueryBuilder()

    for (const path of changedPaths) {
      const state = {
        address: map as PropertyMap | string,
        nextValue: nextState,
        prevValue: data
      }

      for (const property of path) {
        if (typeof state.address === 'object' && state.address[property]) {
          state.address = state.address[property]

          state.nextValue = state.nextValue[property as keyof object]
          state.prevValue = state.prevValue[property as keyof object]
        } else {
          break
        }
      }

      if (typeof state.address !== 'string') {
        throw new Error(`[internal]: invalid address ${path.join('.')}, map: ${JSON.stringify(map)}`)
      }

      queryBuilder.put('collections.update', {
        model,
        id,
        patches: [{ type: 'set', address: state.address, value: state.nextValue }]
      })

      if (refs[state.address]) {
        relationsBuffer.push({ ...state, address: state.address })
      }
    }

    if (__DEV__) {
      xRay.print('changesTracker')(id, model, { changedPaths, nextState })
      xRay.print('relationsBuffer:')(relationsBuffer)
    }

    // далее мы проверяем были ли совершены изменения над полями-связями, и если были, выполняем проверку на их валидность, а также в случае необходимости, добавляем новые связи в таблицы, совершаем кросс-модельные изменения.
    // связи могут не только добавляться, но и удаляться - при изменении reference-to ссылки, мы создаем в таблице новую связь, и удаляем прежнюю. При изменении состава reference-set массива удаляем удаленные связи, и добавляем добавленные
    // ограничение: belongs-to поле не может модифицироваться. при удалении элемента из has-many поля, проверяем возможность удаления связанной сущности - и удаляем ее (блокируем прямое добавление новых ссылок в массив has-many)
    for await (const { address, prevValue, nextValue } of relationsBuffer) {
      const ref = refs[address]

      if (ref.refType === 'owner-fallback' || ref.refType === 'owner') {
        // owner ссылки не могут модифицироваться, они создаются один раз при создании документа
        throw new CoreError(model, { reason: 'RELATION_RESTRICT', address, info: 'owner' })
      }

      if (ref.refType === 'belongs-to') {
        // смена belongs-to ссылки пока не предусматривается (должен удаляться у одного has-many и добавляться в другой)
        throw new CoreError(model, { reason: 'RELATION_RESTRICT', address, info: 'belongs-to' })
      }

      if (ref.refType === 'has-many') {
        // модификация has-many массива пока не предусматривается - при удалении элемента, должен удаляться соответствующая belongs-to (не совсем правильно удалять его из массива)
        // добавление нового элемента в массив невозможно, поскольку для этого необходимо созадть belongs-to сущность
        // допустимо - сортировка массива
        throw new CoreError(model, { reason: 'RELATION_RESTRICT', address, info: 'has-many' })
      }

      // нет кейса на удаление
      if (ref.refType === 'reference-to') {
        // switching to another refId
        if (nextValue !== null) {
          const isExists = await this.driver.exists({ model: ref.model, id: nextValue as IType })

          if (!isExists) {
            throw new CoreError(ref.model, { reason: 'NOT_EXISTS', refId: nextValue as IType })
          }

          queryBuilder.put('table.createRecord', {
            tableName: ref.tableName,
            modelSide: model,
            modelId: id,
            oppositeId: nextValue as IType
          })
        }

        queryBuilder.put('table.removeRecord', {
          tableName: ref.tableName,
          modelSide: model,
          modelId: id,
          oppositeId: prevValue as IType
        })

        if (__DEV__) {
          xRay.print('ref:')({ address, type: ref.refType, nextValue })
        }
      }

      if (ref.refType === 'reference-set') {
        if (!isUniqe(nextValue as IType[])) {
          throw new CoreError(ref.model, { reason: 'RELATION_RESTRICT', address, info: 'unique' })
        }

        const { added, removed } = getArrayCommits(prevValue as IType[], nextValue as IType[], {
          getCommonKey: (item) => item.toString(),
          isChanged: (prev, curr) => {
            return prev !== curr
          }
        })

        if (__DEV__) {
          xRay.print('ref:')({ address, type: ref.refType, added, removed })
        }

        await Promise.all(
          added.map(async (refId) => {
            const isExists = await this.driver.exists({ model: ref.model, id: refId })

            if (!isExists) {
              throw new CoreError(ref.model, { reason: 'NOT_EXISTS', refId })
            }

            queryBuilder.put('table.createRecord', {
              tableName: ref.tableName,
              modelSide: model,
              modelId: id,
              oppositeId: refId
            })
          })
        )

        removed.forEach((refId) => {
          queryBuilder.put('table.removeRecord', {
            tableName: ref.tableName,
            modelSide: model,
            modelId: id,
            oppositeId: refId
          })
        })
      }
    }

    if (__DEV__) {
      xRay.print('QUERIES')(queryBuilder.build())
    }

    return this.save(queryBuilder.build())
  }

  // TODO: кажется метод слишком большой, не помешало бы найти общие практики во всем классе, и уменьшить количество кода

  // смена дискриминированной формы сущности (id и общие поля сохраняются).
  // концептуально = «снести срез старой формы + создать срез новой»: чистим связи/таблицы старой
  // формы, валидируем и проставляем связи новой формы, и заменяем запись целиком (replace),
  // чтобы выкинуть скалярные поля старой формы. Блокируется, если у старой формы есть живые
  // зависимости (непустой has-many).
  async changeDiscriminator(id: IType, model: string, nextValue: string, patch: object) {
    const modeldata = this.dataScheme.models[model]
    const { scheme, refscheme } = modeldata

    if (scheme.type !== 'discriminated') {
      throw new CoreError(model, {
        reason: 'RELATION_RESTRICT',
        address: '',
        info: 'not-discriminated'
      })
    }

    const data = await this.driver.get({ model, id })

    if (!data) {
      throw new CoreError(model, { reason: 'NOT_EXISTS', refId: id })
    }

    const discriminatorKey = scheme.discriminatorKey
    const prevValue = data[discriminatorKey as keyof object] as string

    if (!scheme.discriminators.some((discriminator) => discriminator.value === nextValue)) {
      throw new CoreError(model, {
        reason: 'RELATION_RESTRICT',
        address: discriminatorKey,
        info: 'unknown-discriminator'
      })
    }

    if (prevValue === nextValue) {
      throw new CoreError(model, {
        reason: 'RELATION_RESTRICT',
        address: discriminatorKey,
        info: 'same-discriminator'
      })
    }

    const prevRefs: TargetReferencesStore = refscheme.discriminatorRefs?.[prevValue] ?? {}
    const nextRefs: TargetReferencesStore = refscheme.discriminatorRefs?.[nextValue] ?? {}

    if (__DEV__) {
      xRay.splitter()
      xRay.print('🔀 PROCESSOR.CHANGE_DISCRIMINATOR', styles.yellow)('id', id, '"model":', model)
      xRay.print('FROM → TO', styles.info)(prevValue, '→', nextValue, 'patch:', patch)
    }

    const queryBuilder = createQueryBuilder()

    // (1) СНОС связей старой формы (только variant-specific; общие связи не трогаем)
    for (const address in prevRefs) {
      const ref = prevRefs[address]

      if (ref.refType === 'owner' || ref.refType === 'owner-fallback') {
        // структурные связи нельзя переносить на другую форму
        throw new CoreError(model, { reason: 'RELATION_RESTRICT', address, info: ref.refType })
      }

      if (ref.refType === 'has-many') {
        const refSet = getGuaranteedValueByAddress(data, address) as IType[]

        // у старой формы есть живые зависимости — морфить нельзя
        if (refSet.length > 0) {
          throw new CoreError(model, { reason: 'DEPENDENCY_RESTRICT', model: ref.model })
        }

        continue
      }

      if (ref.refType === 'belongs-to') {
        const refId = getGuaranteedValueByAddress(data, address)

        queryBuilder.put('collections.update', {
          model: ref.model,
          id: refId,
          patches: [{ type: 'pull', items: [id], address: ref.modelHasManyProperty }]
        })

        continue
      }

      if (ref.refType === 'reference-to' || ref.refType === 'reference-set') {
        queryBuilder.put('table.removeRecordsByModel', {
          tableName: ref.tableName,
          modelSide: model,
          modelId: id
        })

        continue
      }
    }

    // (2) сборка сущности новой формы: общие поля из текущей + id + дискриминатор + поля патча
    const nextData = this.composeDiscriminatedData(modeldata, data, nextValue, patch)

    // (3) ВАЛИДАЦИЯ + установка связей новой формы (логика как в create, но только variant-specific)
    for (const address in nextRefs) {
      const ref = nextRefs[address]

      if (ref.refType === 'owner-fallback') {
        continue
      }

      if (ref.refType === 'owner') {
        const refId = getGuaranteedValueByAddress(nextData, address)
        const isExists = await this.driver.exists({ model: ref.model, id: refId })

        if (!isExists) {
          throw new CoreError(ref.model, { reason: 'NOT_EXISTS', refId })
        }

        continue
      }

      if (ref.refType === 'reference-set') {
        const refSet = getGuaranteedValueByAddress(nextData, address) as IType[]

        if (!isUniqe(refSet)) {
          throw new CoreError(ref.model, { reason: 'RELATION_RESTRICT', address, info: 'unique' })
        }

        for (const refId of refSet) {
          const isExists = await this.driver.exists({ model: ref.model, id: refId })

          if (!isExists) {
            throw new CoreError(ref.model, { reason: 'NOT_EXISTS', refId })
          }

          queryBuilder.put('table.createRecord', {
            tableName: ref.tableName,
            modelSide: model,
            modelId: id,
            oppositeId: refId
          })
        }

        continue
      }

      if (ref.refType === 'reference-to') {
        const refId = getGuaranteedValueByAddress(nextData, address) as IType

        if (!ref.nullable || (ref.nullable && refId !== null)) {
          const isExists = await this.driver.exists({ model: ref.model, id: refId })

          if (!isExists) {
            throw new CoreError(ref.model, { reason: 'NOT_EXISTS', refId })
          }

          queryBuilder.put('table.createRecord', {
            tableName: ref.tableName,
            modelSide: model,
            modelId: id,
            oppositeId: refId
          })
        }

        continue
      }

      if (ref.refType === 'has-many') {
        const refSet = getGuaranteedValueByAddress(nextData, address) as IType[]

        // has-many новой формы обязан стартовать пустым (как при create)
        if (refSet.length > 0) {
          throw new CoreError(ref.model, { reason: 'RELATION_RESTRICT', address, info: 'has-many >0' })
        }

        continue
      }

      if (ref.refType === 'belongs-to') {
        const refId = getGuaranteedValueByAddress(nextData, address)
        const refTarget = await this.driver.get({ model: ref.model, id: refId })

        if (!refTarget) {
          throw new CoreError(ref.model, { reason: 'NOT_EXISTS', refId })
        }

        const refScheme = this.dataScheme.models[ref.model].scheme

        if (refScheme.type === 'discriminated' && ref.modelDiscriminatorValue) {
          if (refTarget[refScheme.discriminatorKey as keyof object] !== ref.modelDiscriminatorValue) {
            throw new CoreError(ref.model, {
              reason: 'RELATION_RESTRICT',
              info: 'invalid discriminator',
              address
            })
          }
        }

        queryBuilder.put('collections.update', {
          model: ref.model,
          id: refId,
          patches: [{ type: 'push', items: [id], address: ref.modelHasManyProperty }]
        })

        continue
      }
    }

    // (4) замена записи целиком (выкидывает скалярные поля старой формы)
    queryBuilder.put('collections.replace', { model, id, data: nextData })

    if (__DEV__) {
      xRay.print('QUERIES')(queryBuilder.build())
    }

    return this.save(queryBuilder.build())
  }

  // helpers

  // собирает данные сущности новой формы: общие поля переносятся из текущей сущности,
  // identifier и дискриминатор форсируются (неизменность id + целевая форма), variant-поля — из патча
  private composeDiscriminatedData(
    { scheme, map }: ModelData,
    data: object,
    nextValue: string,
    patch: object
  ): object {
    const next: Record<string, unknown> = {}

    // общие скалярные/embedded поля (map.common НЕ содержит identifier — он отдельным декоратором)
    for (const key of Object.keys(map.common)) {
      next[key] = data[key as keyof object]
    }

    // поля новой формы
    Object.assign(next, patch)

    // форсируем неизменность id и целевую форму (на случай мусора в патче)
    next[scheme.identifier.propertyKey] = data[scheme.identifier.propertyKey as keyof object]

    if (scheme.type === 'discriminated') {
      next[scheme.discriminatorKey] = nextValue
    }

    return next
  }

  private async getRemoveQueries({ model, id, isBase }: Options) {
    const modeldata = this.dataScheme.models[model]
    const data = await this.driver.get({ model, id })

    if (__DEV__) {
      xRay.splitter()
      xRay.print('❌ PROCESSOR.REMOVE', styles.yellow)('id', id, '"model":', model)
    }

    if (!data) {
      throw new CoreError(model, { reason: 'NOT_EXISTS', refId: id })
    }

    const queryBuilder = createQueryBuilder()

    // remove this model
    queryBuilder.put('collections.remove', { model, id })

    const refs = this.getModelReferences(modeldata, data)

    // связи содержащиеся в самой модели (некоторые связи приводят к удалению подчиненных моделей, а те в свою очередь могут вызывать удаление других и так далее)
    // задача: проверяем на наличие каскадных удалений и их запреты (каскадное удаление может быть глубоким)
    for (const address in refs) {
      const ref = refs[address]

      if (ref.refType === 'owner-fallback') {
        if (isBase) {
          throw new CoreError(model, { reason: 'RELATION_RESTRICT', address, info: 'owner-fallback' })
        }

        continue
      }

      if (ref.refType === 'owner') {
        // remove owner-fallback
        const inner = await this.getRemoveQueries({
          model: ref.model,
          id: getGuaranteedValueByAddress(data, address)
        })

        queryBuilder.merge(inner)
        continue
      }

      // при cascadeCleanup нам необходимо удалить модели указанные в массиве ссылок. То есть, мы должны проверить возможность удаления связанной модели.
      // Связанная модель может блокировать удаление, либо содержать ссылки reference-set с cascadeClenup, модели которых тоже могут блокировать удаление. Необходимо рекурсивно проверить, возможно ли удалить сущность
      if (ref.refType === 'reference-set') {
        if (ref.cascadeCleanup) {
          const refSet = getGuaranteedValueByAddress(data, address) as IType[]

          // пример глубокой блокировки (при каскадном удалении сущностей):
          // model_a[reference-set to model_b] <- cascadeDelete
          // model_b[reference-set to model_c] <- cascadeDelete
          // model_c[has inverse reference-to that block removing]

          for (const refId of refSet) {
            const inner = await this.getRemoveQueries({
              id: refId,
              model: ref.model
            })

            queryBuilder.merge(inner)
          }
        }

        queryBuilder.put('table.removeRecordsByModel', {
          tableName: ref.tableName,
          modelSide: model,
          modelId: id
        })

        continue
      }

      if (ref.refType === 'reference-to') {
        queryBuilder.put('table.removeRecordsByModel', {
          tableName: ref.tableName,
          modelSide: model,
          modelId: id
        })

        continue
      }

      if (ref.refType === 'has-many') {
        const refSet = getGuaranteedValueByAddress(data, address) as IType[]

        if (ref.cleanupBehavior === 'restrict') {
          if (refSet.length !== 0) {
            throw new CoreError(model, { reason: 'RELATION_RESTRICT', address, info: 'has-many !== 0' })
          }
        }

        if (ref.cleanupBehavior === 'cascade') {
          for (const refId of refSet) {
            const inner = await this.getRemoveQueries({
              id: refId,
              model: ref.model
            })

            queryBuilder.merge(inner)
          }
        }

        continue
      }

      if (ref.refType === 'belongs-to') {
        const refId = getGuaranteedValueByAddress(data, address)

        queryBuilder.put('collections.update', {
          model: ref.model,
          id: refId,
          patches: [{ type: 'pull', items: [id], address: ref.modelHasManyProperty }]
        })

        continue
      }
    }

    // потребители модели в свойствах других моделей
    // задача: проверяем блокировки удаления и очищаем связи в таблицах связей
    for await (const inverseRef of modeldata.refscheme.inverseRefs) {
      if (inverseRef.refType === 'reference-to') {
        const inverseModelIds = await this.driver.tables.getRecords({
          tableName: inverseRef.tableName,
          modelSide: model,
          modelId: id
        })

        if (inverseRef.onDeleteBehavior === 'restrict') {
          if (inverseModelIds.length > 0) {
            throw new CoreError(model, { reason: 'DEPENDENCY_RESTRICT', model: inverseRef.model })
          }
        }

        if (inverseRef.onDeleteBehavior === 'set-null') {
          inverseModelIds.forEach((inverseModelId) => {
            queryBuilder.put('collections.update', {
              model: inverseRef.model,
              id: inverseModelId,
              patches: [{ type: 'set', value: null, address: inverseRef.modelConsumerProperty }]
            })
          })

          // удаляем все записи по данной модели в коллекции, где она используется
          queryBuilder.put('table.removeRecordsByModel', {
            tableName: inverseRef.tableName,
            modelSide: model,
            modelId: id
          })
        }
      }

      if (inverseRef.refType === 'reference-set') {
        const inverseModelIds = await this.driver.tables.getRecords({
          tableName: inverseRef.tableName,
          modelSide: model,
          modelId: id
        })

        if (inverseRef.onDeleteBehavior === 'restrict') {
          if (inverseModelIds.length > 0) {
            throw new CoreError(model, { reason: 'DEPENDENCY_RESTRICT', model: inverseRef.model })
          }
        }

        if (inverseRef.onDeleteBehavior === 'unlink') {
          inverseModelIds.forEach((inverseModelId) => {
            queryBuilder.put('collections.update', {
              model: inverseRef.model,
              id: inverseModelId,
              patches: [{ type: 'pull', items: [id], address: inverseRef.modelConsumerProperty }]
            })
          })

          // удаляем все записи по данной модели в коллекции, где она используется
          queryBuilder.put('table.removeRecordsByModel', {
            tableName: inverseRef.tableName,
            modelSide: model,
            modelId: id
          })
        }
      }
    }

    return queryBuilder.build({ optimize: isBase })
  }

  async getExternalRelations(id: IType, model: string) {
    const modeldata = this.dataScheme.models[model]
    const buffer = new Map<string, IType[]>()

    for await (const inverseRef of modeldata.refscheme.inverseRefs) {
      if (inverseRef.refType === 'reference-to') {
        const inverseModelIds = await this.driver.tables.getRecords({
          tableName: inverseRef.tableName,
          modelSide: model,
          modelId: id
        })

        const inverseModelName = await this.driver.tables.getOppositeModelName({
          tableName: inverseRef.tableName,
          modelSide: model
        })

        if (inverseModelIds.length > 0) {
          buffer.set(inverseModelName, [...(buffer.get(inverseModelName) ?? []), ...inverseModelIds])
        }
      }

      if (inverseRef.refType === 'reference-set') {
        const inverseModelIds = await this.driver.tables.getRecords({
          tableName: inverseRef.tableName,
          modelSide: model,
          modelId: id
        })

        const inverseModelName = await this.driver.tables.getOppositeModelName({
          tableName: inverseRef.tableName,
          modelSide: model
        })

        if (inverseModelIds.length > 0) {
          buffer.set(inverseModelName, [...(buffer.get(inverseModelName) ?? []), ...inverseModelIds])
        }
      }
    }

    const result: { model: string; ids: IType[] }[] = []

    for (const model of buffer.keys()) {
      const ids = buffer.get(model)

      if (ids) {
        result.push({ model, ids })
      }
    }

    return result
  }

  private getModelReferences({ scheme }: ModelData, data: object): TargetReferencesStore {
    return this.dataScheme.referencesOf(scheme.name, data)
  }

  private getModelProperiesMap({ scheme, map }: ModelData, data: object) {
    if (scheme.type === 'discriminated' && map.discriminators) {
      const discriminator = data[scheme.discriminatorKey as keyof object] as string

      if (discriminator) {
        return { ...map.common, ...map.discriminators[discriminator] }
      }
    }

    return map.common
  }

  private getModelId({ scheme }: ModelData, data: object): IType {
    return data[scheme.identifier.propertyKey as keyof object]
  }

  private async save(queries: DriverQuery[]) {
    queries.forEach((query) => this.reportWrite(query))

    await Promise.all(
      queries.map(({ action, params }) => {
        if (action === 'collections.create') {
          return this.driver.create(params)
        }

        if (action === 'collections.remove') {
          return this.driver.remove(params)
        }

        if (action === 'collections.update') {
          return this.driver.update(params)
        }

        if (action === 'collections.replace') {
          return this.driver.replace(params)
        }

        if (action === 'table.createRecord') {
          return this.driver.tables.createRecord(params)
        }

        if (action === 'table.removeRecord') {
          return this.driver.tables.removeRecord(params)
        }

        if (action === 'table.removeRecordsByModel') {
          return this.driver.tables.removeRecordsByModel(params)
        }

        // never
        return () => {}
      })
    )

    return queries.length > 0
  }

  /** Запись коллекции — слушателю `DataSource.subscribeWrites`; строки таблиц связей не сообщаются. */
  private reportWrite({ action, params }: DriverQuery) {
    if (action === 'collections.create') {
      const { identifier } = this.dataScheme.models[params.model].scheme

      this.onWrite({ model: params.model, id: params.data[identifier.propertyKey as keyof object] })
      return
    }

    if (
      action === 'collections.remove' ||
      action === 'collections.update' ||
      action === 'collections.replace'
    ) {
      this.onWrite({ model: params.model, id: params.id })
    }
  }
}
