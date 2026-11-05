import { TypeMetadataStorage } from '../../storages/metadata.storage'
import { Type } from '../../utils'

// связь модель (владеющая) к модели (подчиненная)
// используйте, когда нужно получать доступ к подчиненной модели по ее идентификатору, без загрузки владеющей модели
// если такой необходимости нет, можно создать embedded объект, доступный при загрузке родителя, не имеющий идентификатора

export namespace ModelToModel {
  // Сущность с Owner держит ссылку на подчиненную модель. Подчиненная модель будет удалена при удалении владеющий модели
  // Экземаляр модели владелеца связи создается после создания зависимой модели. Ссылка на зависимую сущность должна быть действительна
  export function Owner<T>(ref: () => Type<T>, inverseProp: (object: T) => any): PropertyDecorator {
    return (target, propertyKey) => {
      TypeMetadataStorage.addRelationMetadata({
        target: target.constructor,
        refType: 'owner',
        propertyKey: propertyKey as string,
        referenceModel: ref,
        inverseSideProperty: inverseProp
      })
    }
  }

  // При создании экземпляра зависимой от родителя модели, ссылка на владеющую модель не проверяется, так как зависимая модель создается первее владеющей
  // Зависимая модель не может быть удалена сама по себе, она удаляется только при удалении родительской
  // prettier-ignore
  export function OwnerFallback<T>(ref: () => Type<T>, inverseProp: (object: T) => any): PropertyDecorator {
    return (target, propertyKey) => {
      TypeMetadataStorage.addRelationMetadata({
        target: target.constructor,
        refType: 'owner-fallback',
        propertyKey: propertyKey as string,
        referenceModel: ref,
        inverseSideProperty: inverseProp
      })
    }
  }
}
