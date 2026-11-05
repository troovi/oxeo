import { isArrayOperationMethod } from './array-plugins'
import { isDraftable, isObjectLike } from '@companix/utils-js'

interface DraftState {
  base: object
  isArray: boolean
  copy: object | null
  parent: DraftState | null
  key: string | null
  path: string[]
  proxy: object | null
  active: boolean
  children: Map<string, DraftState>
}

const isAncestorPath = (ancestor: string[], target: string[]) => {
  if (ancestor.length > target.length) {
    return false
  }

  return ancestor.every((segment, index) => segment === target[index])
}

const shallowCopy = <T extends object>(value: T): T => {
  if (Array.isArray(value)) {
    return value.slice() as T
  }

  return { ...(value as Record<string, unknown>) } as T
}

const latest = (state: DraftState) => state.copy ?? state.base

const prepareCopy = (state: DraftState): object => {
  if (state.copy) {
    return state.copy
  }

  state.copy = shallowCopy(state.base)

  if (state.parent && state.key !== null) {
    const parentCopy = prepareCopy(state.parent)
    Reflect.set(parentCopy, String(state.key), state.copy)
  }

  return state.copy
}

const createState = (base: object, parent: DraftState | null, key: string | null): DraftState => {
  return {
    base,
    isArray: Array.isArray(base),
    copy: null,
    parent,
    key,
    path: parent && key != null ? [...parent.path, key] : [],
    proxy: null,
    active: true,
    children: new Map()
  }
}

const revokeSubtree = (state: DraftState) => {
  state.active = false

  for (const child of state.children.values()) {
    revokeSubtree(child)
  }

  state.children.clear()
}

const unlinkChild = (state: DraftState, segment: string) => {
  const child = state.children.get(segment)

  if (child) {
    revokeSubtree(child)
    state.children.delete(segment)
  }
}

export const observeChanges = <T extends object>(source: T, mutate: (draft: T) => void) => {
  const dirtyPaths = new Map<string, string[]>()
  const proxyStates = new WeakMap<object, DraftState>()

  const markDirty = (path: string[]) => {
    for (const existingPath of dirtyPaths.values()) {
      if (isAncestorPath(existingPath, path)) return
    }

    for (const [key, existingPath] of Array.from(dirtyPaths.entries())) {
      if (isAncestorPath(path, existingPath)) {
        dirtyPaths.delete(key)
      }
    }

    dirtyPaths.set(JSON.stringify(path), path)
  }

  const unwrapValue = <V>(value: V): V => {
    if (!isObjectLike(value)) {
      return value
    }

    const state = proxyStates.get(value)

    if (state) {
      return latest(state) as V
    }

    return value
  }

  const createProxy = <V extends object>(state: DraftState): V => {
    if (state.proxy) {
      return state.proxy as V
    }

    const proxy = new Proxy(state.base, {
      get(_target, property) {
        const currentTarget = latest(state)
        const value = Reflect.get(currentTarget, property)

        // в случае выполнений операций над массивом, нужно создать копию
        if (state.isArray && typeof property === 'string') {
          if (isArrayOperationMethod(property)) {
            return (...args: unknown[]) => {
              markDirty(state.path)

              for (const child of state.children.values()) {
                revokeSubtree(child)
              }

              state.children.clear()

              const copy = prepareCopy(state)

              return Reflect.apply(Reflect.get(copy, property), copy, args.map(unwrapValue))
            }
          }
        }

        if (isDraftable(value)) {
          // возможно в случае symbol (просто возвращаем значение)
          if (typeof property === 'symbol') {
            return value
          }

          // новая ветка (создаем прокси и state)
          const current = state.children.get(property)

          if (current && current.active && latest(current) === value) {
            return createProxy(current)
          }

          const child = createState(value, state, property)
          state.children.set(property, child)

          return createProxy(child)
        }

        return value
      },
      set(_target, property, value) {
        const currentTarget = latest(state)
        const previousValue = Reflect.get(currentTarget, property)
        const nextValue = unwrapValue(value)

        if (typeof property !== 'symbol') {
          if (isDraftable(previousValue)) {
            unlinkChild(state, property)
          }

          markDirty([...state.path, property])
        }

        // совершаем изменения на копии
        return Reflect.set(prepareCopy(state), property, nextValue)
      },
      deleteProperty(_target, property) {
        const currentTarget = latest(state)
        const existing = Reflect.has(currentTarget, property)

        if (typeof property == 'symbol') {
          return Reflect.deleteProperty(prepareCopy(state), property)
        }

        unlinkChild(state, property)

        const isDeleted = Reflect.deleteProperty(prepareCopy(state), property)

        if (isDeleted && existing) {
          markDirty([...state.path, property])
        }

        return isDeleted
      },
      has(_target, property) {
        return Reflect.has(latest(state), property)
      },
      ownKeys() {
        return Reflect.ownKeys(latest(state))
      },
      getOwnPropertyDescriptor(_target, property) {
        return Reflect.getOwnPropertyDescriptor(latest(state), property)
      },
      getPrototypeOf() {
        return Reflect.getPrototypeOf(latest(state))
      }
    })

    state.proxy = proxy
    proxyStates.set(proxy, state)

    return proxy as V
  }

  const rootState = createState(source, null, null)
  const draft = createProxy<T>(rootState)

  mutate(draft)

  const nextState = latest(rootState)

  return { nextState: nextState as T, dirtyPaths: Array.from(dirtyPaths.values()) }
}
