import { TypeMetadataStorage } from '../storages/metadata.storage'
import { Type } from '../utils'

// суб-объект не имеет identifier-поле, поскольку это не модель, вместо этого, он ссылается на свойство родительской модели (либо другого суб-объекта), которая владет данным суб-объектом
// prettier-ignore
export function Embedded<T>(parentRef: () => Type<T>, getParentProperty: (object: T) => any): ClassDecorator {
  return function (target) {
    TypeMetadataStorage.addEmbeddedMetadata({
      target,
      parentRef,
      getParentProperty
    })
  }
}
