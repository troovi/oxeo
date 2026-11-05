/**
 * Сборка карты: модель схемы → карточки → размещение по зонам и файлам → маршруты связей (два прогона:
 * все связи и без хабов) → самодостаточный HTML и статический SVG.
 */
import { resolveSpacing, type VisualConfig } from './config'
import { extractScheme } from './extract'
import { buildCard, type Card } from './layout/cards'
import { place } from './layout/place'
import { routeRelations, type RoutingMetrics } from './layout/route'
import type { SchemeModel } from './model'
import type { SchemeSource } from './scheme-meta'
import { renderPage } from './render/html'
import { zoneVar } from './render/palette'
import { renderMapSvg } from './render/svg'
import { plural } from './text'

export interface SchemeMapOptions {
  /** Каталог с исходниками классов схемы. */
  sourceDir: string
  /** tsconfig проекта для разрешения типов json-полей. */
  tsconfig?: string
  config: VisualConfig
}

export interface SchemeMapResult {
  html: string
  svg: string
  model: SchemeModel
  metrics: {
    width: number
    height: number
    cards: number
    hubs: string[]
    all: RoutingMetrics
    nohub: RoutingMetrics
  }
}

export const buildSchemeMap = async (
  dataScheme: SchemeSource,
  { sourceDir, tsconfig, config }: SchemeMapOptions
): Promise<SchemeMapResult> => {
  const model = extractScheme(dataScheme, { sourceDir, tsconfig })
  const spacing = resolveSpacing(config)
  const cards = new Map<string, Card>(model.entities.map((e) => [e.key, buildCard(e, spacing)]))
  const placement = place(model, cards, config, spacing)

  const sources = new Map<string, Set<string>>()
  for (const r of model.relations) {
    if (r.kind === 'own') continue
    sources.set(r.target, (sources.get(r.target) ?? new Set()).add(r.source))
  }
  const sourcesCount = new Map([...sources].map(([key, set]) => [key, set.size]))
  const hubs = new Set(
    [...sourcesCount].filter(([, n]) => n >= (config.hubMinSources ?? 7)).map(([key]) => key)
  )

  const all = await routeRelations(model.relations, placement, cards, spacing)
  const nohub = await routeRelations(
    model.relations.filter((r) => r.kind === 'own' || !hubs.has(r.target)),
    placement,
    cards,
    spacing
  )
  const layers = { all: all.routes, nohub: nohub.routes }
  const renderOptions = { config, spacing, placement, layers, hubs, sourcesCount }

  const zones = placement.zones.map((z) => z.zone)
  const zoneOf = Object.fromEntries([...placement.cards].map(([key, c]) => [key, c.zone]))
  const data = {
    generatedAt: new Date().toISOString(),
    zones: zones.map((z) => ({ id: z.id, title: z.title, colorVar: zoneVar(z.id) })),
    entities: model.entities,
    types: model.types,
    relations: model.relations,
    zoneOf,
    hubs: [...hubs],
    sources: Object.fromEntries(sourcesCount),
    size: { width: placement.width, height: placement.height }
  }

  const meta = `${plural(model.entities.length, ['коллекция', 'коллекции', 'коллекций'])} · ${plural(
    model.relations.length,
    ['связь', 'связи', 'связей']
  )} · ${plural(model.files.length, ['файл', 'файла', 'файлов'])}`

  return {
    html: renderPage({ zones, mapSvg: renderMapSvg(renderOptions), data, meta }),
    svg: renderMapSvg({ ...renderOptions, standalone: true }),
    model,
    metrics: {
      width: Math.round(placement.width),
      height: Math.round(placement.height),
      cards: cards.size,
      hubs: [...hubs],
      all: all.metrics,
      nohub: nohub.metrics
    }
  }
}
