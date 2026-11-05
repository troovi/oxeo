/**
 * Размещение: карточки в файле (лес композиции) → файлы в зоне (ряды из конфига) → зоны в поясах.
 * Раскладка детерминированная: одинаковая схема и конфиг дают одинаковую карту.
 */
import type { Spacing, VisualConfig, ZoneConfig } from '../config'
import type { SchemeModel } from '../model'
import { plural } from '../text'
import { textWidth, type Card } from './cards'

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface PlacedCard extends Box {
  card: Card
  zone: string
}

export interface FileBox extends Box {
  file: string
  namespace?: string
  zone: string
}

export interface ZoneBox extends Box {
  zone: ZoneConfig
  /** Подпись рядом с заголовком: «2 файла · 7 коллекций». */
  meta: string
}

/** Подписи зон и файлов: маршрутизатор обходит их, как карточки. */
export interface LabelBox extends Box {
  kind: 'zone' | 'file'
}

export interface Placement {
  width: number
  height: number
  cards: Map<string, PlacedCard>
  files: FileBox[]
  zones: ZoneBox[]
  labels: LabelBox[]
}

interface Block {
  w: number
  h: number
  items: { key: string; x: number; y: number }[]
}

export const FALLBACK_ZONE = '?'
export const ZONE_TITLE_FONT = 20
export const ZONE_META_FONT = 12
export const FILE_LABEL_FONT = 11

export const fileLabel = (file: string, namespace?: string) =>
  namespace ? `${file} · ${namespace}` : file

/** Ширина текста интерфейсным шрифтом: среднее для кириллицы и латиницы с запасом. */
export const uiTextWidth = (text: string, size: number) => Math.ceil([...text].length * size * 0.62)

const offset = (block: Block, dx: number, dy: number) =>
  block.items.map((item) => ({ key: item.key, x: item.x + dx, y: item.y + dy }))

/** Карточки одного файла: родитель слева, дети композиции столбцом справа; корни пакуются в колонки. */
const layoutFile = (
  keys: string[],
  model: SchemeModel,
  cards: Map<string, Card>,
  spacing: Spacing,
  aspect: number
): Block => {
  const inFile = new Set(keys)
  const children = new Map<string, string[]>()
  const owned = new Set<string>()
  for (const relation of model.relations) {
    if (relation.kind !== 'own' || !inFile.has(relation.source) || !inFile.has(relation.target))
      continue
    if (owned.has(relation.target) || relation.source === relation.target) continue
    owned.add(relation.target)
    children.set(relation.source, [...(children.get(relation.source) ?? []), relation.target])
  }

  const tree = (key: string): Block => {
    const card = cards.get(key)!
    const kids = (children.get(key) ?? []).map(tree)
    if (!kids.length) return { w: card.width, h: card.height, items: [{ key, x: 0, y: 0 }] }
    const x0 = card.width + spacing.cardGapX
    const items = [{ key, x: 0, y: 0 }]
    let y = 0
    for (const kid of kids) {
      items.push(...offset(kid, x0, y))
      y += kid.h + spacing.cardGapY
    }
    const kidsHeight = y - spacing.cardGapY
    return { w: x0 + Math.max(...kids.map((k) => k.w)), h: Math.max(card.height, kidsHeight), items }
  }

  const roots = keys.filter((key) => !owned.has(key)).map(tree)

  // Колонки корней: перебираем предел высоты колонки и берём раскладку с пропорциями ближе к `aspect`
  const columns = (limit: number) => {
    const placed: Block['items'] = []
    let x = 0
    let y = 0
    let columnWidth = 0
    let width = 0
    let height = 0
    for (const block of roots) {
      if (y > 0 && y + block.h > limit) {
        x += columnWidth + spacing.cardGapX
        y = 0
        columnWidth = 0
      }
      placed.push(...offset(block, x, y))
      columnWidth = Math.max(columnWidth, block.w)
      height = Math.max(height, y + block.h)
      width = Math.max(width, x + block.w)
      y += block.h + spacing.cardGapY
    }
    return { w: width, h: height, items: placed }
  }

  const tallest = Math.max(...roots.map((b) => b.h))
  const total = roots.reduce((sum, b) => sum + b.h + spacing.cardGapY, 0)
  let best: Block | null = null
  for (let limit = tallest; limit <= total + 1; limit += 20) {
    const candidate = columns(limit)
    const score = Math.abs(Math.log(candidate.w / candidate.h / aspect))
    const bestScore = best ? Math.abs(Math.log(best.w / best.h / aspect)) : Infinity
    if (score < bestScore - 1e-6) best = candidate
  }
  return best ?? columns(total)
}

export const place = (
  model: SchemeModel,
  cards: Map<string, Card>,
  config: VisualConfig,
  spacing: Spacing
): Placement => {
  const byFile = new Map<string, string[]>()
  for (const entity of model.entities)
    byFile.set(entity.file, [...(byFile.get(entity.file) ?? []), entity.key])

  const zones = config.zones.map((zone) => ({
    ...zone,
    files: zone.files.map((row) => row.filter((f) => byFile.has(f)))
  }))
  const assigned = new Set(zones.flatMap((z) => z.files.flat()))
  const rest = model.files.map((f) => f.file).filter((file) => !assigned.has(file))
  const bands = config.bands.map((band) => [...band])
  if (rest.length) {
    console.warn(`  ! файлы без зоны в конфиге: ${rest.join(', ')}`)
    zones.push({ id: FALLBACK_ZONE, title: 'Без зоны', color: '#6b6b76', files: [rest] })
    bands.push([FALLBACK_ZONE])
  }
  const namespaceOf = new Map(model.files.map((f) => [f.file, f.namespace]))

  // Зона в собственных координатах: ряды файлов, у каждого файла — блок карточек
  const zoneLayouts = new Map(
    zones.map((zone) => {
      const rows = zone.files
        .filter((row) => row.length)
        .map((row) =>
          row.map((file) => {
            const block = layoutFile(byFile.get(file)!, model, cards, spacing, 1.5)
            const label = fileLabel(file, namespaceOf.get(file))
            const w = Math.max(block.w, textWidth(label, FILE_LABEL_FONT) + 8) + spacing.filePadX * 2
            const h = block.h + spacing.filePadTop + spacing.filePadBottom
            return { file, block, w, h }
          })
        )
      const rowWidth = (row: { w: number }[]) =>
        row.reduce((s, f) => s + f.w, 0) + spacing.fileGap * (row.length - 1)
      const contentW = Math.max(
        ...rows.map(rowWidth),
        uiTextWidth(`${zone.id} · ${zone.title}`, ZONE_TITLE_FONT)
      )
      const contentH =
        rows.reduce((s, row) => s + Math.max(...row.map((f) => f.h)), 0) +
        spacing.fileGap * (rows.length - 1)
      return [
        zone.id,
        {
          zone,
          rows,
          rowWidth,
          w: contentW + spacing.zonePadX * 2,
          h: contentH + spacing.zonePadTop + spacing.zonePadBottom
        }
      ]
    })
  )

  const bandWidth = (band: string[]) =>
    band.reduce((s, id) => s + zoneLayouts.get(id)!.w, 0) + spacing.zoneGap * (band.length - 1)
  const validBands = bands
    .map((band) => band.filter((id) => zoneLayouts.has(id)))
    .filter((band) => band.length)
  const mapWidth = Math.max(...validBands.map(bandWidth))

  const placement: Placement = {
    width: 0,
    height: 0,
    cards: new Map(),
    files: [],
    zones: [],
    labels: []
  }
  let y = spacing.margin

  for (const band of validBands) {
    const natural = bandWidth(band)
    const naturalZones = band.reduce((s, id) => s + zoneLayouts.get(id)!.w, 0)
    const bandHeight = Math.max(...band.map((id) => zoneLayouts.get(id)!.h))
    let x = spacing.margin

    for (const id of band) {
      const layout = zoneLayouts.get(id)!
      // Пояса выравниваются по ширине самого широкого: лишнее делится между зонами пропорционально
      const w = layout.w + ((mapWidth - natural) * layout.w) / naturalZones
      const files = layout.rows.flat()
      const count = files.reduce((s, f) => s + f.block.items.length, 0)
      const meta = `${plural(files.length, ['файл', 'файла', 'файлов'])} · ${plural(count, ['коллекция', 'коллекции', 'коллекций'])}`
      placement.zones.push({ zone: layout.zone, meta, x, y, w, h: bandHeight })
      // Препятствие под заголовком: канал маршрутизатора проходит по его нижней кромке + зазор,
      // поэтому `zonePadTop` должен оставлять между этим каналом и рамками файлов заметный просвет
      placement.labels.push({
        kind: 'zone',
        x: x + spacing.zonePadX - 6,
        y: y + 12,
        w:
          uiTextWidth(`${layout.zone.id} · ${layout.zone.title}`, ZONE_TITLE_FONT) +
          24 +
          uiTextWidth(meta, ZONE_META_FONT),
        h: 36
      })

      const contentWidth = Math.max(...layout.rows.map(layout.rowWidth))
      let fy = y + spacing.zonePadTop
      for (const row of layout.rows) {
        let fx = x + (w - contentWidth) / 2
        for (const file of row) {
          placement.files.push({
            file: file.file,
            namespace: namespaceOf.get(file.file),
            zone: id,
            x: fx,
            y: fy,
            w: file.w,
            h: file.h
          })
          // Подпись файла как препятствие начинается выше рамки: канал над ней уходит от рамки на 22 px
          placement.labels.push({
            kind: 'file',
            x: fx + spacing.filePadX - 4,
            y: fy - 12,
            w: textWidth(fileLabel(file.file, namespaceOf.get(file.file)), FILE_LABEL_FONT) + 8,
            h: 38
          })
          for (const item of file.block.items) {
            const card = cards.get(item.key)!
            placement.cards.set(item.key, {
              card,
              zone: id,
              x: fx + spacing.filePadX + item.x,
              y: fy + spacing.filePadTop + item.y,
              w: card.width,
              h: card.height
            })
          }
          fx += file.w + spacing.fileGap
        }
        fy += Math.max(...row.map((f) => f.h)) + spacing.fileGap
      }
      x += w + spacing.zoneGap
    }
    y += bandHeight + spacing.bandGap
  }

  placement.width = mapWidth + spacing.margin * 2
  placement.height = y - spacing.bandGap + spacing.margin
  return placement
}
