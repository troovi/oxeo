import { TypeMetadataStorage } from '../storages/metadata.storage'

export interface DiscriminatedModelOptions {
  name: string
  discriminatorKey: string
}

// модель обязана иметь identifier-поле, характеризующее
export function DiscriminatedModel(options: DiscriminatedModelOptions): ClassDecorator {
  return function (target) {
    TypeMetadataStorage.addDiscriminatedModelMetadata({
      target,
      name: options.name,
      discriminatorKey: options.discriminatorKey
    })
  }
}
