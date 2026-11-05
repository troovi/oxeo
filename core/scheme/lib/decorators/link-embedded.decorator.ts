import { Type } from '../utils'
import { TypeMetadataStorage } from '../storages/metadata.storage'

export function LinkEmbedded<T>(embeddedRef: Type<T>): PropertyDecorator {
  return function (target, propertyKey) {
    TypeMetadataStorage.addLinkEmbeddedMetadata({
      embeddedRef,
      target: target.constructor,
      propertyKey: propertyKey as string
    })
  }
}
