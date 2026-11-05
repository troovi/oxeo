import { TypeMetadataStorage } from '../storages/metadata.storage'

// @Discriminator отличает наследуемые свойства от собственных и регистрирует только собственные
export function Discriminator(value: string): ClassDecorator {
  return function (target) {
    TypeMetadataStorage.addDiscriminatorMetadata({
      target,
      name: target.name,
      value
    })
  }
}
