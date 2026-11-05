// import * as JSONPatcherProxyModule from 'jsonpatcherproxy'
// import { ChangeType, Observable } from '@gullerya/object-observer'
// import { generate, observe, type Operation } from 'fast-json-patch'
// import { enablePatches, produceWithPatches, type Patch } from 'immer'
// import { changesTracker } from '../../src/core/changes-tracker'

// export interface ChangeEvent {
//   type: ChangeType
//   path: string[]
//   value?: any
// }

// const JSONPatcherProxy = (
//   'JSONPatcherProxy' in JSONPatcherProxyModule
//     ? JSONPatcherProxyModule.JSONPatcherProxy
//     : JSONPatcherProxyModule.default
// ) as typeof import('jsonpatcherproxy').default

// const toPlain = (value: any): any => {
//   if (value == null || typeof value !== 'object') return value
//   return JSON.parse(JSON.stringify(value))
// }

// enablePatches()

// export const Patchers = {
//   JSONPatcher: <T>(data: T, mutate: (data: T) => void) => {
//     const observer = new JSONPatcherProxy(data)
//     const observed = observer.observe(true) // true = record patches

//     mutate(observed)

//     return observer.generate()
//   },
//   FastJsonPatch: <T>(data: T, mutate: (data: T) => void): Operation[] => {
//     const draft = toPlain(data)
//     const observer = observe(draft as object) as Parameters<typeof generate>[0]

//     mutate(draft)

//     return generate(observer)
//   },
//   Gullerya: <T>(data: T, mutate: (data: T) => void) => {
//     const draft = Observable.from(data)

//     const changes: ChangeEvent[] = []

//     Observable.observe(draft, (list) => {
//       list.forEach((change) => {
//         changes.push({ type: change.type, path: change.path, value: toPlain(change.value) })
//       })
//     })

//     mutate(draft)
//     Observable.unobserve(draft)

//     return changes
//   },
//   Immer: <T>(data: T, mutate: (data: T) => void): Patch[] => {
//     const [, patches] = produceWithPatches(data, (draft) => {
//       mutate(draft as T)
//     })

//     return patches
//   },
//   Internal: <T extends object>(data: T, mutate: (data: T) => void) => {
//     return changesTracker(data, mutate)
//   }
// }
