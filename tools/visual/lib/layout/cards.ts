/**
 * Карточка коллекции: все поля, на каждом уровне сначала собственные, затем embedded-блоки — рамкой в
 * рамке с плашкой; варианты дискриминатора — отдельными разделами. Текст моноширинный, поэтому ширина
 * считается без браузера: символы × ширина знака.
 */
import type { Spacing } from '../config'
import type { Entity, Field, FieldKind, OnDelete, Relation } from '../model'

/** Ширина знака моноширинного шрифта в долях кегля (JetBrains Mono, Menlo, DejaVu Sans Mono — 0.6). */
export const MONO_ADVANCE = 0.6
export const ROW_FONT = 11
export const HEADER_FONT = 13
/** Шаг отступа рамки embedded-блока от рамки родителя. */
export const BOX_STEP = 6
/** Зазор перед рамкой блока и запас под последней строкой внутри неё. */
export const BOX_GAP_BEFORE = 5
export const BOX_PAD_AFTER = 6

export const textWidth = (text: string, size: number) =>
  Math.ceil([...text].length * size * MONO_ADVANCE)

export type RowKind = Exclude<FieldKind, 'embedded'> | 'block' | 'variant'

export interface CardRow {
  /** Адрес поля; у заголовка варианта — `@значение`. */
  path: string
  label: string
  /** Правая колонка: тип, значения литерала или цель связи. */
  detail: string
  kind: RowKind
  /** Сколько embedded-рамок вокруг строки; плашка блока сама лежит на уровне `depth + 1`. */
  depth: number
  /** Верх и высота строки относительно верха карточки. */
  y: number
  h: number
  /** У плашки блока — нижняя граница его рамки. */
  boxBottom?: number
  target?: string
  onDelete?: OnDelete
  nullable?: boolean
  variant?: string
}

export interface Card {
  key: string
  entity: Entity
  rows: CardRow[]
  width: number
  height: number
}

/** Уровень рамки, внутри которой стоит текст строки. */
export const rowLevel = (row: CardRow) => (row.kind === 'block' ? row.depth + 1 : row.depth)
/** Отступ рамки уровня от края карточки. */
export const boxInset = (level: number) => level * BOX_STEP
/** Отступ текста строки уровня от края карточки. */
export const textInset = (level: number, spacing: Spacing) =>
  level === 0 ? spacing.cardPadX : boxInset(level) + 8

const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text

const detailOf = (field: Field): string => {
  switch (field.kind) {
    case 'id':
      return `PK · ${field.type}`
    case 'ref':
      return `→ ${field.target}`
    case 'set':
      return `⇉ ${field.target}[]`
    case 'own':
      return `◆ ${field.target}[]`
    case 'owner':
      return `◆ ${field.target}`
    case 'embedded':
      return field.type ?? 'embedded'
  }
  if (field.values?.length) return truncate(field.values.join(' | '), 34)
  const ts = field.tsType?.replace(/\s*\|\s*null$/, '')
  return truncate(ts && ts !== field.type ? ts : (field.type ?? ''), 34)
}

/** На каждом уровне сначала собственные поля в порядке объявления, затем embedded-блоки. */
export const ownFieldsFirst = (fields: Field[]) => [
  ...fields.filter((f) => f.kind !== 'embedded'),
  ...fields.filter((f) => f.kind === 'embedded')
]

export const buildCard = (entity: Entity, spacing: Spacing): Card => {
  const rows: CardRow[] = []
  let y = spacing.cardHeader

  const push = (row: Omit<CardRow, 'y' | 'h'>) => {
    rows.push({ ...row, y, h: spacing.cardRow })
    y += spacing.cardRow
  }

  const walk = (fields: Field[], depth: number, variant?: string) => {
    for (const field of ownFieldsFirst(fields)) {
      const row = {
        path: field.path,
        label: field.name,
        detail: detailOf(field),
        kind: field.kind === 'embedded' ? ('block' as const) : field.kind,
        depth,
        target: field.target,
        onDelete: field.onDelete,
        nullable: field.nullable,
        variant
      }
      if (field.kind !== 'embedded') {
        push(row)
        continue
      }
      // Блок — рамка с зазором сверху и запасом снизу: вложенные блоки читаются как рамки в рамке
      y += BOX_GAP_BEFORE
      const index = rows.length
      push(row)
      walk(field.fields ?? [], depth + 1, variant)
      y += BOX_PAD_AFTER
      rows[index].boxBottom = y
    }
  }

  walk(entity.fields, 0)
  for (const v of entity.variants) {
    y += BOX_GAP_BEFORE
    push({
      path: `@${v.value}`,
      label: `${entity.discriminatorKey} = ${v.value}`,
      detail: v.model,
      kind: 'variant',
      depth: 0,
      variant: v.value
    })
    walk(v.fields, 0, v.value)
  }

  const rowWidth = (row: CardRow) =>
    textInset(rowLevel(row), spacing) * 2 +
    textWidth(row.label + (row.nullable ? '?' : ''), ROW_FONT) +
    18 +
    textWidth(row.detail, ROW_FONT)
  const width = Math.max(
    spacing.cardMinWidth,
    textWidth(entity.key, HEADER_FONT) + 40,
    ...rows.map(rowWidth)
  )

  return {
    key: entity.key,
    entity,
    rows,
    width: Math.ceil(width / 2) * 2,
    height: y + 4
  }
}

/** Вертикальная координата центра строки относительно верха карточки. */
export const rowCenter = (card: Card, path: string, spacing: Spacing) => {
  const row = card.rows.find((r) => r.path === path)
  return row ? row.y + row.h / 2 : spacing.cardHeader + spacing.cardRow / 2
}

/** Строка, к которой привязан конец связи: поле-источник или ключ цели. */
export const relationRows = (relation: Relation, cards: Map<string, Card>) => {
  const source = cards.get(relation.source)!
  const target = cards.get(relation.target)!
  if (relation.kind === 'own') {
    return {
      source,
      sourcePath: relation.field,
      target,
      targetPath: relation.ownerField ?? target.entity.idKey
    }
  }
  return { source, sourcePath: relation.field, target, targetPath: target.entity.idKey }
}
