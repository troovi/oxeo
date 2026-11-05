/**
 * Модель схемы для визуализации: всё, что генератор знает о коллекциях oxeo, в форме, не зависящей от
 * раскладки и отрисовки. Строится `extractScheme` из `DataScheme` и исходников схемы.
 */

export type OnDelete = 'cascade' | 'restrict' | 'set-null' | 'unlink'

export type FieldKind = 'id' | 'prop' | 'embedded' | 'ref' | 'set' | 'own' | 'owner'

export interface Field {
  name: string
  /** Адрес поля в документе: `payout.cardId`. */
  path: string
  kind: FieldKind
  /** Примитив oxeo: `string`, `literal`, `array<string>`; у embedded — имя класса блока. */
  type?: string
  /** Тип из исходника: `DateISO`, `AppKey.ShiftStage | null`. */
  tsType?: string
  /** Декораторы свойства из исходника: `@Prop({ type: 'string', nullable: true })`. */
  decorators?: string[]
  /** У json-полей — объявления типов из `SchemeModel.types`, на которые ссылается тип поля. */
  typeRefs?: string[]
  nullable?: boolean
  values?: (string | number)[]
  /** Коллекция-цель у связей. */
  target?: string
  onDelete?: OnDelete
  /** У has-many — поле BelongsTo у ребёнка. */
  ownerField?: string
  doc?: string
  fields?: Field[]
}

export interface Variant {
  value: string
  model: string
  doc?: string
  /** Декоратор класса варианта: `@Discriminator(...)`. */
  decorators?: string[]
  fields: Field[]
}

export interface Entity {
  /** Ключ коллекции в реестре `DataScheme`. */
  key: string
  model: string
  /** Файл схемы, где объявлен класс модели: `shifts.ts`. */
  file: string
  /** Namespace класса модели: `ShiftEntities`. */
  namespace?: string
  /** Порядок в реестре коллекций. */
  order: number
  idKey: string
  idType: string
  discriminatorKey?: string
  /** JSDoc класса модели — описание коллекции. */
  doc?: string
  /** Декораторы класса модели: `@Model({ name: 'Shift' })`. */
  decorators?: string[]
  fields: Field[]
  variants: Variant[]
}

export type RelationKind = 'own' | 'ref' | 'set'

export interface Relation {
  id: string
  /** Для композиции — родитель, для ссылок — коллекция с полем-ссылкой. */
  source: string
  target: string
  kind: RelationKind
  /** Поле на стороне source: `legals` у композиции, `projectId` у ссылки. */
  field: string
  /** У композиции — поле BelongsTo у ребёнка: `clientId`. */
  ownerField?: string
  onDelete: OnDelete
  nullable: boolean
  /** Значение дискриминатора, если поле есть только у варианта модели. */
  variant?: string
}

export interface SchemeModel {
  entities: Entity[]
  relations: Relation[]
  /** Файлы схемы в порядке первой коллекции из реестра. */
  files: { file: string; namespace?: string }[]
  /** Текст объявлений типов json-полей по идентификатору. */
  types: Record<string, string>
}
