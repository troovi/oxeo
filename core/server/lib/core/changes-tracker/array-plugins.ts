/**
 * Methods that directly modify the array in place.
 * These operate on the copy without creating per-element proxies:
 * - `push`, `pop`: Add/remove from end
 * - `shift`, `unshift`: Add/remove from start (marks all indices reassigned)
 * - `splice`: Add/remove at arbitrary position (marks all indices reassigned)
 * - `reverse`, `sort`: Reorder elements (marks all indices reassigned)
 */
type MutatingArrayMethod = 'push' | 'pop' | 'shift' | 'unshift' | 'splice' | 'reverse' | 'sort'

/**
 * Methods that read from the array without modifying it.
 * These fall into distinct categories based on return semantics:
 *
 * **Subset operations** (return drafts - mutations propagate):
 * - `filter`, `slice`: Return array of draft proxies
 * - `find`, `findLast`: Return single draft proxy or undefined
 *
 * **Transform operations** (return base values - mutations don't track):
 * - `concat`, `flat`: Create new structures, not subsets of original
 *
 * **Primitive-returning** (no draft needed):
 * - `findIndex`, `findLastIndex`, `indexOf`, `lastIndexOf`: Return numbers
 * - `some`, `every`, `includes`: Return booleans
 * - `join`, `toString`, `toLocaleString`: Return strings
 */
type NonMutatingArrayMethod =
  | 'filter'
  | 'slice'
  | 'concat'
  | 'flat'
  | 'find'
  | 'findIndex'
  | 'findLast'
  | 'findLastIndex'
  | 'some'
  | 'every'
  | 'indexOf'
  | 'lastIndexOf'
  | 'includes'
  | 'join'
  | 'toString'
  | 'toLocaleString'

/** Union of all array operation methods handled by the plugin. */
export type ArrayOperationMethod = MutatingArrayMethod | NonMutatingArrayMethod

/**
 * Enables optimized array method handling for Immer drafts.
 *
 * This plugin overrides array methods to avoid unnecessary Proxy creation during iteration,
 * significantly improving performance for array-heavy operations.
 *
 * **Mutating methods** (push, pop, shift, unshift, splice, sort, reverse):
 * Operate directly on the copy without creating per-element proxies.
 *
 * **Non-mutating methods** fall into categories:
 * - **Subset operations** (filter, slice, find, findLast): Return draft proxies - mutations track
 * - **Transform operations** (concat, flat): Return base values - mutations don't track
 * - **Primitive-returning** (indexOf, includes, some, every, etc.): Return primitives
 *
 * **Important**: Callbacks for overridden methods receive base values, not drafts.
 * This is the core performance optimization.
 *
 * @example
 * ```ts
 * import { enableArrayMethods, produce } from "immer"
 *
 * enableArrayMethods()
 *
 * const next = produce(state, draft => {
 *   // Optimized - no proxy creation per element
 *   draft.items.sort((a, b) => a.value - b.value)
 *
 *   // filter returns drafts - mutations propagate
 *   const filtered = draft.items.filter(x => x.value > 5)
 *   filtered[0].value = 999 // Affects draft.items[originalIndex]
 * })
 * ```
 *
 * @see https://immerjs.github.io/immer/array-methods
 */
const SHIFTING_METHODS = new Set<MutatingArrayMethod>(['shift', 'unshift'])

const QUEUE_METHODS = new Set<MutatingArrayMethod>(['push', 'pop'])

const RESULT_RETURNING_METHODS = new Set<MutatingArrayMethod>([...QUEUE_METHODS, ...SHIFTING_METHODS])

const REORDERING_METHODS = new Set<MutatingArrayMethod>(['reverse', 'sort'])

// Optimized method detection using array-based lookup
const MUTATING_METHODS = new Set<MutatingArrayMethod>([
  ...RESULT_RETURNING_METHODS,
  ...REORDERING_METHODS,
  'splice'
])

const FIND_METHODS = new Set<NonMutatingArrayMethod>(['find', 'findLast'])

const NON_MUTATING_METHODS = new Set<NonMutatingArrayMethod>([
  'filter',
  'slice',
  'concat',
  'flat',
  ...FIND_METHODS,
  'findIndex',
  'findLastIndex',
  'some',
  'every',
  'indexOf',
  'lastIndexOf',
  'includes',
  'join',
  'toString',
  'toLocaleString'
])

// Type guard for method detection
export const isMutatingArrayMethod = (method: string): method is MutatingArrayMethod => {
  return MUTATING_METHODS.has(method as any)
}

export const isNonMutatingArrayMethod = (method: string): method is NonMutatingArrayMethod => {
  return NON_MUTATING_METHODS.has(method as any)
}

export const isArrayOperationMethod = (method: string): method is ArrayOperationMethod => {
  return isMutatingArrayMethod(method) || isNonMutatingArrayMethod(method)
}
