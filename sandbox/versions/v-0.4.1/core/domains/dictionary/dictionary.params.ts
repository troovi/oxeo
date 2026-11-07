import { z } from 'zod'
import { schemaOf } from '../../../lib/scheme'
import { AppKeys } from '../../keys'
import { DictionaryEntities } from '../../scheme'

export namespace DictionaryParams {
  const Option = schemaOf(DictionaryEntities.Option)
  const Title = z.string().nonempty()

  export const EnsureDictionaries = z.object({})

  export const AddOption = Option.pick({ dictionary: true, title: true }).extend({
    dictionary: z.enum(AppKeys.Dictionary),
    title: Title
  })

  export const RenameOption = Option.pick({ value: true }).extend({ title: Title })
  export const RemoveOption = Option.pick({ value: true })
}
