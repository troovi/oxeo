import { TypeMetadataStorage } from '../storages/metadata.storage'

export namespace IdentifierKind {
  export interface String {
    type: 'string'
  }

  export interface Number {
    type: 'number'
  }
}

export type IdentifierOption = IdentifierKind.Number | IdentifierKind.String

export function Identifier(options: IdentifierOption): PropertyDecorator {
  return function (target, propertyKey) {
    TypeMetadataStorage.addIdentifierMetadata({
      target: target.constructor,
      propertyKey: propertyKey as string,
      options
    })
  }
}
