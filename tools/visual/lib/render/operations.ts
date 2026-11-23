/**
 * Страница «Операции»: домены реестра, их операции с описанием, доступом и схемой параметров. Самодостаточный HTML, как
 * карта: стили и скрипт фильтра встроены, из сети — только шрифты. Ссылка ведёт обратно на карту схемы.
 */
import type { OperationsModel } from '../operations'
import { summaryOf } from '../operations'
import { escapeXml } from '../text'
import { pageThemeCss } from './palette'
import { MONO, UI } from './svg'

const css = `
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; background: var(--xv-bg); color: var(--xv-text); font: 400 14px/1.5 ${UI}; -webkit-font-smoothing: antialiased; }
code, pre { font-family: ${MONO}; }
a { color: var(--xv-accent); }
.ops-head { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; padding: 14px max(16px, calc((100vw - 1100px) / 2)); background: var(--xv-surface); border-bottom: 1px solid var(--xv-line); }
.ops-head h1 { margin: 0; font-size: 17px; font-weight: 600; }
.ops-meta { color: var(--xv-muted); font-size: 13px; font-variant-numeric: tabular-nums; }
.ops-head input { flex: 1 1 220px; max-width: 360px; height: 32px; padding: 0 10px; border: 0; border-radius: 6px; background: var(--xv-surface-2); color: var(--xv-text); font: 13px ${UI}; }
.ops-head a { margin-left: auto; font-size: 13px; font-weight: 500; text-decoration: none; }
main { max-width: 1100px; margin: 0 auto; padding: 8px 16px 48px; }
.ops-domain { margin-top: 28px; }
.ops-domain h2 { margin: 0; font-size: 16px; font-weight: 600; }
.ops-domain h2 code { margin-left: 8px; font-size: 12px; font-weight: 500; color: var(--xv-muted); }
.ops-domain > p { margin: 4px 0 12px; color: var(--xv-muted); }
.ops-op { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6px 20px; padding: 12px 14px; margin-top: 8px; background: var(--xv-surface); border: 1px solid var(--xv-line); border-radius: 8px; }
.ops-op h3 { margin: 0; font-size: 14px; font-weight: 600; }
.ops-op h3 code { margin-right: 8px; font-size: 12px; color: var(--xv-accent); }
.ops-op p { margin: 0; color: var(--xv-muted); }
.ops-who { justify-self: start; padding: 1px 8px; border-radius: 999px; background: var(--xv-surface-2); font-size: 12px; font-weight: 500; }
.ops-who[data-kind='system'] { background: var(--xv-accent-quiet); color: var(--xv-accent); }
.ops-params { grid-column: 2; grid-row: 1 / span 3; margin: 0; padding: 8px 10px; border-radius: 6px; background: var(--xv-surface-2); font-size: 12px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
.ops-empty { margin-top: 32px; color: var(--xv-muted); }
@media (max-width: 720px) {
  .ops-op { grid-template-columns: minmax(0, 1fr); }
  .ops-params { grid-column: 1; grid-row: auto; }
  .ops-head a { margin-left: 0; }
}
`

const script = `
;(() => {
  const input = document.getElementById('ops-filter')
  const empty = document.getElementById('ops-empty')
  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase()
    let shown = 0
    for (const domain of document.querySelectorAll('.ops-domain')) {
      let inDomain = 0
      for (const op of domain.querySelectorAll('.ops-op')) {
        const match = !query || op.dataset.text.includes(query) || domain.dataset.text.includes(query)
        op.hidden = !match
        if (match) inDomain++
      }
      domain.hidden = inDomain === 0
      shown += inDomain
    }
    empty.hidden = shown > 0
  })
})()
`

export interface OperationsPageOptions {
  model: OperationsModel
  /** Ссылка на карту схемы — относительная, как файлы лежат рядом. */
  mapHref: string
}

export const renderOperationsPage = ({ model, mapHref }: OperationsPageOptions) => {
  const domains = model.domains.map((domain) => {
    const domainText = `${domain.key} ${domain.title} ${domain.description}`.toLowerCase()
    const operations = domain.operations.map((op) => {
      const text = `${op.method} ${op.title} ${op.description} ${op.callers}`.toLowerCase()
      const kind = op.isSystem ? 'system' : 'actor'

      return `<article class="ops-op" data-text="${escapeXml(text)}">
  <h3><code>${escapeXml(op.method)}</code>${escapeXml(op.title)}</h3>
  <p>${escapeXml(op.description)}</p>
  <span class="ops-who" data-kind="${kind}">${escapeXml(op.callers)}</span>
  <pre class="ops-params">${escapeXml(op.params)}</pre>
</article>`
    })

    return `<section class="ops-domain" data-text="${escapeXml(domainText)}">
  <h2>${escapeXml(domain.title)}<code>${escapeXml(domain.key)}</code></h2>
  <p>${escapeXml(domain.description)}</p>
  ${operations.join('\n  ')}
</section>`
  })

  return `<!doctype html>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Операции</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap" />
<style>${pageThemeCss([])}
${css}</style>
<header class="ops-head">
  <h1>Операции</h1>
  <span class="ops-meta">${escapeXml(summaryOf(model))}</span>
  <input id="ops-filter" type="search" autocomplete="off" spellcheck="false" placeholder="Домен, операция, роль…" aria-label="Фильтр операций" />
  <a href="${escapeXml(mapHref)}">Карта схемы</a>
</header>
<main>
${domains.join('\n')}
<p class="ops-empty" id="ops-empty" hidden>Ничего не найдено</p>
</main>
<script>${script}</script>
`
}
