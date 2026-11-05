/**
 * Контракт коллекций — то, что домены видят как `this.collections`. Типы живут здесь, а не рядом с `DataSource`: домены
 * лежат в общем `core` и пишутся без серверных пакетов, реализацию даёт `DataSource` пакета `@oxeo/server`.
 */
import { Where } from '../../filter'
import { ExtractType, Promisify } from '../../utils'
import { CollectionScheme, DiscriminatedMeta } from '../data-scheme'

export type IType = string | number

export interface DriverApiMethods<T = object, I extends IType = IType> {
  get: (id: I) => T | null
  getAll: () => T[]
  findOneBy: (filter: Where<T>) => T | null
  findBy: (filter: Where<T>) => T[]
  existsBy: (filter: Where<T>) => boolean
  exists: (id: I) => boolean
  /** Число записей по фильтру; без фильтра — всех. */
  count: (filter?: Where<T>) => number
}

type DriverApiSync<T = object, I extends IType = IType> = DriverApiMethods<T, I>
type DriverApiAsync<T = object, I extends IType = IType> = Promisify<DriverApiMethods<T, I>>

export type DriverType = 'sync' | 'async'

// prettier-ignore
export type DriverApi<T = object,I extends IType = IType, DT extends DriverType = DriverType> = DT extends 'sync' ? DriverApiSync<T, I> : DriverApiAsync<T, I>

// prettier-ignore
export type CollectionApi<T = object, I extends IType = IType, DT extends DriverType = DriverType> = DriverApi<T, I, DT> & {
  // data changing
  update: (id: I, mutate: (model: T) => void) => Promise<boolean>
  create: (model: T) => Promise<boolean>
  remove: (id: I) => Promise<boolean>
  getExternalRelations: (id: I) => Promise<{ model: string; ids: IType[] }[]>
}

// ─── расширение API для дискриминированных коллекций ───

// все значения дискриминатора (literal union) из объединения вариантов VU по ключу DK
type DiscriminatorValues<VU, DK extends PropertyKey> = VU extends Record<DK, infer V> ? V : never
// конкретный вариант VU, у которого DK === NV
type VariantByValue<VU, DK extends PropertyKey, NV> = VU extends Record<DK, NV> ? VU : never

// prettier-ignore
export type DiscriminatedApi<B, VU, DK extends PropertyKey, I extends IType = IType> = {
  // patch — поля ТОЛЬКО новой формы (всё, что есть у целевого варианта сверх базы B);
  // id и сам дискриминатор задаются отдельно и не входят в патч
  changeDiscriminator: <NV extends DiscriminatorValues<VU, DK>>(
    id: I,
    nextValue: NV,
    patch: Omit<VariantByValue<VU, DK, NV>, keyof B>
  ) => Promise<boolean>
}

// если у коллекции есть discriminated-метаинформация — подмешиваем DiscriminatedApi
// prettier-ignore
type DiscriminatedExtension<C, I extends IType> =
  C extends { discriminated: DiscriminatedMeta<infer B, infer VU, infer DK> }
    ? DiscriminatedApi<B, VU, DK, I>
    : unknown

export type Collections<Scheme extends CollectionScheme, DT extends DriverType = DriverType> = {
  [K in keyof Scheme]: CollectionApi<ExtractType<Scheme[K]['model']>, Scheme[K]['identifierType'], DT> &
    DiscriminatedExtension<Scheme[K], Scheme[K]['identifierType']>
}
