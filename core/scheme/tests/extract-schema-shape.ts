import { z } from 'zod'

export type ExtractedLeaf = 'string' | 'number' | 'boolean' | 'any'

export interface ExtractedNullableField {
  nullable: ExtractedSchemaField
}

export interface ExtractedArrayField {
  arrayOf: ExtractedSchemaField
}

export interface ExtractedEnumField {
  enum: Array<string | number>
}

export interface ExtractedSchemaShape {
  [key: string]: ExtractedSchemaField
}

export type ExtractedSchemaField =
  | ExtractedLeaf
  | ExtractedNullableField
  | ExtractedArrayField
  | ExtractedEnumField
  | ExtractedSchemaShape

const isZodObject = (schema: z.ZodTypeAny): schema is z.ZodObject<any> => {
  return schema instanceof z.ZodObject
}

export const extractSchemaField = (schema: z.ZodTypeAny): ExtractedSchemaField => {
  if (schema instanceof z.ZodNullable) {
    return {
      nullable: extractSchemaField(schema.unwrap() as z.ZodTypeAny)
    }
  }

  if (schema instanceof z.ZodString) {
    return 'string'
  }

  if (schema instanceof z.ZodNumber) {
    return 'number'
  }

  if (schema instanceof z.ZodBoolean) {
    return 'boolean'
  }

  if (schema instanceof z.ZodAny) {
    return 'any'
  }

  if (schema instanceof z.ZodEnum) {
    return {
      enum: [...schema.options]
    }
  }

  if (schema instanceof z.ZodArray) {
    return {
      arrayOf: extractSchemaField(schema.element as z.ZodTypeAny)
    }
  }

  if (isZodObject(schema)) {
    return extractSchemaShape(schema)
  }

  throw new Error(`Unsupported Zod schema node: ${(schema as any).constructor.name}`)
}

export const extractSchemaShape = (schema: z.ZodObject<any>): ExtractedSchemaShape => {
  return Object.fromEntries(
    Object.entries(schema.shape).map(([key, value]) => [key, extractSchemaField(value as z.ZodTypeAny)])
  )
}
