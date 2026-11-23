/**
 * Доступ к операциям — декоратором над методом домена: `@Allow` — роли актора, `@System` — только система. Декоратор
 * только записывает доступ, проверяет его рантайм при вызове, до тела метода. По тому же реестру `createAccessIndex`
 * отвечает, какие операции доступны ролям, — без рантайма.
 */
import type { RegisteredRole } from '../register'
import type { DomainRoutes, DomainsMap } from './domains.types'
import { paramsOf } from './params'

/** Кто вызывает операцию: роли `@Allow` или только система — `'system'` (`@System`). */
export type OperationAccess = RegisteredRole[] | 'system'

/** Ключ операции `<домен>.<метод>` по реестру доменов. */
// prettier-ignore
export type OperationKey<T extends DomainsMap> = { [D in keyof T & string]: `${D}.${keyof DomainRoutes<T>[D] & string}` }[keyof T & string]

interface AccessRule {
  access: OperationAccess
  /** Текст отказа `@System`; отказ `@Allow` собирается из подписей ролей. */
  message: string
}

/** Доступ операций по прототипу класса: `prototype → метод → доступ` (заполняют декораторы). */
const registry = new WeakMap<object, Map<string, AccessRule>>()

const decorate = (rule: AccessRule) => {
  // prettier-ignore
  return <T extends (params: any, ...rest: any[]) => Promise<unknown>>(target: object, key: string, _descriptor: TypedPropertyDescriptor<T>) => {
    const rules = registry.get(target) ?? new Map<string, AccessRule>()

    registry.set(target, rules.set(key, rule))
  }
}

/** Операция доступна только перечисленным ролям; система проходит. */
export const Allow = (...roles: RegisteredRole[]) => {
  return decorate({ access: roles, message: '' })
}

/** Служебная операция — её вызывает только система; актору — отказ `forbidden` с текстом `message`. */
export const System = (message: string) => {
  return decorate({ access: 'system', message })
}

/** Правило метода с правилами базовых классов: собственное заменяет унаследованное. */
const ruleOf = (prototype: object | null, method: string): AccessRule | null => {
  if (!prototype || prototype === Object.prototype) {
    return null
  }

  return registry.get(prototype)?.get(method) ?? ruleOf(Object.getPrototypeOf(prototype), method)
}

/** Доступ метода класса; `null` — без декоратора, операция открыта любому актору. */
export const accessOf = (Class: Function, method: string) => {
  return ruleOf(Class.prototype, method)?.access ?? null
}

export interface AccessCheck {
  Class: Function
  method: string
  /** Роли актора; `null` — вызывает система. */
  roles: RegisteredRole[] | null
  /** Подпись роли в тексте отказа; по умолчанию — сама роль. */
  labelOf?: (role: RegisteredRole) => string
}

/**
 * Отказ доступа к методу — текст для `forbidden` или `null`, если доступ есть. Система проходит `@Allow`, актор —
 * если у него есть хотя бы одна из ролей; `@System` проходит только система.
 */
export const accessRefusal = ({ Class, method, roles, labelOf }: AccessCheck) => {
  const rule = ruleOf(Class.prototype, method)

  if (!rule) {
    return null
  }

  if (rule.access === 'system') {
    return roles === null ? null : rule.message
  }

  const allowed = rule.access

  if (roles === null || allowed.some((role) => roles.includes(role))) {
    return null
  }

  const labels = allowed.map((role) => (labelOf ? labelOf(role) : role))

  return `Действие доступно только: ${labels.join(', ')}`
}

/**
 * Индекс доступа по реестру доменов — один обход: операция — метод со схемой `@Params`, каждая — в группу по своему
 * декоратору. Индекс не запрещает — запрет остаётся за рантаймом; по нему интерфейс решает, что показать, а сервер — что
 * закрыть для HTTP.
 */
export const createAccessIndex = <T extends DomainsMap>(domains: T) => {
  const open: OperationKey<T>[] = []
  const system: OperationKey<T>[] = []
  const byRole = new Map<RegisteredRole, OperationKey<T>[]>()

  for (const domain in domains) {
    for (const method of paramsOf(domains[domain]).keys()) {
      const operation = `${domain}.${method}` as OperationKey<T>
      const access = accessOf(domains[domain], method)

      if (access === null) {
        open.push(operation)
        continue
      }

      if (access === 'system') {
        system.push(operation)
        continue
      }

      for (const role of access) {
        byRole.set(role, [...(byRole.get(role) ?? []), operation])
      }
    }
  }

  return {
    /** Операции, доступные ролям: открытые и разрешённые хотя бы одной роли; служебных нет. */
    allowed: (roles: RegisteredRole[]) => {
      const operations = new Set(open)

      for (const role of roles) {
        byRole.get(role)?.forEach((operation) => operations.add(operation))
      }

      return [...operations]
    },
    /** Служебные операции (`@System`): их вызывает только система. */
    system: () => {
      return [...system]
    },
    /** Доступ операции: роли, `'system'` или `null` — без декоратора, открыта любому актору. */
    of: (domain: keyof T & string, method: string) => {
      return accessOf(domains[domain], method)
    }
  }
}

export type AccessIndex<T extends DomainsMap> = ReturnType<typeof createAccessIndex<T>>
