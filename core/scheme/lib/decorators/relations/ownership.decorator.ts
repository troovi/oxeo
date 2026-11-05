import { TypeMetadataStorage } from '../../storages/metadata.storage'
import { Type } from '../../utils'

// @HasMany и @BelongsTo представляют собой взаимосвязанные (парные) декораторы.
// Они не создают отдельную вспомогательную таблицу для хранения связей — вся
// информация о связях хранится непосредственно в полях моделей, помеченных этими декораторами.

// Идентификаторы, указанные в поле HasMany одного объекта, не могут одновременно присутствовать
// в аналогичном поле HasMany другого объекта. Это означает, что поле модели, использующее HasMany,
// содержит список связанных идентификаторов и выступает единственным источником истины для данной связи.

// Благодаря этому, отсутствует необходимость в вспомогательной таблице, поскольку информация о связях явно
// хранится в самих полях HasMany и BelongsTo.

// Как это работает:
// При создании объекта с декоратором BelongsTo идентификатор этой модели автоматически добавляется
// в соответствующее поле HasMany связанной модели. При удалении объекта связь также автоматически удаляется.

// Почему RelationSet/RelationTo используют таблицу связей?
// Данные декораторы могут отсылаться к одной и той же модели и использоваться в большом количестве разных мест
// Поскольку связываемая модель не хранит ссылки на потребителей, мы должны указать их в вспомогательной таблице
// Так как при удалении модели использующейся в отсылках RelationSet/RelationTo, нужно эффективно получить все связи
// в которых она состоит.

export interface HasManyOptions {
  // restrict by default (it means if has-many array have some refs, deletings will be blocked)
  cleanupBehavior?: 'cascade' | 'restrict'
}

export namespace Ownership {
  // ref-аргумент определяет модель (T) идентификаторы которой следует хранить в массиве ссылок у свойства использующего @HasMany
  // inverseSide - поле модели T хранящий идентификатор указывающий на связь с самой target моделью, нужно так как
  // @HasMany не хранит любые идентификаторы модели T, она хранит только те, что указывают на ее идентификатор в свойстве определенным в inverseSide
  // prettier-ignore
  export function HasMany<T>(ref: () => Type<T>, inverseProp: (object: T) => any, options?: HasManyOptions): PropertyDecorator {
    return (target, propertyKey) => {
      TypeMetadataStorage.addRelationMetadata({
        target: target.constructor,
        refType: 'has-many',
        propertyKey: propertyKey as string,
        referenceModel: ref,
        inverseSideProperty: inverseProp,
        options
      })
    }
  }

  // ref-аргумент определяет модель (T), идентификатор которой будет хранится у свойства в качестве значения
  // второй аргумент inverseSide, определяет, в каком свойстве модели T будут храниться идентификаторы указывающие на связь с данной target моделью
  // Другими словами это указание на массив-свойство в котором хранятся ссылки на данную модель (нужно чтобы знать, откуда удалять идентификатор при удалении данной модели)
  export function BelongsTo<T>(ref: () => Type<T>, inverseProp: (object: T) => any): PropertyDecorator {
    return (target, propertyKey) => {
      TypeMetadataStorage.addRelationMetadata({
        target: target.constructor,
        refType: 'belongs-to',
        propertyKey: propertyKey as string,
        referenceModel: ref,
        inverseSideProperty: inverseProp
      })
    }
  }
}

// CASE: Удаление ревизора с revisorId - 1:
// При удалении ревизора, в первую очередь, мы обращаемся к таблице потребителей ревизора
// и находим, что модель seat потребляет ревизора, и что более важно, наличие связи будет блокировать удаление (cleanable: false)
// поэтому, обращаемся к таблице для проверки связей по revisorId 1, с целью получить массив seats.
// В результате получаем не пустой массив, это означает, что изменение необходио заблокировать

// CASE: Удаление seat с seatId - 'seat-1':
// При удалении seat, есть потребитель - модель worker, поле seats.
// Удаление seat не приведет к блокировке изменений, поэтому, в случае отсуствия других блокировок
// системе просто необходимо удалить запись в таблице по seatId 'seat-1'
