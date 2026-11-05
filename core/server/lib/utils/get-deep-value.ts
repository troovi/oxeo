import { isObjectLike } from '@companix/utils-js'

export const getGuaranteedValueByAddress = (object: object, address: string): any => {
  let current = object

  for (const segment of address.split('.')) {
    if (isObjectLike(current) && segment in current) {
      current = current[segment as keyof object]
      continue
    }

    throw new Error(`${segment} doesnt exists (address ${address}): ${JSON.stringify(object)}`)
  }

  return current
}

export const getValueAtPath = (value: object, path: string[]): any => {
  let current = value

  for (const segment of path) {
    if (isObjectLike(current) && segment in current) {
      current = current[segment as keyof object]
      continue
    }

    return undefined
  }

  return current
}
