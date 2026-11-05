import { TypeMetadataStorage } from '../storages/metadata.storage'

interface BaseOptions {
  index?: boolean
  unique?: boolean
}

export interface NullableProperty {
  nullable?: boolean
}

export namespace PropertyType {
  export interface String extends NullableProperty, BaseOptions {
    type: 'string'
    nonempty?: boolean
    email?: boolean
  }

  export interface Boolean extends NullableProperty {
    type: 'boolean'
  }

  export interface Number extends NullableProperty, BaseOptions {
    type: 'number'
  }

  export interface Json extends NullableProperty {
    type: 'json'
  }

  export interface Array {
    type: 'array'
    itemType: 'number' | 'string' | 'json'
  }

  export interface Enum extends NullableProperty {
    type: 'enum'
    values: (string | number)[]
  }

  export interface Literal extends NullableProperty {
    type: 'literal'
    values: (string | number)[]
  }
}

/////////////////////// Properies Decorators ///////////////////////

// prettier-ignore
export type PropertyTypes = PropertyType.String | PropertyType.Boolean | PropertyType.Number | PropertyType.Enum | PropertyType.Json | PropertyType.Array | PropertyType.Literal

export function Prop(primitive: PropertyTypes): PropertyDecorator {
  return (target, propertyKey) => {
    TypeMetadataStorage.addPropertyMetadata({
      target: target.constructor,
      propertyKey: propertyKey as string,
      primitive
    })
  }
}
