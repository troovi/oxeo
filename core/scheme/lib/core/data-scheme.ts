import {
  InverseRefsTypes,
  ReferenceScheme,
  RelationsTableInfo,
  TargetReferencesStore,
  TargetRefsTypes
} from './types/refscheme.types'
import {
  ModelProperties,
  ModelScheme,
  PropertyMetadata,
  PropertyRelation,
  TypeMetadataStorage
} from '../storages/metadata.storage'
import { IType } from './types/collections.types'
import { KeyOfType, Type } from '../utils'

interface RelationInfo {
  relationPath: string
  relation: PropertyRelation
}

interface ReferenceParams {
  model: string
  relationPath: string
  relation: PropertyRelation
}

export interface PropertyMap {
  [name: string]: string | PropertyMap
}

export interface ModelMap {
  common: PropertyMap
  discriminators?: { [value: string]: PropertyMap }
}

/**
 * Type-level метаинформация дискриминированной коллекции. Присутствует только у коллекций,
 * созданных через defineDiscriminatedCollection;
 */
export interface DiscriminatedMeta<B = unknown, VU = unknown, DK extends string = string> {
  discriminatorKey: DK
  /** phantom — база (для Omit<вариант, keyof B> при вычислении патча) */
  readonly __base?: B
  /** phantom — объединение типов вариантов */
  readonly __variants?: VU
}

export interface CollectionInfo<
  T,
  K extends KeyOfType<T, IType> = KeyOfType<T, IType>,
  DM extends DiscriminatedMeta | null = null
> {
  model: Type<T>
  name: string
  identifierKey: K
  identifierType: T[K]
  // null для обычных коллекций; для дискриминированных несёт type-info
  discriminated: DM
}

export interface CollectionScheme {
  [name: string]: CollectionInfo<any, any, any>
}

export interface ModelData {
  scheme: ModelScheme
  refscheme: ReferenceScheme
  map: ModelMap
}

export type InferScheme<T extends DataScheme<CollectionScheme>> =
  T extends DataScheme<infer P> ? P : never

/**
 * Компилирует метаданные моделей из TypeMetadataStorage (собранные декораторами) в структуры для быстрого
 * поиска в рантайме. Класс подготавливает данные для DataProcessor пакета `@oxeo/server`, вычисляет связи, на основе
 * информации по моделям
 */
export class DataScheme<T extends CollectionScheme> {
  public metadata = TypeMetadataStorage

  public models: { [model: string]: ModelData } = {}
  public tables: RelationsTableInfo[] = []

  // collectionScheme не используется в данном класе, схема передается в конструктор, чтобы выполнить код
  // класса после того как все коллекции будут объявлены и собраны в TypeMetadataStorage
  constructor(public collectionsScheme: T) {
    const buffer: { model: string; fields: ModelProperties; target: TargetReferencesStore }[] = []

    // initialize data sources
    this.metadata.getModels().forEach((scheme) => {
      this.models[scheme.name] = {
        scheme,
        refscheme: { commonRefs: {}, inverseRefs: [] },
        map: { common: this.createPropertiesMap(scheme) }
      }

      const modelRef = this.models[scheme.name].refscheme
      const modelMap = this.models[scheme.name].map

      buffer.push({
        fields: scheme,
        target: modelRef.commonRefs,
        model: scheme.name
      })

      if (scheme.type === 'discriminated') {
        modelRef.discriminatorRefs = {}
        modelMap.discriminators = {}

        scheme.discriminators.forEach((discriminator) => {
          modelRef.discriminatorRefs![discriminator.value] = {}
          modelMap.discriminators![discriminator.value] = this.createPropertiesMap(discriminator)

          buffer.push({
            fields: discriminator,
            target: modelRef.discriminatorRefs![discriminator.value],
            model: scheme.name
          })
        })
      }
    })

    // call relation after all models was initiated
    buffer.forEach(({ model, fields, target }) => {
      this.getRelationsProperties(fields, ({ relationPath, relation }) => {
        const targetType = this.getTargetRef({
          model,
          relationPath,
          relation
        })

        const inverseType = this.getInverseRef({
          model,
          relationPath,
          relation
        })

        target[relationPath] = targetType

        if (inverseType) {
          const inverseModel = this.metadata.getModelSchemaByTarget(relation.referenceModel)
          this.models[inverseModel.name].refscheme.inverseRefs.push(inverseType)
        }

        if (relation.refType === 'reference-to' || relation.refType === 'reference-set') {
          this.tables.push(this.getRelationsTableInfo({ model, relationPath, relation }))
        }
      })
    })
  }

  // prettier-ignore
  private getRelationsProperties({ properties, references }: ModelProperties, cb: (info: RelationInfo) => void) {
    this.getEmbeddedRelationsProperties(properties, cb)

    references.forEach((relation) => {
      cb({ relationPath: relation.propertyKey, relation })
    })
  }

  // prettier-ignore
  private getEmbeddedRelationsProperties(properties: PropertyMetadata[], cb: (info: RelationInfo) => void, basePath: string[] = []) {
    properties.forEach(({ primitive, propertyKey }) => {
      if (primitive.type === 'embedded') {
        primitive.references.forEach((relation) => {
          cb({ relationPath: [...basePath, propertyKey, relation.propertyKey].join('.'), relation })
        })

        this.getEmbeddedRelationsProperties(primitive.properties, cb, [...basePath, propertyKey])
      }
    })
  }

  private getTargetRef(params: ReferenceParams): TargetRefsTypes {
    const { relation } = params

    switch (relation.refType) {
      case 'reference-set': {
        return {
          refType: 'reference-set',
          model: this.metadata.getModelSchemaByTarget(relation.referenceModel).name,
          tableName: this.getRelationsTableInfo(params).tableName,
          cascadeCleanup: relation.options?.cascadeCleanup ?? false
        }
      }
      case 'reference-to': {
        return {
          refType: 'reference-to',
          model: this.metadata.getModelSchemaByTarget(relation.referenceModel).name,
          tableName: this.getRelationsTableInfo(params).tableName,
          // prettier-ignore
          nullable: relation.options?.onRefDeleting === 'set-null' || (relation.options?.onRefDeleting === 'restrict' && (relation.options.nullable ?? false))
        }
      }
      case 'belongs-to': {
        const propertiesMap = this.getProperiesMap(relation.referenceModel)
        const inverseSideProperty = relation.inverseSideProperty(propertiesMap)
        const referenceModel = this.metadata.getModelSchemaByTarget(relation.referenceModel)
        const modelDiscriminatorValue = this.getDiscriminatorValue(
          referenceModel,
          relation.referenceModel()
        )

        return {
          refType: 'belongs-to',
          model: referenceModel.name,
          modelDiscriminatorValue,
          modelHasManyProperty: inverseSideProperty
        }
      }
      case 'has-many': {
        const propertiesMap = this.getProperiesMap(relation.referenceModel)
        const inverseSideProperty = relation.inverseSideProperty(propertiesMap)
        const referenceModel = this.metadata.getModelSchemaByTarget(relation.referenceModel)
        const modelDiscriminatorValue = this.getDiscriminatorValue(
          referenceModel,
          relation.referenceModel()
        )

        return {
          refType: 'has-many',
          model: referenceModel.name,
          cleanupBehavior: relation.options?.cleanupBehavior ?? 'restrict',
          modelDiscriminatorValue,
          modelBelongsToProperty: inverseSideProperty
        }
      }
      case 'owner': {
        return {
          model: this.metadata.getModelSchemaByTarget(relation.referenceModel).name,
          refType: 'owner'
        }
      }
      case 'owner-fallback': {
        return {
          model: this.metadata.getModelSchemaByTarget(relation.referenceModel).name,
          refType: 'owner-fallback'
        }
      }
    }
  }

  private getInverseRef(params: ReferenceParams): InverseRefsTypes | null {
    const { relation, model, relationPath } = params

    switch (relation.refType) {
      case 'reference-set': {
        return {
          refType: 'reference-set',
          model: model,
          onDeleteBehavior: relation.options?.onRefDeleting ?? 'unlink',
          modelConsumerProperty: relationPath,
          tableName: this.getRelationsTableInfo(params).tableName
        }
      }
      case 'reference-to': {
        return {
          refType: 'reference-to',
          model: model,
          onDeleteBehavior: relation.options?.onRefDeleting ?? 'restrict',
          modelConsumerProperty: relationPath,
          tableName: this.getRelationsTableInfo(params).tableName
        }
      }
      default: {
        return null
      }
    }
  }

  private getRelationsTableInfo(params: ReferenceParams): RelationsTableInfo {
    const { model, relation, relationPath } = params

    const reference = this.metadata.getModelSchemaByTarget(relation.referenceModel)

    return {
      tableName: `refs_${model}_and_${reference.name}_${relationPath.replaceAll('.', '_')}`,
      rules: {
        m1: model,
        m2: reference.name
      }
    }
  }

  private getDiscriminatorValue(referenceModel: ModelScheme, refTarget: Function) {
    if (referenceModel.type === 'discriminated') {
      if (refTarget !== referenceModel.target) {
        const discriminator = referenceModel.discriminators.find(
          (discriminator) => discriminator.target === refTarget
        )

        if (!discriminator) {
          throw new Error(`Discriminator not found for: ${referenceModel.name}`)
        }

        return discriminator.value
      }
    }

    return null
  }

  /**
   * Связи записи модели по адресам: общие и, у дискриминированной модели, связи формы записи. Нужны всем, кто идёт по
   * ссылкам записи: проверкам и каскадам `DataProcessor`, захвату ссылок рантаймом доменов.
   */
  referencesOf(model: string, data: object): TargetReferencesStore {
    const { refscheme, scheme } = this.models[model]
    const { commonRefs, discriminatorRefs } = refscheme

    if (scheme.type === 'discriminated' && discriminatorRefs) {
      const discriminator = data[scheme.discriminatorKey as keyof object] as string

      return { ...discriminatorRefs[discriminator], ...commonRefs }
    }

    return { ...commonRefs }
  }

  /**
   * Creates a special object - all columns and relations of the object (plus columns and relations from embeds)
   * in a special format - { propertyName: propertyName }.
   *
   * example: Post{ id: number, name: string, counterEmbed: { count: number }, category: Category }.
   * This method will create following object:
   * { id: "id", counterEmbed: { count: "counterEmbed.count" }, category: "category" }
   */
  private createPropertiesMap(fields: ModelProperties, basePath: string[] = []): PropertyMap {
    const { properties, references } = fields
    const map: PropertyMap = {}

    for (const { primitive, propertyKey } of properties) {
      const propertyPath = [...basePath, propertyKey].join('.')

      if (primitive.type === 'embedded') {
        map[propertyKey] = this.createPropertiesMap(primitive, [...basePath, propertyKey])
        continue
      }

      map[propertyKey] = propertyPath
    }

    for (const { propertyKey } of references) {
      map[propertyKey] = [...basePath, propertyKey].join('.')
    }

    return map
  }

  private getProperiesMap(ref: () => Function) {
    const referenceModel = this.metadata.getModelSchemaByTarget(ref)
    const map = this.models[referenceModel.name].map

    if (referenceModel.type === 'discriminated' && map.discriminators) {
      const discriminator = referenceModel.discriminators.find((discriminator) => {
        return discriminator.target === ref()
      })

      if (discriminator) {
        return { ...map.common, ...map.discriminators[discriminator.value] }
      }
    }

    return map.common
  }
}

// prettier-ignore
export const defineCollection = <T, K extends KeyOfType<T, IType>>(model: Type<T>, identifierKey: K): CollectionInfo<T, K> => {
  const data = TypeMetadataStorage.getModelSchemaByTarget(() => model)

  if(data.identifier.propertyKey !== identifierKey){
    throw new Error(`Provided ${identifierKey as string} not match with model ${data.identifier.propertyKey}`)
  }

  return { model, name: data.name, identifierType: {} as T[K], identifierKey, discriminated: null }
}

export interface DiscriminatedCollectionOptions<B, D extends readonly Type<unknown>[], K, DK> {
  baseScheme: Type<B>
  discriminators: D
  identifier: K
  // ключ-дискриминатор базовой модели; должен совпадать с @DiscriminatedModel({ discriminatorKey })
  discriminatorKey: DK
}

type DiscriminatedFrom<D extends readonly Type<unknown>[]> = D[number] extends Type<infer A> ? A : never

// prettier-ignore
export const defineDiscriminatedCollection = <
  B,
  K extends KeyOfType<B, IType>,
  DK extends KeyOfType<B, string> & string,
  D extends readonly Type<unknown>[]
>(
  options: DiscriminatedCollectionOptions<B, D, K, DK>
): CollectionInfo<DiscriminatedFrom<D>, K, DiscriminatedMeta<B, DiscriminatedFrom<D>, DK>> => {
  const meta = TypeMetadataStorage.getModelSchemaByTarget(() => options.baseScheme)

  if (meta.type !== 'discriminated') {
    throw new Error(`Model "${meta.name}" is not a discriminated model (use @DiscriminatedModel)`)
  }

  if (meta.discriminatorKey !== (options.discriminatorKey as string)) {
    throw new Error(
      `Provided discriminatorKey "${String(options.discriminatorKey)}" does not match model "${meta.name}" key "${meta.discriminatorKey}"`
    )
  }

  const base = defineCollection(
    options.baseScheme as Type<DiscriminatedFrom<D>>,
    options.identifier as unknown as KeyOfType<DiscriminatedFrom<D>, IType>
  )

  return {
    ...base,
    discriminated: { discriminatorKey: options.discriminatorKey }
  } as CollectionInfo<DiscriminatedFrom<D>, K, DiscriminatedMeta<B, DiscriminatedFrom<D>, DK>>
}
