/**
 * Контейнер рантайма: собирает домены, представления и их сервисы по типам параметров конструктора. Типы пишет
 * TypeScript в `design:paramtypes` при `emitDecoratorMetadata` — над классом с декоратором роли из `@oxeo/scheme/di`
 * (`@Domain()`, `@Service()`, `@View()`). Область держит по одному экземпляру класса; значения по токенам — коллекции и
 * выдачу идентификаторов — кладёт в неё рантайм. Роли задают правила графа: домен и представление — только корни,
 * сервис зависит только от сервисов и токенов.
 */
import 'reflect-metadata'
import { roleOf } from '@oxeo/scheme/di'

/** Класс, в том числе абстрактный: токен значения или собираемый класс. */
export type Token<T = unknown> = abstract new (...args: any[]) => T

/** Класс не собрать: текст называет цепочку зависимостей от класса, с которого начиналась сборка. */
export class InjectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InjectionError'
  }
}

export interface ScopeOptions {
  /** Где собирает область — для текста ошибок: `в представлении`. */
  where: string
  /** Значения по токенам. */
  values: Map<Token, unknown>
}

/** Типы, которые TypeScript пишет за примитивы, массивы и функции: класса за ними нет. */
const BUILTINS = new Set<unknown>([String, Number, Boolean, Symbol, BigInt, Array, Function, Promise])

/** Зависимости класса — проверенные типы параметров конструктора: одни для всех областей. */
const dependencies = new WeakMap<Token, Token[]>()

const nameOf = (Class: Token) => {
  return Class.name || 'анонимный класс'
}

const chainOf = (path: Token[]) => {
  return path.map(nameOf).join(' → ')
}

/**
 * Типы параметров конструктора. Свои — у класса с декоратором роли; у наследника без своего конструктора (у него нет
 * параметров) — типы базового класса. Класс с параметрами без роли и параметр без класса за типом — ошибки: подставить
 * нечего.
 */
const dependenciesOf = (Class: Token, path: Token[]) => {
  const cached = dependencies.get(Class)

  if (cached) {
    return cached
  }

  const own: unknown[] | undefined = Reflect.getOwnMetadata('design:paramtypes', Class)
  const subject = chainOf(path)

  if (Class.length > 0 && !roleOf(Class)) {
    throw new InjectionError(`${subject}: класс с параметрами без роли — нужен @Service()`)
  }

  if (Class.length > 0 && !own) {
    const hint = `нужны emitDecoratorMetadata и полифил reflect-metadata до объявления класса`

    throw new InjectionError(`${subject}: нет типов параметров конструктора — ${hint}`)
  }

  const types: unknown[] = own ?? Reflect.getMetadata('design:paramtypes', Class) ?? []

  types.forEach((type, i) => {
    const parameter = `${subject}: параметр ${i + 1}`

    if (type === undefined || type === Object) {
      throw new InjectionError(`${parameter} — не класс: import type, интерфейс или цикл импортов`)
    }

    if (BUILTINS.has(type)) {
      throw new InjectionError(`${parameter} — ${nameOf(type as Token)}, а не класс`)
    }
  })

  dependencies.set(Class, types as Token[])
  return types as Token[]
}

/**
 * Область контейнера: значения по токенам и по одному экземпляру каждого собранного класса. Дочерняя область
 * экземпляров родителя не видит и собирает свои; токен родителя, которому дочерняя не дала значения, в ней — ошибка,
 * а не пустой экземпляр абстрактного класса.
 */
export class Container {
  private instances: Map<Token, unknown>
  /** Токены внешних областей, которых в этой нет. */
  private absent: Set<Token>

  constructor(
    private scope: ScopeOptions,
    parent: Container | null = null
  ) {
    const inherited = parent ? [...parent.scope.values.keys(), ...parent.absent] : []

    this.instances = new Map(scope.values)
    this.absent = new Set(inherited.filter((token) => !scope.values.has(token)))
  }

  /** Экземпляр класса в области: собирается при первом обращении вместе с зависимостями. */
  get<T>(Class: Token<T>) {
    return this.resolve(Class, []) as T
  }

  /** Дочерняя область со своими значениями по токенам. */
  child(scope: ScopeOptions) {
    return new Container(scope, this)
  }

  private resolve(Class: Token, chain: Token[]): unknown {
    if (this.instances.has(Class)) {
      return this.instances.get(Class)
    }

    if (this.absent.has(Class)) {
      const requester = chain.length > 0 ? `: ${chainOf(chain)}` : ''

      throw new InjectionError(`${nameOf(Class)} нет ${this.scope.where}${requester}`)
    }

    if (chain.includes(Class)) {
      const cycle = [...chain.slice(chain.indexOf(Class)), Class]

      throw new InjectionError(`цикл зависимостей: ${chainOf(cycle)}`)
    }

    const path = [...chain, Class]

    this.assertEdge(Class, path)

    const args = dependenciesOf(Class, path).map((dependency) => this.resolve(dependency, path))
    const instance = new (Class as new (...args: unknown[]) => unknown)(...args)

    this.instances.set(Class, instance)
    return instance
  }

  /**
   * Правила ролей для зависимости: домен и представление — только корни графа, параметром их не внедряют; сервис
   * зависит только от сервисов и токенов.
   */
  private assertEdge(Class: Token, path: Token[]) {
    const role = roleOf(Class)
    const isRoot = role === 'domain' || role === 'view'

    if (path.length < 2 || !isRoot) {
      return
    }

    if (roleOf(path[path.length - 2]) === 'service') {
      const rule = `сервис зависит только от сервисов, Collections и Ids — не от домена и не от представления`

      throw new InjectionError(`${chainOf(path)}: ${rule}`)
    }

    const subject = role === 'domain' ? 'домен' : 'представление'
    const rule = `${subject} — корень графа, параметром конструктора не внедряется`

    throw new InjectionError(`${chainOf(path)}: ${rule}`)
  }
}
