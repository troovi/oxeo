import {
  CollectionScheme,
  DataScheme,
  ModelProperties,
  PropertyRelation,
  PropertyMetadata,
  ModelScheme
} from '@oxeo/scheme'
import type { SchemaDefinition, SchemaDefinitionProperty } from 'mongoose'
import { Schema } from 'mongoose'

const TypesTranslator = {
  string: String,
  number: Number,
  json: Object,
  boolean: Boolean
}

interface IndexFlags {
  index?: boolean
  unique?: boolean
}

/**
 * Опции индекса для mongoose — только заданные флаги. Ключ `index` или `unique` со значением `undefined` mongoose
 * понимает как просьбу об индексе и строит его на каждом поле.
 */
const indexOptions = ({ index, unique }: IndexFlags) => {
  return { ...(index ? { index: true } : {}), ...(unique ? { unique: true } : {}) }
}

export class DefinitionsFactory<T extends CollectionScheme> {
  constructor(private dataScheme: DataScheme<T>) {}

  createForCollection(name: keyof T): SchemaDefinition {
    return this.createForScheme(
      this.dataScheme.models[this.dataScheme.collectionsScheme[name].name].scheme
    )
  }

  createForScheme(scheme: ModelScheme): SchemaDefinition {
    return {
      [scheme.identifier.propertyKey]: {
        index: true,
        type: TypesTranslator[scheme.identifier.options.type],
        unique: true
      },
      ...this.createDefinitionScheme(scheme)
    }
  }

  createDefinitionScheme({ properties, references }: ModelProperties): SchemaDefinition {
    const map: SchemaDefinition = {}

    for (const property of properties) {
      map[property.propertyKey] = this.getPropertyDefinition(property)
    }

    for (const reference of references) {
      map[reference.propertyKey] = this.getRelationDefinition(reference)
    }

    return map
  }

  private getPropertyDefinition({ primitive }: PropertyMetadata): SchemaDefinitionProperty {
    switch (primitive.type) {
      case 'embedded': {
        return {
          _id: false, //  prevent creating _id (без указания mongodb создавал бы _id для всех вложенных объектов)
          type: this.createDefinitionScheme(primitive),
          required: true
        }
      }
      case 'array': {
        return {
          type: [TypesTranslator[primitive.itemType]],
          required: true
        }
      }
      case 'literal': {
        return {
          type: Schema.Types.Mixed, // сузить до String и Number
          enum: primitive.values,
          required: !primitive.nullable,
          ...indexOptions(primitive)
        }
      }
      case 'enum': {
        return {
          type: [String], // может быть и Number
          enum: primitive.values,
          required: !primitive.nullable
        }
      }
      case 'string':
      case 'number': {
        return {
          type: TypesTranslator[primitive.type],
          ...indexOptions(primitive)
        }
      }
      default: {
        return {
          type: TypesTranslator[primitive.type]
        }
      }
    }
  }

  private getRelationDefinition(reference: PropertyRelation): SchemaDefinitionProperty {
    const refModel = this.dataScheme.metadata.getModelSchemaByTarget(reference.referenceModel)

    switch (reference.refType) {
      case 'reference-to': {
        // prettier-ignore
        const nullable = reference.options?.onRefDeleting === 'set-null' || (reference.options?.onRefDeleting === 'restrict' && (reference.options.nullable ?? false))

        return {
          type: TypesTranslator[refModel.identifier.options.type],
          ...indexOptions(reference.options ?? {}),
          required: !nullable
        }
      }
      case 'reference-set': {
        return {
          type: [TypesTranslator[refModel.identifier.options.type]]
        }
      }
      case 'belongs-to': {
        // ключ родителя — фильтр каждого чтения дочерних записей (`find({ <parent>Id })`), поэтому индекс всегда
        return {
          type: TypesTranslator[refModel.identifier.options.type],
          index: true,
          required: true
        }
      }
      case 'has-many': {
        return {
          type: [TypesTranslator[refModel.identifier.options.type]],
          required: true
        }
      }
      case 'owner': {
        return {
          type: TypesTranslator[refModel.identifier.options.type],
          required: true
        }
      }
      case 'owner-fallback': {
        return {
          type: TypesTranslator[refModel.identifier.options.type],
          refType: 'owner-fallback'
        }
      }
    }
  }
}
