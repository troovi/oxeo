/** Выдача идентификаторов на сервере: строки — `hash()`, номера — счётчиками коллекции. */
import { hash } from '@companix/utils-js'
import type { IdSource } from '@oxeo/scheme'

export interface CounterRecord<Source extends string = string> {
  source: Source
  /** Последний выданный номер. */
  seq: number
}

/** Коллекция счётчиков числовых идентификаторов с идентификатором `source` — подходит коллекция oxeo. */
export interface CounterCollection<Source extends string = string> {
  exists(source: Source): boolean | Promise<boolean>
  create(record: CounterRecord<Source>): Promise<boolean>
  update(source: Source, mutate: (draft: CounterRecord<Source>) => void): Promise<boolean>
}

/** Ключи коллекций, подходящих как счётчик числовых идентификаторов `{ source, seq }`. */
export type CounterKey<C> = { [K in keyof C]: C[K] extends CounterCollection<any> ? K : never }[keyof C]

/** Выдача идентификаторов сервера: строки — `hash()`, номера — счётчиками коллекции `counter`. */
export const createIdSource = <Source extends string>(counter: CounterCollection<Source>) => {
  const ids: IdSource<Source> = {
    string: () => {
      return hash()
    },
    number: async (source) => {
      const issued = { seq: 0 }

      if (!(await counter.exists(source))) {
        await counter.create({ source, seq: 0 })
      }

      await counter.update(source, (draft) => {
        draft.seq += 1
        issued.seq = draft.seq
      })

      return issued.seq
    }
  }

  return ids
}
