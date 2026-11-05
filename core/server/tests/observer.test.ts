import { describe, expect, test } from 'vitest'

import { observeChanges } from '../lib/core/changes-tracker/observer'
import { cases } from './observer/cases'

describe('observeChanges', () => {
  test.each(cases)('$name', ({ test: testCase }) => {
    const prevSource = JSON.stringify(testCase.source)
    const { nextState, dirtyPaths } = observeChanges(testCase.source as any, testCase.mutate as any)

    expect(nextState).toEqual(testCase.expect)

    if (testCase.expectDirtyPaths) {
      expect(dirtyPaths).toEqual(testCase.expectDirtyPaths)
    }

    expect(JSON.stringify(testCase.source)).toBe(prevSource)
  })
})
