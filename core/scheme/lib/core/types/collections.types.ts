/**
 * Контракт коллекций — то, что домены видят как `this.collections`. Типы живут здесь, а не рядом с `DataSource`: домены
 * лежат в общем `core` и пишутся без серверных пакетов, реализацию даёт `DataSource` пакета `@oxeo/server`.
 */
import { FindOptions, Where } from '../../filter'
import { ExtractType } from '../../utils'
import { CollectionScheme, DiscriminatedMeta } from '../data-scheme'

export type IType = string | number

export interface CollectionApi<T = object, I extends IType = IType> {
  get: (id: I) => Promise<T | null>
  getAll: () => Promise<T[]>
  findOneBy: (filter: Where<T>) => Promise<T | null>
  /** Записи по фильтру; опции — порядок и предел. */
  findBy: (filter: Where<T>, opts?: FindOptions<T>) => Promise<T[]>
  existsBy: (filter: Where<T>) => Promise<boolean>
  exists: (id: I) => Promise<boolean>
  /** Число записей по фильтру; без фильтра — всех. */
  count: (filter?: Where<T>) => Promise<number>
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

export type Collections<Scheme extends CollectionScheme> = {
  [K in keyof Scheme]: CollectionApi<ExtractType<Scheme[K]['model']>, Scheme[K]['identifierType']> &
    DiscriminatedExtension<Scheme[K], Scheme[K]['identifierType']>
}
