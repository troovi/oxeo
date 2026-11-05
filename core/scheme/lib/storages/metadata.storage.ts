import { PropertyTypes } from '../decorators/prop.decorator'
import {
  HasManyOptions,
  IdentifierOption,
  ModelOptions,
  ReferenceSetOptions,
  ReferenceToOptions
} from '../decorators'
import { isTargetEqual } from '../utils/is-target-equal'

// @Prop metadata
export interface PropertyMetadata {
  target: Function
  propertyKey: string
  primitive: PropertyTypes | EmbeddedPropery
}

export interface EmbeddedPropery extends ModelProperties {
  type: 'embedded'
}

// @Model metadata
export interface ModelMetadata {
  target: Function
  name: string
}

// @DiscriminatedModel metadata
export interface DiscriminatedModelMetadata {
  target: Function
  name: string
  discriminatorKey: string
}

// @Discriminator metadata
export interface DiscriminatorMetadata {
  target: Function
  name: string
  value: string
}

// @Identifier metadata
export interface IdentifierMetadata {
  target: Function
  propertyKey: string
  options: IdentifierOption
}

export interface EmbeddedMetadata {
  target: Function
  parentRef: () => Function
  getParentProperty: (t: any) => any
}

export interface LinkEmbeddedMetadata {
  target: Function
  propertyKey: string
}

// relation propetries

// @ReferenceSet metadata
export interface ReferenceSetMetadata {
  target: Function
  refType: 'reference-set'
  propertyKey: string
  referenceModel: () => Function
  options?: ReferenceSetOptions
}

// @ReferenceTo metadata
export interface ReferenceToMetadata {
  target: Function
  refType: 'reference-to'
  propertyKey: string
  referenceModel: () => Function
  options?: ReferenceToOptions
}

// @HasMany metadata
export interface HasManyMetadata {
  target: Function
  refType: 'has-many'
  propertyKey: string
  referenceModel: () => Function
  inverseSideProperty: (t: any) => any
  options?: HasManyOptions
}

// @BelongsTo metadata
export interface BelongsToMetadata {
  target: Function
  refType: 'belongs-to'
  propertyKey: string
  referenceModel: () => Function
  inverseSideProperty: (t: any) => any
}

// @Owner
export interface OwnerMetadata {
  target: Function
  refType: 'owner'
  propertyKey: string
  referenceModel: () => Function
  inverseSideProperty: (t: any) => any
}

// @OwnerFallback
export interface OwnerFallbackMetadata {
  target: Function
  refType: 'owner-fallback'
  propertyKey: string
  referenceModel: () => Function
  inverseSideProperty: (t: any) => any
}

// prettier-ignore
export type PropertyRelation = ReferenceSetMetadata | ReferenceToMetadata | HasManyMetadata | BelongsToMetadata | OwnerMetadata | OwnerFallbackMetadata

export interface ModelProperties {
  properties: PropertyMetadata[]
  references: PropertyRelation[]
}

export namespace ModelSchemas {
  export interface Base extends ModelProperties {
    type: 'base'
    target: Function
    name: string
    identifier: IdentifierMetadata
  }

  export interface Discriminated extends Omit<Base, 'type'> {
    type: 'discriminated'
    discriminatorKey: string
    discriminators: Discriminator[]
  }

  export interface Discriminator extends DiscriminatorMetadata, ModelProperties {}
}

export interface EmbeddedScheme extends ModelProperties {
  target: Function
  parentRef: () => Function
  getParentProperty: (t: any) => any
}

export interface EmbeddedLink {
  target: Function
  embeddedRef: Function
  propertyKey: string
}

export type ModelScheme = ModelSchemas.Base | ModelSchemas.Discriminated

export class TypeMetadataStorageHost {
  // described result
  private models = new Array<ModelScheme>()

  // properties storage
  private properties = new Array<PropertyMetadata>()
  private identifiers = new Array<IdentifierMetadata>()
  private relations = new Array<PropertyRelation>()
  private embedded = new Array<EmbeddedScheme>()

  addIdentifierMetadata(metadata: IdentifierMetadata) {
    this.identifiers.push(metadata)
  }

  addPropertyMetadata(metadata: PropertyMetadata) {
    this.properties.unshift(metadata)
  }

  addRelationMetadata(metadata: PropertyRelation) {
    this.relations.push(metadata)
  }

  // @Model
  addModelMetadata({ name, target }: ModelMetadata) {
    const model: ModelSchemas.Base = {
      type: 'base',
      name,
      target,
      identifier: this.getIdentifier(target),
      properties: this.getTargetAndExtendedProperties(target),
      references: this.getTargetAndExtendedRelations(target)
    }

    this.models.push(model)
  }

  // DiscriminatedModel will called before the Discriminator, because Discriminator extends from DiscriminatedModel
  addDiscriminatedModelMetadata({ target, name, discriminatorKey }: DiscriminatedModelMetadata) {
    const discriminatedModel: ModelSchemas.Discriminated = {
      type: 'discriminated',
      target,
      name,
      discriminatorKey,
      identifier: this.getIdentifier(target),
      properties: this.getTargetAndExtendedProperties(target),
      references: this.getTargetAndExtendedRelations(target),
      discriminators: []
    }

    this.models.push(discriminatedModel)
  }

  addDiscriminatorMetadata({ target, name, value }: DiscriminatorMetadata) {
    const baseTarget = Object.getPrototypeOf(target)
    const baseModel = this.getModelSchemaByTarget(() => baseTarget)

    if (!baseModel || baseModel.type !== 'discriminated') {
      throw new Error(
        `Cannot find the base discrimination model for "${name}". Make sure that discriminator extends from discrimination model`
      )
    }

    baseModel.discriminators.push({
      name,
      value,
      target,
      properties: this.getTargetProperties(target),
      references: this.getTargetRelations(target)
    })
  }

  addEmbeddedMetadata({ target, getParentProperty, parentRef }: EmbeddedMetadata) {
    this.embedded.push({
      target,
      properties: this.getTargetAndExtendedProperties(target),
      references: this.getTargetAndExtendedRelations(target),
      getParentProperty,
      parentRef
    })
  }

  // embedded link executes after embedded initiated
  addLinkEmbeddedMetadata({ target, embeddedRef, propertyKey }: EmbeddedLink) {
    const embedded = this.embedded.find((item) => item.target === embeddedRef)

    if (!embedded) {
      throw new Error(
        `Embedded "${embeddedRef.name}" not found for "${target.name}". Make sure embedded uses @Embedded`
      )
    }

    if (embedded.parentRef() !== target) {
      throw new Error(`Embedded ${embedded.parentRef().name} not belongs to ${target.name}`)
    }

    this.properties.push({
      target,
      propertyKey,
      primitive: {
        type: 'embedded',
        properties: embedded.properties,
        references: embedded.references
      }
    })
  }

  // getters

  getModelSchemaByTarget(getTargetRef: () => Function) {
    const model = this.models.find((item) => isTargetEqual({ target: getTargetRef() }, item))

    if (!model) {
      const name = getTargetRef().name

      throw new Error(
        `Cannot find model metadata "${name}". Make sure that model provided to DataSource`
      )
    }

    return model
  }

  getModels() {
    return this.models
  }

  // helpers

  private getIdentifier(target: Function) {
    const identifiers = this.identifiers.filter((value) => {
      return value.target === target
    })

    if (identifiers.length === 0) {
      throw new Error(`Model ${target.name} should have identifier`)
    }

    if (identifiers.length !== 1) {
      throw new Error(`Model ${target.name} cannot have more than one identifier`)
    }

    return identifiers[0]
  }

  getIdentifierTarget(target: Function) {
    return this.identifiers.filter((value) => {
      return value.target === target
    })
  }

  getTargetProperties(target: Function) {
    return this.properties.filter((i) => target === i.target)
  }

  getTargetAndExtendedProperties(target: Function) {
    return this.properties.filter((i) => isTargetEqual({ target }, { target: i.target }))
  }

  getTargetRelations(target: Function) {
    return this.relations.filter((i) => target === i.target)
  }

  getTargetAndExtendedRelations(target: Function) {
    return this.relations.filter((i) => isTargetEqual({ target }, { target: i.target }))
  }
}

export const TypeMetadataStorage: TypeMetadataStorageHost = new TypeMetadataStorageHost()

// Справка по MongooseModule.forFeature (forFeature всего лишь метод в MongooseModule для создания DynamicModule, он мог бы называться и register как в JwtModule)
//
// forFeature от MongooseModule (вызываемый в imports) возврашает DynamicModule (@nestjs/common) - { module: MongooseModule, providers: providers, exports: providers }
// метод принимает в аргументах массив схем и именами их классов { schema: AccountSchema, name: Account.name }, на основе этих аргументов генерируются
// providers (Provider от '@nestjs/common'); которые представляют из себя объекты типа: { provide, useFactory, inject }
//

// https://docs.nestjs.com/fundamentals/dynamic-modules#community-guidelines
// useFactory - a function that returns the configuration object. It can be either synchronous or asynchronous. To inject dependencies into the factory function, use the inject property. We used this variant in the example above.
// inject - an array of dependencies that will be injected into the factory function. The order of the dependencies must match the order of the parameters in the factory function.

// provide - в объекте Provider — это токен (ключ) зависимости, по которому DI-контейнер хранит и ищет значение.
// useFactory — функция, возвращающая объект конфигурации. Она может быть синхронной или асинхронной. Внедрения зависимостей в фабричную функцию определяет свойство inject
// inject — массив зависимостей, которые будут внедрены в фабричную функцию. Порядок зависимостей должен соответствовать порядку параметров в фабричной функции.
