import { z } from 'zod'
import type { PropertyTypes } from './decorators/prop.decorator'
import {
  TypeMetadataStorage,
  PropertyMetadata,
  PropertyRelation,
  IdentifierMetadata,
  EmbeddedPropery
} from './storages/metadata.storage'
import type { Type } from './utils'

const primitiveToZod = (primitive: PropertyTypes | EmbeddedPropery): z.ZodTypeAny => {
  switch (primitive.type) {
    case 'string': {
      const schema = (() => {
        if (primitive.nonempty) {
          return z.string().nonempty()
        }

        if (primitive.email) {
          return z.string().email()
        }

        return z.string()
      })()

      if (primitive.nullable) {
        return schema.nullable()
      }

      return schema
    }

    case 'number': {
      const schema = z.number()

      if (primitive.nullable) {
        return schema.nullable()
      }

      return schema
    }

    case 'boolean': {
      const schema = z.boolean()

      if (primitive.nullable) {
        return schema.nullable()
      }

      return schema
    }

    case 'literal': {
      const schema = z.enum(primitive.values as string[])

      if (primitive.nullable) {
        return schema.nullable()
      }

      return schema
    }

    case 'enum': {
      const schema = z.array(z.enum(primitive.values as string[]))

      if (primitive.nullable) {
        return schema.nullable()
      }

      return schema
    }

    case 'json': {
      const schema = z.any()

      if (primitive.nullable) {
        return schema.nullable()
      }

      return schema
    }

    case 'array': {
      const itemSchema = (() => {
        if (primitive.itemType === 'string') {
          return z.string()
        }

        if (primitive.itemType === 'number') {
          return z.number()
        }

        return z.any()
      })()

      return z.array(itemSchema)
    }

    case 'embedded': {
      return buildObjectSchema(primitive)
    }

    default: {
      return z.any()
    }
  }
}

const identifierToZod = (identifier: IdentifierMetadata): z.ZodTypeAny => {
  return identifier.options.type === 'string' ? z.string() : z.number()
}

const relationToZod = (relation: PropertyRelation): z.ZodTypeAny => {
  let refIdentifierType: 'string' | 'number' = 'string'

  try {
    const refSchema = TypeMetadataStorage.getModelSchemaByTarget(relation.referenceModel)
    refIdentifierType = refSchema.identifier.options.type
  } catch {
    // do nothing
  }

  const baseSchema = refIdentifierType === 'string' ? z.string() : z.number()

  // setRef
  if (relation.refType === 'reference-set' || relation.refType === 'has-many') {
    return z.array(baseSchema)
  }

  // linkRef
  // belongs-to, reference-to, owner, owner-fallback
  return baseSchema
}

interface SchemaOptions {
  properties: PropertyMetadata[]
  references: PropertyRelation[]
  identifier?: IdentifierMetadata
}

const buildObjectSchema = ({ properties, references, identifier }: SchemaOptions): z.ZodObject<any> => {
  const shape: Record<string, z.ZodTypeAny> = {}

  if (identifier) {
    shape[identifier.propertyKey] = identifierToZod(identifier)
  }

  for (const property of properties) {
    shape[property.propertyKey] = primitiveToZod(property.primitive)
  }

  for (const reference of references) {
    shape[reference.propertyKey] = relationToZod(reference)
  }

  return z.object(shape)
}

const cache = new WeakMap<Function, z.ZodObject<any>>()

type SchemaShape<T> = {
  [K in keyof T]: z.ZodType<T[K]>
}

/**
 * Derives a Zod schema from an @oxeo/scheme entity class by reading its
 * decorator metadata at runtime.
 *
 * The return type is `z.ZodObject<SchemaShape<InstanceType<T>>>`, preserving
 * compile-time type safety from the entity class definition.
 *
 * Works with @Model, @DiscriminatedModel, @Embedded, and plain base classes.
 * For json/any typed fields, use .extend() to supply a precise Zod schema.
 *
 * schemaOf will be excluded in runtime (its only for type generations and server dto)
 */
export const schemaOf = <T extends Type>(EntityClass: T): z.ZodObject<SchemaShape<InstanceType<T>>> => {
  const buffer = cache.get(EntityClass)

  if (buffer) {
    return buffer
  }

  const identifiers = TypeMetadataStorage.getIdentifierTarget(EntityClass)
  const modelIdentifier = (() => {
    try {
      return TypeMetadataStorage.getModelSchemaByTarget(() => EntityClass).identifier
    } catch {
      return undefined
    }
  })()
  const properties = TypeMetadataStorage.getTargetAndExtendedProperties(EntityClass)
  const references = TypeMetadataStorage.getTargetAndExtendedRelations(EntityClass)

  const schema = buildObjectSchema({
    properties,
    references,
    identifier: identifiers[0] ?? modelIdentifier
  })

  cache.set(EntityClass, schema)

  return schema
}
