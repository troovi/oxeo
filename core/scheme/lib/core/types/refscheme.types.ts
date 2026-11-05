export namespace RefsTypes {
  // @ReferenceSet

  export interface ReferenceSet {
    refType: 'reference-set'
    model: string
    tableName: string
    cascadeCleanup: boolean
  }

  export interface ReferenceSetInverse {
    refType: 'reference-set'
    model: string
    modelConsumerProperty: string // поле для обращения при unlink зачистке
    onDeleteBehavior: 'unlink' | 'restrict'
    tableName: string
  }

  // @ReferenceTo

  export interface ReferenceTo {
    refType: 'reference-to'
    model: string
    tableName: string // все что произойдет при удалении, это очистка связи в таблице
    nullable: boolean
  }

  export interface ReferenceToInverse {
    refType: 'reference-to'
    model: string
    modelConsumerProperty: string // поле для обращения при set-null зачистке
    onDeleteBehavior: 'set-null' | 'restrict' // означает, что мы не можем удалить project, если есть хотя бы один shift который его использует
    tableName: string
  }

  // @HasMany

  export interface HasMany {
    model: string
    refType: 'has-many'
    modelDiscriminatorValue: string | null // ссылка modelHasManyProperty может быть на дискриминированную модель
    modelBelongsToProperty: string
    cleanupBehavior?: 'cascade' | 'restrict'
  }

  // @BelongsTo

  export interface BelongsTo {
    model: string
    refType: 'belongs-to'
    modelDiscriminatorValue: string | null // ссылка modelHasManyProperty может быть на дискриминированную модель
    modelHasManyProperty: string
  }

  // @Owner

  export interface Owner {
    model: string
    refType: 'owner'
  }

  export interface OwnerFallback {
    model: string
    refType: 'owner-fallback'
  }
}

// prettier-ignore
export type TargetRefsTypes = RefsTypes.ReferenceSet | RefsTypes.ReferenceTo | RefsTypes.HasMany | RefsTypes.BelongsTo | RefsTypes.Owner | RefsTypes.OwnerFallback
export type InverseRefsTypes = RefsTypes.ReferenceSetInverse | RefsTypes.ReferenceToInverse

export interface TargetReferencesStore {
  [address: string]: TargetRefsTypes
}

// карта связей, подробнее на how-it-works.ts
export interface ReferenceScheme {
  commonRefs: TargetReferencesStore
  discriminatorRefs?: {
    [discriminator: string]: TargetReferencesStore
  }
  inverseRefs: InverseRefsTypes[]
}

/** Таблица связей, которую схема вывела из `ReferenceTo` и `ReferenceSet`; хранят её драйверы. */
export interface RelationsTableInfo {
  tableName: string
  rules: { m1: string; m2: string }
}
