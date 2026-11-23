/**
 * Схемы параметров операций и представлений — декоратор `@Params` на методе. Рантайм проверяет схемой каждый вызов, а
 * методы со схемой — список публичных операций: вызов метода без схемы — неизвестная операция.
 */
import type { z } from 'zod'

export type ParamsSchema<P = unknown> = z.ZodType<P>

/** Схемы по прототипу класса: метод → схема. */
const registry = new WeakMap<object, Map<string, ParamsSchema>>()

/**
 * Схема параметров метода операции или представления. Результат схемы должен подходить первому параметру метода, иначе
 * декоратор не компилируется; контекст вторым параметром необязателен.
 *
 * ```ts
 * @Params(NotesParams.Add)
 * async add(params: z.infer<typeof NotesParams.Add>, ctx: DomainContext) {
 * ```
 */
export const Params = <S extends z.ZodType>(schema: S) => {
  return <T extends (params: z.infer<S>, ...rest: any[]) => Promise<unknown>>(
    target: object,
    key: string,
    descriptor: TypedPropertyDescriptor<T>
  ) => {
    const schemas = registry.get(target) ?? new Map<string, ParamsSchema>()

    registry.set(target, schemas.set(key, schema))
  }
}

/** Схемы прототипа и его предков: собственная схема метода заменяет унаследованную. */
const schemasOf = (prototype: object | null): Map<string, ParamsSchema> => {
  if (!prototype || prototype === Object.prototype) {
    return new Map()
  }

  const inherited = schemasOf(Object.getPrototypeOf(prototype))
  const own = registry.get(prototype) ?? []

  return new Map([...inherited, ...own])
}

/**
 * Схемы методов класса операций или представлений: метод → схема, с методами базовых классов. Метода без `@Params` в
 * карте нет. Карта новая на каждый вызов.
 */
export const paramsOf = (Class: Function) => {
  return schemasOf(Class.prototype)
}
