import { Identifier, Model, Ownership, Prop } from '@oxeo/scheme'
import { AppKey } from './keys'

export namespace DictionaryEntities {
  @Model({ name: 'Option' })
  export class Option {
    @Ownership.BelongsTo(() => Dictionary, (dictionary) => dictionary.options)
    dictionary: AppKey.Dictionaries

    @Identifier({ type: 'string' })
    value: string

    @Prop({ type: 'string' })
    title: string
  }

  @Model({ name: 'Dictionary' })
  export class Dictionary {
    @Identifier({ type: 'string' })
    dictionary: AppKey.Dictionaries

    @Prop({ type: 'string' })
    name: string

    @Ownership.HasMany(() => DictionaryEntities.Option, (option) => option.dictionary, {
      cleanupBehavior: 'cascade'
    })
    options: DictionaryEntities.Option['value'][]
  }
}
