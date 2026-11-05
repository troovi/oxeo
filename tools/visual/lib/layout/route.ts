/**
 * Маршрутизация связей через libavoid: ортогональные линии в обход карточек и подписей, конец линии — на
 * строке поля. Источник — строка поля-связи (слева или справа), цель — строка ключа (ещё сверху и снизу
 * карточки) или строка BelongsTo у ребёнка композиции.
 */
import type { Spacing } from '../config'
import type { Relation } from '../model'
import { relationRows, rowCenter, type Card } from './cards'
import type { Box, Placement } from './place'

export type Point = [number, number]

export interface Route {
  relation: Relation
  points: Point[]
}

export interface RoutingMetrics {
  routes: number
  failed: number
  /** Отрезки вдоль рамок зон и файлов: до и после отодвигания. */
  hugging: number
  cleared: number
  /** Отрезки, задевающие чужую карточку. */
  cardHits: number
  crossings: number
  length: number
  ms: number
}

export interface RoutingOptions {
  shapeBuffer: number
  nudging: number
  segmentPenalty: number
  crossingPenalty: number
}

// Штраф за пересечения подобран на схеме из 43 коллекций и 88 связей: −30% пересечений ценой +3% длины
export const DEFAULT_ROUTING: RoutingOptions = {
  shapeBuffer: 10,
  nudging: 6,
  segmentPenalty: 60,
  crossingPenalty: 80
}

// libavoid-js отдаёт в Node только ESM; из CommonJS грузим настоящим import(), а не require
const importEsm = new Function('specifier', 'return import(specifier)') as (s: string) => Promise<any>
let avoidPromise: Promise<any> | null = null
const loadAvoid = () => {
  avoidPromise ??= importEsm('libavoid-js').then(async ({ AvoidLib }) => {
    await AvoidLib.load()
    return AvoidLib.getInstance()
  })
  return avoidPromise
}

const segmentsOf = (points: Point[]) => points.slice(1).map((p, i) => [points[i], p] as const)

const hitsBox = ([a, b]: readonly [Point, Point], box: Box) => {
  const inset = 1
  const x1 = Math.min(a[0], b[0])
  const x2 = Math.max(a[0], b[0])
  const y1 = Math.min(a[1], b[1])
  const y2 = Math.max(a[1], b[1])
  return (
    x2 > box.x + inset && x1 < box.x + box.w - inset && y2 > box.y + inset && y1 < box.y + box.h - inset
  )
}

const crosses = ([a, b]: readonly [Point, Point], [c, d]: readonly [Point, Point]) => {
  const horizontal = a[1] === b[1]
  const otherHorizontal = c[1] === d[1]
  if (horizontal === otherHorizontal) return false
  const [h1, h2, v1, v2] = horizontal ? [a, b, c, d] : [c, d, a, b]
  const x = v1[0]
  const y = h1[1]
  const inside = (value: number, p: number, q: number) =>
    value > Math.min(p, q) + 0.5 && value < Math.max(p, q) - 0.5
  return inside(x, h1[0], h2[0]) && inside(y, v1[1], v2[1])
}

interface Border {
  horizontal: boolean
  at: number
  from: number
  to: number
}

const BORDER_GAP = 8

const overlap = (a1: number, a2: number, b1: number, b2: number) =>
  Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2))

const bordersOf = (placement: Placement): Border[] =>
  [...placement.zones, ...placement.files].flatMap((b) => [
    { horizontal: true, at: b.y, from: b.x, to: b.x + b.w },
    { horizontal: true, at: b.y + b.h, from: b.x, to: b.x + b.w },
    { horizontal: false, at: b.x, from: b.y, to: b.y + b.h },
    { horizontal: false, at: b.x + b.w, from: b.y, to: b.y + b.h }
  ])

/**
 * libavoid ведёт линии по кромкам «препятствие + зазор», и такая кромка иногда совпадает с рамкой зоны
 * или файла: линия сливается с рамкой. Средний отрезок, идущий вдоль рамки, сдвигается от неё на
 * BORDER_GAP, если сдвиг не задевает карточки, соседние линии и не ломает направление соседних отрезков.
 */
const clearBorders = (routes: Route[], placement: Placement, nudging: number) => {
  const borders = bordersOf(placement)
  const boxes = [...placement.cards.values()]
  const huggingBorder = (horizontal: boolean, at: number, from: number, to: number) =>
    borders.find(
      (b) =>
        b.horizontal === horizontal &&
        Math.abs(b.at - at) < BORDER_GAP - 0.5 &&
        overlap(from, to, b.from, b.to) > 10
    )
  const tooClose = (route: Route, horizontal: boolean, at: number, from: number, to: number) =>
    routes.some(
      (other) =>
        other !== route &&
        segmentsOf(other.points).some(([a, b]) => {
          const parallel = horizontal ? Math.abs(a[1] - b[1]) < 0.5 : Math.abs(a[0] - b[0]) < 0.5
          if (!parallel) return false
          const otherAt = horizontal ? a[1] : a[0]
          const range = horizontal ? overlap(from, to, a[0], b[0]) : overlap(from, to, a[1], b[1])
          return Math.abs(otherAt - at) < nudging - 1 && range > 0
        })
    )

  let hugging = 0
  let cleared = 0
  for (const route of routes) {
    const p = route.points
    for (let i = 1; i < p.length - 2; i++) {
      const [a, b] = [p[i], p[i + 1]]
      const horizontal = Math.abs(a[1] - b[1]) < 0.5
      if (!horizontal && Math.abs(a[0] - b[0]) >= 0.5) continue
      const axis = horizontal ? 1 : 0
      const at = a[axis]
      const from = horizontal ? a[0] : a[1]
      const to = horizontal ? b[0] : b[1]
      const border = huggingBorder(horizontal, at, from, to)
      if (!border) continue
      hugging++
      const side = at >= border.at ? 1 : -1
      for (const target of [border.at + side * BORDER_GAP, border.at - side * BORDER_GAP]) {
        // Соседние отрезки перпендикулярны: меняется только их длина, направление должно сохраниться
        const keeps = (q: Point, edge: boolean) =>
          Math.sign(at - q[axis]) === Math.sign(target - q[axis]) &&
          Math.abs(target - q[axis]) >= (edge ? 14 : 4)
        if (!keeps(p[i - 1], i === 1) || !keeps(p[i + 2], i + 2 === p.length - 1)) continue
        const moved = (q: Point): Point => (horizontal ? [q[0], target] : [target, q[1]])
        const changed: [Point, Point][] = [
          [p[i - 1], moved(a)],
          [moved(a), moved(b)],
          [moved(b), p[i + 2]]
        ]
        if (changed.some((segment) => boxes.some((box) => hitsBox(segment, box)))) continue
        if (
          huggingBorder(horizontal, target, from, to) ||
          tooClose(route, horizontal, target, from, to)
        )
          continue
        p[i] = moved(a)
        p[i + 1] = moved(b)
        cleared++
        break
      }
    }
  }
  return { hugging, cleared }
}

export const routeRelations = async (
  relations: Relation[],
  placement: Placement,
  cards: Map<string, Card>,
  spacing: Spacing,
  options: RoutingOptions = DEFAULT_ROUTING
): Promise<{ routes: Route[]; metrics: RoutingMetrics }> => {
  const started = Date.now()
  const A = await loadAvoid()
  const router = new A.Router(A.OrthogonalRouting)
  router.setRoutingParameter(A.shapeBufferDistance, options.shapeBuffer)
  router.setRoutingParameter(A.idealNudgingDistance, options.nudging)
  router.setRoutingParameter(A.segmentPenalty, options.segmentPenalty)
  if (options.crossingPenalty > 0)
    router.setRoutingParameter(A.crossingPenalty, options.crossingPenalty)
  router.setRoutingOption(A.nudgeOrthogonalSegmentsConnectedToShapes, false)
  router.setRoutingOption(A.nudgeSharedPathsWithCommonEndPoint, true)
  router.setRoutingOption(A.nudgeOrthogonalTouchingColinearSegments, true)

  const rect = (box: Box) =>
    new A.ShapeRef(
      router,
      new A.Rectangle(new A.Point(box.x, box.y), new A.Point(box.x + box.w, box.y + box.h))
    )

  const shapes = new Map<string, any>()
  for (const [key, placed] of placement.cards) shapes.set(key, rect(placed))
  for (const label of placement.labels) rect(label)

  // Класс пина — строка карточки в своей роли; пины не эксклюзивны: к ключу сходится много линий
  const pinClasses = new Map<string, number>()
  const pinFor = (key: string, path: string, role: 'out' | 'in' | 'key') => {
    const id = `${key}|${path}|${role}`
    const known = pinClasses.get(id)
    if (known) return known
    const classId = pinClasses.size + 1
    pinClasses.set(id, classId)
    const card = cards.get(key)!
    const shape = shapes.get(key)
    // Координаты пина — доли ширины и высоты: на правой границе абсолютное смещение libavoid считает выходом
    const y = rowCenter(card, path, spacing) / card.height
    const pin = (x: number, py: number, dir: number) =>
      new A.ShapeConnectionPin(shape, classId, x, py, true, 0, dir).setExclusive(false)
    pin(0, y, A.ConnDirLeft)
    pin(1, y, A.ConnDirRight)
    if (role === 'key') {
      pin(0.5, 0, A.ConnDirUp)
      pin(0.5, 1, A.ConnDirDown)
    }
    return classId
  }

  const connectors = relations
    .filter((r) => placement.cards.has(r.source) && placement.cards.has(r.target))
    .map((relation) => {
      const { source, sourcePath, target, targetPath } = relationRows(relation, cards)
      const from = pinFor(source.key, sourcePath, 'out')
      const to = pinFor(target.key, targetPath, relation.kind === 'own' ? 'in' : 'key')
      const conn = new A.ConnRef(
        router,
        new A.ConnEnd(shapes.get(source.key), from),
        new A.ConnEnd(shapes.get(target.key), to)
      )
      return { relation, conn }
    })

  router.processTransaction()

  const routes: Route[] = connectors.map(({ relation, conn }) => {
    const line = conn.displayRoute()
    const points: Point[] = []
    for (let i = 0; i < line.size(); i++) {
      const p = line.get_ps(i)
      points.push([Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10])
    }
    return { relation, points }
  })
  const { hugging, cleared } = clearBorders(routes, placement, options.nudging)

  const boxes = [...placement.cards.values()]
  const segments = routes.map((r) => segmentsOf(r.points))
  let cardHits = 0
  let crossings = 0
  segments.forEach((list, i) => {
    for (const segment of list) cardHits += boxes.filter((box) => hitsBox(segment, box)).length
    for (let j = i + 1; j < segments.length; j++) {
      for (const a of list) for (const b of segments[j]) if (crosses(a, b)) crossings++
    }
  })

  return {
    routes,
    metrics: {
      routes: routes.length,
      failed: routes.filter((r) => r.points.length < 2).length,
      hugging,
      cleared,
      cardHits,
      crossings,
      length: Math.round(
        segments.flat().reduce((s, [a, b]) => s + Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), 0)
      ),
      ms: Date.now() - started
    }
  }
}
