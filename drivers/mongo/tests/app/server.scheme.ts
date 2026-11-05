import {
  DataScheme,
  Identifier,
  InferScheme,
  Model,
  Prop,
  defineCollection
} from '@oxeo/scheme'

@Model({ name: 'Settings' })
export class Settings {
  @Identifier({ type: 'string' })
  id: string

  @Prop({ type: 'number' })
  lastNofitReadId: number
}

export const SystemDataScheme = new DataScheme({
  settings: defineCollection(Settings, 'id')
})

export type SystemScheme = InferScheme<typeof SystemDataScheme>
