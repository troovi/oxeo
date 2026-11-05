/**
 * Метаданные oxeo, которые читает генератор, описанные структурно. Пакет не зависит от `@oxeo/scheme`:
 * подходит `DataScheme` любой совместимой версии, и в проекте не возникает конфликта двух копий её классов.
 */

type Primitive =
  | { type: 'string' | 'number' | 'boolean' | 'json'; nullable?: boolean }
  | { type: 'array'; itemType: 'number' | 'string' | 'json' }
  | { type: 'enum' | 'literal'; values: (string | number)[]; nullable?: boolean }

export interface ModelProperties {
  properties: PropertyMeta[]
  references: RelationMeta[]
}

export interface EmbeddedMeta extends ModelProperties {
  type: 'embedded'
}

export interface PropertyMeta {
  target: Function
  propertyKey: string
  primitive: Primitive | EmbeddedMeta
}

export interface RelationMeta {
  target: Function
  refType: string
  propertyKey: string
  referenceModel: () => Function
}

interface BaseModelScheme extends ModelProperties {
  target: Function
  name: string
  identifier: { propertyKey: string; options: { type: string } }
}

export interface DiscriminatorScheme extends ModelProperties {
  target: Function
  name: string
  value: string
}

export type ModelScheme =
  | (BaseModelScheme & { type: 'base' })
  | (BaseModelScheme & {
      type: 'discriminated'
      discriminatorKey: string
      discriminators: DiscriminatorScheme[]
    })

export type TargetRef =
  | { refType: 'reference-to'; model: string; nullable: boolean }
  | { refType: 'reference-set'; model: string }
  | {
      refType: 'has-many'
      model: string
      cleanupBehavior?: 'cascade' | 'restrict'
      modelBelongsToProperty: string
    }
  | { refType: 'belongs-to'; model: string }
  | { refType: 'owner' | 'owner-fallback'; model: string }

export type TargetRefs = Record<string, TargetRef>

export interface ReferenceScheme {
  commonRefs: TargetRefs
  discriminatorRefs?: Record<string, TargetRefs>
  inverseRefs: {
    model: string
    modelConsumerProperty: string
    onDeleteBehavior: 'restrict' | 'set-null' | 'unlink'
  }[]
}

/** То, что генератору нужно от `DataScheme`: реестр коллекций и разобранные модели. */
export interface SchemeSource {
  collectionsScheme: Record<string, { name: string }>
  models: Record<string, { scheme: ModelScheme; refscheme: ReferenceScheme }>
}
