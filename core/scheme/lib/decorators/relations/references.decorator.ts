import { TypeMetadataStorage } from '../../storages/metadata.storage'
import { Type } from '../../utils'

export interface ReferenceSetOptions {
  cascadeCleanup?: boolean // удаление использующихся моделей в свойстве при удалении родительской модели
  // 'unlink' by default
  onRefDeleting?: 'unlink' | 'restrict'
}

// @ReferenceSet
// Контролирует массив ссылок на идентификаторы другой модели определенной аргументом ref
// в случае если удалена модель ссылка на которую указана в массиве, данная ссылка будет автоматически очищена
export function ReferenceSet<T>(ref: () => Type<T>, options?: ReferenceSetOptions): PropertyDecorator {
  return (target, propertyKey) => {
    // reference-set создает inverse-связь
    TypeMetadataStorage.addRelationMetadata({
      target: target.constructor,
      refType: 'reference-set',
      referenceModel: ref,
      propertyKey: propertyKey as string,
      options
    })
  }
}

interface Restrict {
  // 'restrict' by default
  onRefDeleting?: 'restrict'
  nullable?: boolean // поле может иметь 'restrict', но при этом быть nullable (todo: add test case)
}

interface SetNull {
  onRefDeleting?: 'set-null' // means auto-nullable
}

interface BaseOptions {
  index?: boolean
  unique?: boolean
}

export type ReferenceToOptions = (SetNull | Restrict) & BaseOptions

// @ReferenceTo
// Управляет связью поля с идентификатором записи модели T, определенной аргументом ref: () => T
// При попытке удалить модель с активной ссылкой, произойдет блокирование удаление
export function ReferenceTo<T>(ref: () => Type<T>, options?: ReferenceToOptions): PropertyDecorator {
  return (target, propertyKey) => {
    // reference-to создает inverse-связь
    TypeMetadataStorage.addRelationMetadata({
      target: target.constructor,
      refType: 'reference-to',
      referenceModel: ref,
      propertyKey: propertyKey as string,
      options
    })
  }
}
