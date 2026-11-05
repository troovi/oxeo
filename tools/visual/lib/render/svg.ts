/**
 * Отрисовка карты в SVG: зоны, контейнеры файлов, связи (два слоя — все и без хабов), карточки.
 * Цвета — только через CSS-переменные, поэтому один и тот же SVG работает в светлой и тёмной теме.
 */
import type { Spacing, VisualConfig } from '../config'
import type { Relation } from '../model'
import {
  HEADER_FONT,
  ROW_FONT,
  boxInset,
  rowLevel,
  textInset,
  type Card,
  type CardRow
} from '../layout/cards'
import {
  FILE_LABEL_FONT,
  ZONE_META_FONT,
  ZONE_TITLE_FONT,
  fileLabel,
  type Placement
} from '../layout/place'
import type { Point, Route } from '../layout/route'
import { svgThemeCss, zoneVar } from './palette'
import { escapeXml as esc } from '../text'

export const MONO = `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'DejaVu Sans Mono', monospace`
export const UI = `Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`

/** Оформление карты, общее для страницы и отдельного SVG. */
export const mapCss = `
.xv-map { font-family: ${MONO}; }
.xv-zone-bg { fill: color-mix(in srgb, var(--z) 7%, var(--xv-bg)); stroke: color-mix(in srgb, var(--z) 32%, var(--xv-bg)); stroke-width: 1; }
.xv-zone-title { font: 600 ${ZONE_TITLE_FONT}px ${UI}; fill: var(--z); letter-spacing: -0.01em; }
.xv-zone-meta { font: 500 ${ZONE_META_FONT}px ${UI}; fill: var(--xv-muted); letter-spacing: 0; }
.xv-file-bg { fill: color-mix(in srgb, var(--z) 2%, var(--xv-surface)); stroke: color-mix(in srgb, var(--z) 40%, var(--xv-surface)); stroke-width: 1; stroke-dasharray: 4 3; }
.xv-file-label { font-size: ${FILE_LABEL_FONT}px; font-weight: 600; fill: var(--z); }
.xv-file-label .ns { font-weight: 400; fill: var(--xv-muted); }
.xv-edge { color: var(--z); }
.xv-edge-line { fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linejoin: round; opacity: 0.9; }
.xv-edge.xv-soft .xv-edge-line { stroke-dasharray: 5 4; }
.xv-edge.xv-own .xv-edge-line { stroke-width: 2; }
.xv-edge-end { fill: currentColor; stroke: currentColor; stroke-width: 1.2; stroke-linejoin: round; }
.xv-edge-end.hollow { fill: var(--xv-surface); }
.xv-edge-end.open { fill: none; }
.xv-edge-hit { fill: none; stroke: transparent; stroke-width: 9; }
.xv-card-bg { fill: var(--xv-surface); stroke: color-mix(in srgb, var(--z) 50%, var(--xv-line)); stroke-width: 1; }
.xv-card-head { fill: var(--z); }
.xv-card-title { font-size: ${HEADER_FONT}px; font-weight: 600; fill: var(--xv-on-zone); }
.xv-card-badge { font-size: 10px; font-weight: 500; fill: var(--xv-on-zone); opacity: 0.85; }
.xv-row-sep { stroke: color-mix(in srgb, var(--z) 10%, var(--xv-line)); stroke-width: 1; }
.xv-row-bg { fill: transparent; }
.xv-row text { font-size: ${ROW_FONT}px; }
.xv-row-label { fill: var(--xv-text); }
.xv-row-label .q { fill: var(--xv-muted); }
.xv-row-detail { fill: var(--xv-muted); }
.xv-row-detail.rel { fill: var(--t); font-weight: 500; }
.xv-row.id .xv-row-label { font-weight: 600; }
.xv-row.block .xv-row-label, .xv-row.variant .xv-row-label { font-weight: 600; }
.xv-row.block .xv-row-detail, .xv-row.variant .xv-row-detail { font-style: italic; }
.xv-block-box { stroke: color-mix(in srgb, var(--z) 45%, var(--xv-line)); stroke-width: 1; }
.xv-block-rule { stroke: color-mix(in srgb, var(--z) 45%, var(--xv-line)); stroke-width: 1; }
.xv-row.block .xv-row-label { fill: color-mix(in srgb, var(--z) 70%, var(--xv-text)); }
.xv-variant-band { fill: color-mix(in srgb, var(--z) 14%, var(--xv-surface)); }
.xv-card-far { display: none; font-weight: 600; fill: var(--xv-text); dominant-baseline: hanging; font-size: min(var(--fit), calc(13px * var(--xv-inv, 1))); }
`

const r1 = (n: number) => Math.round(n * 10) / 10
const hatchId = (zone: string) => `xv-hatch-${zone.replace(/[^A-Za-z0-9_-]/g, '_')}`

const unit = (a: Point, b: Point): Point => {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  return [dx / len, dy / len]
}

/** Ломаная со скруглёнными углами; концы укорочены под наконечники. */
const roundedPath = (input: Point[], trimStart: number, trimEnd: number, radius = 7) => {
  const points = input.map((p) => [...p] as Point)
  const length = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1])
  if (points.length >= 2) {
    // Наконечник не длиннее крайнего отрезка, иначе линия выскочит за поворот
    const start = Math.min(trimStart, length(points[0], points[1]) - 1)
    const d0 = unit(points[0], points[1])
    points[0] = [points[0][0] + d0[0] * start, points[0][1] + d0[1] * start]
    const n = points.length - 1
    const end = Math.min(trimEnd, length(points[n - 1], points[n]) - 1)
    const d1 = unit(points[n - 1], points[n])
    points[n] = [points[n][0] - d1[0] * end, points[n][1] - d1[1] * end]
  }
  let d = `M${r1(points[0][0])},${r1(points[0][1])}`
  for (let i = 1; i < points.length - 1; i++) {
    const [prev, corner, next] = [points[i - 1], points[i], points[i + 1]]
    const inLen = Math.hypot(corner[0] - prev[0], corner[1] - prev[1])
    const outLen = Math.hypot(next[0] - corner[0], next[1] - corner[1])
    const r = Math.min(radius, inLen / 2, outLen / 2)
    const a = unit(corner, prev)
    const b = unit(corner, next)
    d += ` L${r1(corner[0] + a[0] * r)},${r1(corner[1] + a[1] * r)}`
    d += ` Q${r1(corner[0])},${r1(corner[1])} ${r1(corner[0] + b[0] * r)},${r1(corner[1] + b[1] * r)}`
  }
  const last = points[points.length - 1]
  return `${d} L${r1(last[0])},${r1(last[1])}`
}

const ARROW = 9
const DIAMOND = 11
const CROW = 10

/** Наконечники: стрелка у цели ссылки, ромб у родителя композиции, «воронья лапка» у источника набора. */
const decorations = (relation: Relation, points: Point[]) => {
  const parts: string[] = []
  const [s, s1] = [points[0], points[1]]
  const [e1, e] = [points[points.length - 2], points[points.length - 1]]
  const out = unit(s, s1)
  const inn = unit(e1, e)
  const perp = (d: Point): Point => [-d[1], d[0]]
  const at = (p: Point, d: Point, along: number, side = 0): string => {
    const n = perp(d)
    return `${r1(p[0] + d[0] * along + n[0] * side)},${r1(p[1] + d[1] * along + n[1] * side)}`
  }

  if (relation.kind === 'own') {
    const cls = relation.onDelete === 'cascade' ? '' : ' hollow'
    parts.push(
      `<path class="xv-edge-end${cls}" d="M${at(s, out, 0)} L${at(s, out, DIAMOND / 2, 4)} L${at(s, out, DIAMOND)} L${at(s, out, DIAMOND / 2, -4)} Z"/>`
    )
    return { parts, trimStart: DIAMOND, trimEnd: 0 }
  }

  const cls = relation.nullable ? ' hollow' : ''
  parts.push(
    `<path class="xv-edge-end${cls}" d="M${at(e, inn, 0)} L${at(e, inn, -ARROW, 4.5)} L${at(e, inn, -ARROW, -4.5)} Z"/>`
  )
  if (relation.kind === 'set') {
    parts.push(
      `<path class="xv-edge-end open" d="M${at(s, out, 0, 5)} L${at(s, out, CROW)} L${at(s, out, 0, -5)} M${at(s, out, 0)} L${at(s, out, CROW)}"/>`
    )
  }
  return { parts, trimStart: 0, trimEnd: ARROW }
}

export interface MapLayers {
  /** Слой со всеми связями и слой без связей к хабам. */
  all: Route[]
  nohub: Route[]
}

export interface RenderMapOptions {
  config: VisualConfig
  spacing: Spacing
  placement: Placement
  layers: MapLayers
  hubs: Set<string>
  sourcesCount: Map<string, number>
  /** Для отдельного файла: свои токены темы и фон. */
  standalone?: boolean
}

export const renderMapSvg = ({
  config,
  spacing,
  placement,
  layers,
  hubs,
  sourcesCount,
  standalone
}: RenderMapOptions) => {
  const zoneOf = (key: string) => placement.cards.get(key)?.zone ?? '?'
  const zoneStyle = (zone: string) => `--z: var(${zoneVar(zone)})`
  const out: string[] = []

  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" class="xv-map xv-root" viewBox="0 0 ${Math.ceil(placement.width)} ${Math.ceil(
      placement.height
    )}" width="${Math.ceil(placement.width)}" height="${Math.ceil(placement.height)}">`
  )
  if (standalone) {
    out.push(`<style>${svgThemeCss(config.zones)}${mapCss}</style>`)
    out.push(`<rect width="100%" height="100%" style="fill: var(--xv-bg)"/>`)
  }

  // Штриховка плашек embedded-блоков: своя на каждую зону, цвет — из переменной зоны; фон прозрачный,
  // поэтому плашка берёт заливку своей рамки
  out.push('<defs>')
  for (const zone of placement.zones) {
    const color = `var(${zoneVar(zone.zone.id)})`
    out.push(
      `<pattern id="${hatchId(zone.zone.id)}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
        `<line x1="0" y1="0" x2="0" y2="6" style="stroke: ${color}; stroke-width: 1.5; stroke-opacity: 0.4"/></pattern>`
    )
  }
  out.push('</defs>')

  // Зоны
  out.push('<g class="xv-zones">')
  for (const box of placement.zones) {
    out.push(
      `<g class="xv-zone" data-zone="${esc(box.zone.id)}" style="${zoneStyle(box.zone.id)}">` +
        `<rect class="xv-zone-bg" x="${r1(box.x)}" y="${r1(box.y)}" width="${r1(box.w)}" height="${r1(box.h)}" rx="14"/>` +
        `<text class="xv-zone-title" x="${r1(box.x + spacing.zonePadX)}" y="${r1(box.y + 38)}">${esc(
          `${box.zone.id} · ${box.zone.title}`
        )}<tspan class="xv-zone-meta" dx="12">${esc(box.meta)}</tspan></text></g>`
    )
  }
  out.push('</g>')

  // Файлы
  out.push('<g class="xv-files">')
  for (const box of placement.files) {
    const label = fileLabel(box.file, box.namespace)
    const ns = box.namespace ? `<tspan class="ns"> · ${esc(box.namespace)}</tspan>` : ''
    out.push(
      `<g class="xv-file" data-file="${esc(box.file)}" style="${zoneStyle(box.zone)}">` +
        `<rect class="xv-file-bg" x="${r1(box.x)}" y="${r1(box.y)}" width="${r1(box.w)}" height="${r1(box.h)}" rx="8"/>` +
        `<text class="xv-file-label" x="${r1(box.x + spacing.filePadX)}" y="${r1(box.y + 21)}" data-label="${esc(label)}">${esc(
          box.file
        )}${ns}</text></g>`
    )
  }
  out.push('</g>')

  // Связи
  for (const [layer, routes] of Object.entries(layers) as [keyof MapLayers, Route[]][]) {
    out.push(`<g class="xv-edges" data-layer="${layer}">`)
    for (const { relation, points } of routes) {
      if (points.length < 2) continue
      const zone = relation.kind === 'own' ? zoneOf(relation.source) : zoneOf(relation.target)
      const soft = relation.onDelete === 'set-null' || relation.onDelete === 'unlink'
      const { parts, trimStart, trimEnd } = decorations(relation, points)
      const classes = [
        'xv-edge',
        `xv-${relation.kind}`,
        soft ? 'xv-soft' : '',
        hubs.has(relation.target) && relation.kind !== 'own' ? 'xv-hub' : ''
      ]
      const full = roundedPath(points, 0, 0)
      out.push(
        `<g class="${classes.filter(Boolean).join(' ')}" data-id="${esc(relation.id)}" data-source="${esc(
          relation.source
        )}" data-target="${esc(relation.target)}" data-field="${esc(relation.field)}" style="${zoneStyle(zone)}">` +
          `<path class="xv-edge-hit" d="${full}"/>` +
          `<path class="xv-edge-line" d="${roundedPath(points, trimStart, trimEnd)}"/>` +
          parts.join('') +
          '</g>'
      )
    }
    out.push('</g>')
  }

  // Карточки
  out.push('<g class="xv-cards">')
  for (const [key, placed] of placement.cards) {
    const card: Card = placed.card
    const { width: w, height: h } = card
    const hr = spacing.cardHeader
    const sources = sourcesCount.get(key) ?? 0
    const badge = hubs.has(key) ? `хаб · ${sources}` : ''
    // Крупное имя для обзорного масштаба: не шире карточки, размер на экране задаёт CSS через --xv-inv
    const farFit = Math.min(140, (w - 24) / ([...key].length * 0.6))
    out.push(
      `<g class="xv-card${hubs.has(key) ? ' hub' : ''}" data-key="${esc(key)}" transform="translate(${r1(placed.x)} ${r1(
        placed.y
      )})" style="${zoneStyle(placed.zone)}">` +
        `<rect class="xv-card-bg" width="${w}" height="${h}" rx="6"/>` +
        `<path class="xv-card-head" d="M0,6 Q0,0 6,0 H${w - 6} Q${w},0 ${w},6 V${hr} H0 Z"/>` +
        `<text class="xv-card-title" x="${spacing.cardPadX}" y="${hr / 2 + 4.5}">${esc(key)}</text>` +
        (badge
          ? `<text class="xv-card-badge" x="${w - spacing.cardPadX}" y="${hr / 2 + 4}" text-anchor="end">${badge}</text>`
          : '')
    )
    const plain = (row?: CardRow) => row !== undefined && row.kind !== 'block' && row.kind !== 'variant'
    card.rows.forEach((row, i) => {
      const { y, h: rowH } = row
      const base = y + rowH / 2 + 4
      const level = rowLevel(row)
      const inset = boxInset(level)
      const pad = textInset(level, spacing)
      const isRelation =
        row.kind === 'ref' || row.kind === 'set' || row.kind === 'own' || row.kind === 'owner'
      const detailStyle =
        isRelation && row.target ? ` style="--t: var(${zoneVar(zoneOf(row.target))})"` : ''
      const label = esc(row.label) + (row.nullable ? '<tspan class="q">?</tspan>' : '')
      // Embedded-блок — рамка в рамке: отступ от родителя, заливка плотнее с глубиной, штрихованная плашка
      let band = ''
      if (row.kind === 'block') {
        const x1 = inset + 0.5
        const x2 = w - inset - 0.5
        const bottom = (row.boxBottom ?? y + rowH) - 0.5
        const top = y + 0.5
        const head = y + rowH
        band =
          `<rect class="xv-block-box" x="${x1}" y="${top}" width="${r1(x2 - x1)}" height="${r1(bottom - top)}" rx="5" style="fill: color-mix(in srgb, var(--z) ${3 + 5 * level}%, var(--xv-surface))"/>` +
          `<path class="xv-block-head" d="M${x1},${head} V${top + 5} Q${x1},${top} ${x1 + 5},${top} H${x2 - 5} Q${x2},${top} ${x2},${top + 5} V${head} Z" style="fill: url(#${hatchId(placed.zone)})"/>` +
          `<line class="xv-block-rule" x1="${x1}" x2="${x2}" y1="${head}" y2="${head}"/>`
      } else if (row.kind === 'variant') {
        band = `<rect class="xv-variant-band" x="0.5" y="${y + 0.5}" width="${w - 1}" height="${rowH - 1}"/>`
      }
      // Разделитель — только между соседними строками полей одного уровня, без зазора между ними
      const prev = card.rows[i - 1]
      const separated = plain(row) && plain(prev) && prev.y + prev.h === y
      out.push(
        `<g class="xv-row ${row.kind}" data-path="${esc(row.path)}"${row.target ? ` data-target="${esc(row.target)}"` : ''}>` +
          band +
          (separated
            ? `<line class="xv-row-sep" x1="${inset}" x2="${w - inset}" y1="${y}" y2="${y}"/>`
            : '') +
          `<rect class="xv-row-bg" x="${inset + 0.5}" y="${y + 0.5}" width="${w - inset * 2 - 1}" height="${rowH - 1}"/>` +
          `<text class="xv-row-label" x="${pad}" y="${base}">${label}</text>` +
          (row.detail
            ? `<text class="xv-row-detail${isRelation ? ' rel' : ''}" x="${w - pad}" y="${base}" text-anchor="end"${detailStyle}>${esc(
                row.detail
              )}</text>`
            : '') +
          '</g>'
      )
    })
    out.push(
      `<text class="xv-card-far" x="${w / 2}" y="${hr + 10}" text-anchor="middle" style="--fit: ${r1(farFit)}px">${esc(key)}</text>`
    )
    out.push('</g>')
  }
  out.push('</g>')

  out.push('</svg>')
  return out.join('\n')
}
