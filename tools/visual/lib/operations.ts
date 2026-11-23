/**
 * Операции проекта для страницы «Операции» и таблицы README: домены реестра, их операции (методы со схемой `@Params`),
 * описания, доступ по декораторам `@Allow` и `@System` и схема параметров текстом. Реестры и подписи даёт конфиг, а
 * `@oxeo/scheme` и `zod` берутся из проекта — реестры `@Params` и доступа живут в его экземпляре пакета.
 */
import { createRequire } from 'module'

/** Операция глазами человека — как `OperationDescription` в `@oxeo/scheme`. */
export interface OperationText {
  title: string
  description: string
}

/** Что страница операций берёт из проекта. */
export interface OperationsConfig {
  /** Реестр доменов (`appDomains`): ключ — имя в маршруте, значение — класс. */
  domains: Record<string, Function>
  /** Описания доменов и операций (`DomainsDescriptions` из `@oxeo/scheme`). */
  descriptions: Record<string, OperationText & { methods: Record<string, OperationText> }>
  /** Подпись роли в колонке «Кто»; по умолчанию — сама роль. */
  labelOf?: (role: string) => string
  /** README, куда `oxeo-visual ops-map` пишет таблицу между маркерами; путь от папки конфига. */
  readme?: string
}

export interface OperationRow {
  domain: string
  method: string
  title: string
  description: string
  /** Кто вызывает: подписи ролей, «система» или «любой». */
  callers: string
  isSystem: boolean
  /** Схема параметров текстом в виде типа TypeScript. */
  params: string
}

export interface DomainSection extends OperationText {
  key: string
  operations: OperationRow[]
}

export interface OperationsModel {
  domains: DomainSection[]
  operations: number
  system: number
}

interface SchemeApi {
  paramsOf: (Class: Function) => Map<string, unknown>
  accessOf: (Class: Function, method: string) => string[] | 'system' | null
}

interface JsonSchema {
  type?: string | string[]
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  anyOf?: JsonSchema[]
  oneOf?: JsonSchema[]
  enum?: unknown[]
  const?: unknown
  additionalProperties?: JsonSchema | boolean
}

const INDENT = '  '

/** JSON Schema параметров — текстом типа TypeScript: объекты построчно, остальное в строку. */
const typeOf = (schema: JsonSchema, depth: number): string => {
  if (schema.const !== undefined) {
    return JSON.stringify(schema.const)
  }

  if (schema.enum) {
    return schema.enum.map((value) => JSON.stringify(value)).join(' | ')
  }

  const variants = schema.anyOf ?? schema.oneOf

  if (variants) {
    return variants.map((variant) => typeOf(variant, depth)).join(' | ')
  }

  if (Array.isArray(schema.type)) {
    return schema.type.map((type) => typeOf({ ...schema, type }, depth)).join(' | ')
  }

  if (schema.type === 'array') {
    const item = schema.items ? typeOf(schema.items, depth) : 'unknown'

    return item.includes(' ') ? `(${item})[]` : `${item}[]`
  }

  if (schema.type === 'object' || schema.properties) {
    const properties = Object.entries(schema.properties ?? {})

    if (properties.length === 0) {
      const values =
        typeof schema.additionalProperties === 'object' ? schema.additionalProperties : null

      return values ? `Record<string, ${typeOf(values, depth)}>` : '{}'
    }

    const required = new Set(schema.required ?? [])
    const pad = INDENT.repeat(depth + 1)
    const lines = properties.map(([key, value]) => {
      return `${pad}${key}${required.has(key) ? '' : '?'}: ${typeOf(value, depth + 1)}`
    })

    return `{\n${lines.join('\n')}\n${INDENT.repeat(depth)}}`
  }

  if (schema.type === 'integer') {
    return 'number'
  }

  return schema.type ?? 'unknown'
}

/**
 * Модель операций по конфигу: порядок доменов — как в реестре, операций — как в классе. Схему параметров переводит в
 * JSON Schema `zod` проекта; если он не умеет — строка «—».
 */
export const extractOperations = (config: OperationsConfig, configPath: string): OperationsModel => {
  const projectRequire = createRequire(configPath)
  const scheme = projectRequire('@oxeo/scheme') as Partial<SchemeApi>
  const zod = projectRequire('zod') as { toJSONSchema?: (schema: unknown, opts: object) => JsonSchema }

  if (!scheme.paramsOf || !scheme.accessOf) {
    throw new Error('страница операций требует @oxeo/scheme 0.6 и новее: нет paramsOf и accessOf')
  }

  const { paramsOf, accessOf } = scheme as SchemeApi
  const labelOf = config.labelOf ?? ((role: string) => role)

  /** Кто вызывает операцию: подписи ролей `@Allow`, система или любой актор. */
  const callersOf = (access: string[] | 'system' | null) => {
    if (access === null) return 'любой'
    if (access === 'system') return 'система'
    return access.map(labelOf).join(', ')
  }

  const paramsText = (schema: unknown) => {
    try {
      const json = zod.toJSONSchema?.(schema, { unrepresentable: 'any', io: 'input' })

      return json ? typeOf(json, 0) : '—'
    } catch {
      return '—'
    }
  }

  const domains = Object.entries(config.domains).map(([key, Class]) => {
    const description = config.descriptions[key]
    const operations = [...paramsOf(Class)].map(([method, schema]) => {
      const access = accessOf(Class, method)
      const text = description?.methods[method]

      return {
        domain: key,
        method,
        title: text?.title ?? '',
        description: text?.description ?? '',
        callers: callersOf(access),
        isSystem: access === 'system',
        params: paramsText(schema)
      }
    })

    return {
      key,
      title: description?.title ?? key,
      description: description?.description ?? '',
      operations
    }
  })

  const rows = domains.flatMap((domain) => domain.operations)

  return { domains, operations: rows.length, system: rows.filter((row) => row.isSystem).length }
}

export const OPS_START = '<!-- ops:map:start -->'
export const OPS_END = '<!-- ops:map:end -->'

/** Таблица Markdown с колонками, выровненными пробелами, — как её оставляет prettier. */
const tableOf = (header: string[], rows: string[][]) => {
  const widths = header.map((cell, i) => Math.max(cell.length, ...rows.map((row) => row[i].length)))
  const lineOf = (cells: string[]) =>
    `| ${cells.map((cell, i) => cell.padEnd(widths[i])).join(' | ')} |`
  const divider = `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`

  return [lineOf(header), divider, ...rows.map(lineOf)].join('\n')
}

/** Строка-сводка карты операций. */
export const summaryOf = (model: OperationsModel) =>
  `Доменов — ${model.domains.length}, операций — ${model.operations}, из них служебных — ${model.system}.`

/** Блок README между маркерами: сводка и таблица «Домен | Операция | Действие | Кто». */
export const opsMapBlock = (model: OperationsModel) => {
  const rows = model.domains.flatMap((domain) => {
    return domain.operations.map((row) => [
      `\`${row.domain}\``,
      `\`${row.method}\``,
      row.title,
      row.callers
    ])
  })
  const table = tableOf(['Домен', 'Операция', 'Действие', 'Кто'], rows)

  return [OPS_START, '', summaryOf(model), '', table, '', OPS_END].join('\n')
}

/** README с новым блоком карты операций; текст вокруг маркеров не меняется. */
export const replaceOpsMap = (readme: string, block: string) => {
  const start = readme.indexOf(OPS_START)
  const end = readme.indexOf(OPS_END)

  if (start === -1 || end < start) {
    throw new Error(`в README нет маркеров ${OPS_START} … ${OPS_END}`)
  }

  return readme.slice(0, start) + block + readme.slice(end + OPS_END.length)
}
