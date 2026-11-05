import * as assert from 'node:assert/strict'

export const expectParseSuccess = <T>(
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T; error?: Error } },
  value: unknown
): T => {
  const result = schema.safeParse(value)

  assert.equal(result.success, true, result.success ? undefined : result.error?.message)

  if (!result.success) {
    throw result.error
  }

  return result.data as T
}

export const expectParseFailure = (
  schema: { safeParse: (value: unknown) => { success: boolean } },
  value: unknown
) => {
  const result = schema.safeParse(value)

  assert.equal(result.success, false)
}
