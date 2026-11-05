import { TypeMetadataStorage } from '../storages/metadata.storage'

export interface ModelOptions {
  name: string
}

// модель обязана иметь identifier-поле, характеризующее
export function Model(options: ModelOptions): ClassDecorator {
  return function (target) {
    TypeMetadataStorage.addModelMetadata({ target, name: options.name })
  }
}
