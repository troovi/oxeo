/**
 * Страница карты: панель сверху, карта в центре, досье справа. Всё встроено в один файл — стили, SVG,
 * модель и скрипт; из сети подгружаются только шрифты (без них работают системные моноширинные).
 */
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import type { ZoneConfig } from '../config'
import { pageThemeCss } from './palette'
import { MONO, UI, mapCss } from './svg'

/** Скрипт страницы: в сборке пакета — готовый `client.js`, при запуске из исходников — транспиляция `client.ts`. */
const clientScript = () => {
  const compiled = path.join(__dirname, 'client.js')
  if (fs.existsSync(compiled)) return fs.readFileSync(compiled, 'utf8')
  const source = fs.readFileSync(path.join(__dirname, 'client.ts'), 'utf8')
  return ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2019,
      module: ts.ModuleKind.None,
      removeComments: true
    }
  }).outputText
}

const pageCss = `
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { height: 100%; }
body { margin: 0; background: var(--xv-bg); color: var(--xv-text); font: 400 13px/1.45 ${UI}; -webkit-font-smoothing: antialiased; }
code { font-family: ${MONO}; font-size: 0.92em; background: var(--xv-surface-2); padding: 1px 4px; border-radius: 3px; }
button { font: inherit; color: inherit; }
:focus-visible { outline: 2px solid var(--xv-accent); outline-offset: 1px; }

.xv-app { position: fixed; inset: 0; }
.xv-stage { position: absolute; inset: 0; overflow: hidden; background: var(--xv-bg); cursor: grab; touch-action: none; user-select: none; }
.xv-stage.is-panning { cursor: grabbing; }
.xv-stage > svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }

/* Плавающие подложки поверх карты, как в Miro: карта занимает всё окно */
.xv-float { position: absolute; top: 12px; z-index: 6; display: flex; align-items: center; gap: 6px; height: 44px; padding: 0 6px; background: var(--xv-surface); border-radius: 8px; box-shadow: 0 0 0 1px color-mix(in srgb, var(--xv-text) 7%, transparent), 0 2px 6px rgb(0 0 0 / 0.06), 0 8px 24px rgb(0 0 0 / 0.07); cursor: auto; user-select: none; }
.xv-float-left { left: 12px; }
.xv-float-right { right: 12px; }
.xv-divider { width: 1px; height: 22px; margin: 0 2px; background: var(--xv-line); flex: none; }
.xv-meta { padding: 0 8px 0 2px; color: var(--xv-muted); font-size: 12px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.xv-ctl-label { padding-left: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--xv-muted); }
.xv-seg { display: inline-flex; gap: 2px; padding: 2px; background: var(--xv-surface-2); border-radius: 7px; }
.xv-seg button { height: 28px; border: 0; background: transparent; color: var(--xv-muted); font-size: 12px; font-weight: 500; line-height: 1; padding: 0 10px; border-radius: 5px; cursor: pointer; }
.xv-seg button:hover { color: var(--xv-text); }
.xv-seg button[aria-pressed='true'] { background: var(--xv-surface); color: var(--xv-text); box-shadow: 0 0 0 1px var(--xv-line), 0 1px 2px rgb(0 0 0 / 0.06); }
.xv-tool { height: 32px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; font-size: 13px; font-weight: 500; cursor: pointer; }
.xv-tool:hover { background: var(--xv-surface-2); }
.xv-tool[aria-expanded='true'] { background: var(--xv-accent-quiet); color: var(--xv-accent); }
.xv-search { position: relative; display: flex; align-items: center; }
.xv-search-icon { position: absolute; left: 10px; color: var(--xv-faint); pointer-events: none; }
.xv-search input { width: 260px; height: 32px; padding: 0 40px 0 32px; border: 0; border-radius: 6px; background: var(--xv-surface-2); color: var(--xv-text); font: 13px ${UI}; }
.xv-search input::placeholder { color: var(--xv-faint); }
.xv-search-count { position: absolute; right: 10px; font: 500 11px ${MONO}; color: var(--xv-muted); pointer-events: none; }
.xv-zoom { position: absolute; left: 12px; bottom: 12px; padding: 3px 8px; border-radius: 4px; background: color-mix(in srgb, var(--xv-surface) 88%, transparent); color: var(--xv-muted); font: 500 11px ${MONO}; pointer-events: none; }

.xv-map .xv-card, .xv-map .xv-edge { cursor: pointer; transition: opacity 0.12s; }
.xv-map .xv-row:hover .xv-row-bg { fill: color-mix(in srgb, var(--xv-accent) 8%, transparent); }
.xv-map.has-focus .xv-edge:not(.is-on) { opacity: 0.07; }
.xv-map.has-focus .xv-card:not(.is-on) { opacity: 0.3; }
.xv-map .xv-edge.is-on .xv-edge-line { stroke-width: 2.4; opacity: 1; }
.xv-map .xv-edge.xv-own.is-on .xv-edge-line { stroke-width: 3; }
.xv-map .xv-card.is-selected .xv-card-bg { stroke: var(--xv-accent); stroke-width: 2.5; }
.xv-map.has-search .xv-card:not(.match) { opacity: 0.25; }
.xv-map .xv-card.match .xv-card-bg { stroke: var(--xv-match); stroke-width: 3; }
.xv-map .xv-row.match .xv-row-bg { fill: color-mix(in srgb, var(--xv-match) 35%, transparent); }
.xv-map.is-locked .xv-card:not(.is-on) { opacity: 0.16; cursor: default; }
.xv-map.is-locked .xv-card:not(.is-on) .xv-row:hover .xv-row-bg { fill: transparent; }
.xv-map.is-locked .xv-edge:not(.is-on) { opacity: 0.04; pointer-events: none; }
.xv-map .xv-row.is-pinned .xv-row-bg { fill: color-mix(in srgb, var(--xv-accent) 24%, transparent); stroke: var(--xv-accent); stroke-width: 1; }
.xv-map .xv-row.is-pinned .xv-row-label { fill: var(--xv-accent); font-weight: 600; }
.xv-map .xv-row.is-linked .xv-row-bg { fill: color-mix(in srgb, var(--xv-accent) 12%, transparent); }
.xv-map .xv-edges[data-layer='nohub'] { visibility: hidden; }
.xv-map.mode-shortcuts .xv-edges[data-layer='all'] { visibility: hidden; }
.xv-map.mode-shortcuts .xv-edges[data-layer='nohub'] { visibility: visible; }
.xv-map.mode-shortcuts .xv-edges[data-layer='all'] .xv-edge.xv-hub.is-on { visibility: visible; }
.xv-map.lod-far .xv-row, .xv-map.lod-far .xv-card-title, .xv-map.lod-far .xv-card-badge, .xv-map.lod-far .xv-file-label { display: none; }
.xv-map.lod-far .xv-card-far { display: inline; }
.xv-map.lod-far .xv-zone-title { font-size: clamp(20px, calc(16px * var(--xv-inv, 1)), 76px); }
.xv-map.lod-far .xv-zone-meta { font-size: clamp(12px, calc(10px * var(--xv-inv, 1)), 36px); }
.xv-map.lod-far .xv-edge-line { stroke-width: 2.6; }

.xv-legend { position: absolute; top: 64px; right: 12px; z-index: 5; width: 320px; max-width: calc(100% - 24px); max-height: calc(100% - 76px); overflow: auto; padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 16px; background: var(--xv-surface); border: 1px solid var(--xv-line-strong); border-radius: 8px; box-shadow: 0 10px 30px rgb(0 0 0 / 0.12); cursor: auto; user-select: text; }
.xv-legend section h3 { margin: 0 0 8px; font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--xv-muted); }
.lg-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 14px; }
.lg-close { width: 26px; height: 26px; border: 0; border-radius: 5px; background: none; color: var(--xv-muted); font-size: 18px; line-height: 1; cursor: pointer; }
.lg-close:hover { background: var(--xv-surface-2); color: var(--xv-text); }
.quiet { color: var(--xv-muted); font-size: 12px; margin: 0; }
.zone-dot { width: 8px; height: 8px; border-radius: 2px; background: var(--t); flex: none; }
.ent-link { padding: 0; border: 0; background: none; color: var(--t, var(--xv-accent)); font: 600 12px ${MONO}; cursor: pointer; }
.ent-link:hover { text-decoration: underline; }
.del { display: inline-block; padding: 0 5px; border: 1px solid currentColor; border-radius: 3px; font: 500 10px/16px ${MONO}; color: var(--xv-text); }
.del.cascade { color: #d62828; }
.del.set-null, .del.unlink { color: var(--xv-muted); border-style: dashed; }
.legend { display: flex; flex-direction: column; gap: 6px; }
.lg { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 10px; align-items: center; font-size: 12px; color: var(--xv-muted); }
.lg span { color: var(--xv-text); }
.lg small { display: block; color: var(--xv-muted); font-size: 11px; }
.zones { display: flex; flex-direction: column; gap: 1px; margin: 0 -6px; }
.zone-row { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 5px 6px; border: 0; border-radius: 5px; background: none; text-align: left; cursor: pointer; font-size: 13px; }
.zone-row:hover { background: var(--xv-surface-2); }
.zone-row .zone-dot { width: 10px; height: 10px; }
.keys { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--xv-muted); }
kbd { display: inline-block; min-width: 18px; padding: 0 5px; margin-right: 6px; border: 1px solid var(--xv-line-strong); border-bottom-width: 2px; border-radius: 4px; font: 500 11px/18px ${MONO}; color: var(--xv-text); text-align: center; }
.foot { font-size: 11px; }

.xv-tip { position: fixed; z-index: 50; max-width: 520px; max-height: calc(100vh - 16px); overflow: hidden; padding: 8px 10px; border: 1px solid var(--xv-line-strong); border-radius: 6px; background: var(--xv-surface); box-shadow: 0 8px 24px rgb(0 0 0 / 0.14); font-size: 12px; line-height: 1.5; pointer-events: none; }
.xv-tip b { font-family: ${MONO}; font-weight: 600; }
.xv-tip .muted { color: var(--xv-muted); }
.xv-tip .tip-code { margin: 6px 0 2px; padding: 5px 7px; border-radius: 4px; background: var(--xv-surface-2); font: 11px/1.5 ${MONO}; color: var(--xv-text); overflow-wrap: anywhere; }
.xv-tip .tip-dec { color: var(--xv-accent); font-weight: 600; }
.xv-tip .tip-zone { font-weight: 600; }
.xv-tip .tip-doc { margin: 6px 0; line-height: 1.5; white-space: pre-line; }
.xv-tip .tip-meta { color: var(--xv-muted); }
.xv-tip .tip-impact { margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--xv-line); display: flex; flex-direction: column; gap: 3px; }
.xv-tip code { font-size: 11px; }
.xv-tip .tip-pre { margin: 6px 0 2px; padding: 7px 9px; border-radius: 4px; background: var(--xv-surface-2); font: 11px/1.5 ${MONO}; color: var(--xv-text); white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 2; }
.xv-tip .ts-c { color: var(--xv-muted); font-style: italic; }
.xv-tip .ts-s { color: var(--xv-code-string); }
.xv-tip .ts-k { color: var(--xv-accent); }
.xv-tip .ts-t { color: var(--xv-code-type); }

@media (max-width: 720px) {
  .xv-float-left { right: 12px; }
  .xv-float-left .xv-divider, .xv-meta { display: none; }
  .xv-search, .xv-search input { width: 100%; }
  .xv-search { flex: 1; }
  .xv-float-right { top: 64px; }
  .xv-legend { top: 116px; max-height: calc(100% - 128px); }
}
@media (prefers-reduced-motion: reduce) {
  .xv-map .xv-card, .xv-map .xv-edge { transition: none; }
}
`

export interface RenderPageOptions {
  zones: ZoneConfig[]
  mapSvg: string
  data: unknown
  meta: string
}

export const renderPage = ({ zones, mapSvg, data, meta }: RenderPageOptions) => {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return `<!doctype html>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Карта схемы</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap" />
<style>${pageThemeCss(zones)}
${mapCss}
${pageCss}</style>
<div class="xv-app">
  <main class="xv-stage" id="xv-stage" aria-label="Карта схемы">
${mapSvg}
    <div class="xv-float xv-float-left">
      <label class="xv-search">
        <svg class="xv-search-icon" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 11 L14.5 14.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        <input id="xv-search" type="search" autocomplete="off" spellcheck="false" placeholder="Коллекция или поле…" aria-label="Поиск по коллекциям и полям" />
        <span class="xv-search-count" id="xv-search-count"></span>
      </label>
      <span class="xv-divider" aria-hidden="true"></span>
      <span class="xv-meta">${meta}</span>
    </div>
    <div class="xv-float xv-float-right">
      <span class="xv-ctl-label">Хабы</span>
      <div class="xv-seg">
        <button type="button" data-hub-mode="lines">Линии</button>
        <button type="button" data-hub-mode="shortcuts">Ярлыки</button>
      </div>
      <span class="xv-divider" aria-hidden="true"></span>
      <button type="button" class="xv-tool" id="xv-legend-toggle" aria-controls="xv-legend" aria-expanded="false">Легенда</button>
    </div>
    <div class="xv-zoom" id="xv-zoom"></div>
    <aside class="xv-legend" id="xv-legend" aria-label="Легенда" hidden></aside>
  </main>
</div>
<div class="xv-tip" id="xv-tip" hidden></div>
<pre id="xv-debug" hidden></pre>
<script id="xv-data" type="application/json">${json}</script>
<script>${clientScript()}</script>
`
}
