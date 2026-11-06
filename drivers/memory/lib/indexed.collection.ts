import { isObjectLike } from '@companix/utils-js'
import { CollectionInfo, IType, KeyOfType, matches } from '@oxeo/scheme'
import { UpdatePatch, __DEV__, styles, xRay } from '@oxeo/server'

export class IndexedCollectionStore<T> {
  private name: string
  private store: { [id: IType]: T } = {}
  private data: T[] = []

  private identifierKey: KeyOfType<T, IType>

  constructor(info: CollectionInfo<T>) {
    this.name = info.name
    this.identifierKey = info.identifierKey
  }

  get(id: IType) {
    return this.store[id] ?? null
  }

  getAll() {
    return this.data
  }

  create(data: T) {
    if (__DEV__) {
      xRay.print('COLLECTIONS:CREATE', styles.pink)({ name: this.name }, 'data:', data)
    }

    this.data.push(data)
    this.store[data[this.identifierKey] as IType] = data
  }

  remove(id: IType) {
    if (__DEV__) {
      xRay.print('COLLECTIONS:REMOVE', styles.pink)({ name: this.name, id })
    }

    const index = this.data.findIndex((item) => {
      return item[this.identifierKey] === id
    })

    if (index !== -1) {
      this.data.splice(index, 1)
      delete this.store[id]
    }
  }

  // полная замена документа по id (id остаётся прежним) — нужна при смене дискриминатора,
  // чтобы выкинуть скалярные поля старой формы (set-патчи это не умеют)
  replace(id: IType, data: T) {
    if (__DEV__) {
      xRay.print('COLLECTIONS:REPLACE', styles.pink)({ name: this.name, id }, 'data:', data)
    }

    const index = this.data.findIndex((item) => {
      return item[this.identifierKey] === id
    })

    if (index !== -1) {
      this.data[index] = data
      this.store[id] = data
    }
  }

  update(id: IType, patches: UpdatePatch[]) {
    const target = this.get(id)

    if (target) {
      for (const { address, ...action } of patches) {
        if (action.type === 'set') {
          this.apply(target, address, (source, key) => {
            source[key] = action.value as never
          })
        }

        if (action.type === 'push') {
          this.apply(target, address, (source, key) => {
            ;(source[key] as Array<unknown>).push(...action.items)
          })
        }

        if (action.type === 'pull') {
          this.apply(target, address, (source, key) => {
            const items = source[key] as Array<unknown>

            action.items.forEach((item) => {
              const index = items.findIndex((i) => i === item)

              if (index !== -1) {
                items.splice(index, 1)
              }
            })
          })
        }
      }
    }

    if (__DEV__) {
      xRay.print('COLLECTIONS:UPDATE', styles.pink)({ id }, 'patches:', patches, 'result:', target)
    }
  }

  exists(id: IType) {
    return this.store[id] !== undefined
  }

  existsBy(filter: object = {}) {
    return this.data.some((item) => matches(item, filter))
  }

  findOneBy(filter: object = {}) {
    return this.data.find((item) => matches(item, filter)) ?? null
  }

  findBy(filter: object = {}) {
    return this.data.filter((item) => matches(item, filter))
  }

  count(filter: object = {}) {
    return this.data.filter((item) => matches(item, filter)).length
  }

  private apply(target: object, address: string, change: (source: object, key: keyof object) => void) {
    const path = address.split('.')

    let current = target

    const getException = (segment: string, content: string) => {
      return `[internal]: segment "${segment}" in address "${address}", does not belongs to "${content}"`
    }

    path.forEach((segment, i) => {
      if (path.length - 1 === i) {
        if (isObjectLike(current) && segment in current) {
          change(current, segment as keyof object)
        } else {
          throw new Error(getException(segment, JSON.stringify(current)))
        }
      } else {
        if (isObjectLike(current) && segment in current) {
          current = current[segment as keyof object]
        } else {
          throw new Error(getException(segment, JSON.stringify(current)))
        }
      }
    })
  }
}
