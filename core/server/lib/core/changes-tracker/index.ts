import isEqual from 'fast-deep-equal'
import { observeChanges } from './observer'
import { getValueAtPath } from '../../utils'

export const changesTracker = <T extends object>(source: T, mutate: (draft: T) => void) => {
  const { nextState, dirtyPaths } = observeChanges(source, mutate)

  const changedPaths: string[][] = []

  for (const path of dirtyPaths) {
    const prevValue = getValueAtPath(source, path)
    const nextValue = getValueAtPath(nextState, path)

    if (!isEqual(prevValue, nextValue)) {
      changedPaths.push(path)
    }
  }

  return { changedPaths, nextState }
}
