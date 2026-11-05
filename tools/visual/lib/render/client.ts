/**
 * Скрипт страницы карты. Транспилируется в JS при генерации и встраивается в HTML; импортов нет.
 * Масштаб и панорама — через viewBox, подсветка — классами на SVG, досье — из встроенной модели.
 */

interface ClientField {
  name: string
  path: string
  kind: string
  type?: string
  tsType?: string
  decorators?: string[]
  typeRefs?: string[]
  nullable?: boolean
  values?: (string | number)[]
  target?: string
  onDelete?: string
  doc?: string
  fields?: ClientField[]
}

interface ClientEntity {
  key: string
  model: string
  file: string
  namespace?: string
  idKey: string
  idType: string
  discriminatorKey?: string
  doc?: string
  decorators?: string[]
  fields: ClientField[]
  variants: {
    value: string
    model: string
    doc?: string
    decorators?: string[]
    fields: ClientField[]
  }[]
}

interface ClientRelation {
  id: string
  source: string
  target: string
  kind: 'own' | 'ref' | 'set'
  field: string
  ownerField?: string
  onDelete: string
  nullable: boolean
  variant?: string
}

interface ClientData {
  generatedAt: string
  zones: { id: string; title: string; colorVar: string }[]
  entities: ClientEntity[]
  types: Record<string, string>
  relations: ClientRelation[]
  zoneOf: Record<string, string>
  hubs: string[]
  sources: Record<string, number>
  size: { width: number; height: number }
}

;(() => {
  const DATA: ClientData = JSON.parse(document.getElementById('xv-data')!.textContent!)
  const DEBUG = /[?&]debug\b/.test(location.search)
  const errors: string[] = []
  window.addEventListener('error', (e) => errors.push(String(e.message)))

  const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
    root.querySelector(selector) as T
  const esc = (value: unknown) =>
    String(value).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
    )
  const md = (text: string) => esc(text).replace(/`([^`]+)`/g, '<code>$1</code>')
  const plural = (n: number, forms: [string, string, string]) => {
    const m10 = n % 10
    const m100 = n % 100
    const form =
      m10 === 1 && m100 !== 11 ? 0 : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? 1 : 2
    return `${n} ${forms[form]}`
  }
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

  const byKey = new Map(DATA.entities.map((e) => [e.key, e]))
  const zoneById = new Map(DATA.zones.map((z) => [z.id, z]))
  const hubs = new Set(DATA.hubs)
  const outgoing = new Map<string, ClientRelation[]>(DATA.entities.map((e) => [e.key, []]))
  const incoming = new Map<string, ClientRelation[]>(DATA.entities.map((e) => [e.key, []]))
  for (const r of DATA.relations) {
    outgoing.get(r.source)!.push(r)
    incoming.get(r.target)!.push(r)
  }
  const ownerOf = new Map(DATA.relations.filter((r) => r.kind === 'own').map((r) => [r.target, r]))
  const zoneColor = (key: string) => `var(${zoneById.get(DATA.zoneOf[key])?.colorVar ?? '--xv-muted'})`

  /** Связь, нарисованная от строки карточки: поле-ссылка, has-many родителя или BelongsTo ребёнка. */
  const relationOfRow = (key: string, path: string) =>
    DATA.relations.find((r) => r.source === key && r.field === path) ??
    DATA.relations.find((r) => r.kind === 'own' && r.target === key && r.ownerField === path)

  const countFields = (fields: ClientField[]): number =>
    fields.reduce((n, f) => n + (f.fields ? countFields(f.fields) : 1), 0)
  const fieldCount = (e: ClientEntity) =>
    countFields(e.fields) + e.variants.reduce((n, v) => n + countFields(v.fields), 0)
  const paths = (e: ClientEntity) => {
    const list: string[] = []
    const walk = (fields: ClientField[]) =>
      fields.forEach((f) => {
        list.push(f.path.toLowerCase())
        if (f.fields) walk(f.fields)
      })
    walk(e.fields)
    e.variants.forEach((v) => walk(v.fields))
    return list
  }
  const haystack = new Map(
    DATA.entities.map((e) => [e.key, [e.key.toLowerCase(), e.model.toLowerCase(), ...paths(e)]])
  )

  // ── состояние

  const state = {
    selected: null as string | null,
    hover: null as string | null,
    hoverEdge: null as string | null,
    /** Закреплённое поле: его связи подсвечены, остальное блекнет и не реагирует на курсор. */
    pin: null as { key: string; path: string } | null,
    /** Выбор модели до закрепления поля — к нему возвращаемся, когда поле открепляют. */
    beforePin: null as string | null,
    query: '',
    hubMode: 'lines' as 'lines' | 'shortcuts'
  }
  try {
    const saved = localStorage.getItem('xv-hub-mode')
    if (saved === 'lines' || saved === 'shortcuts') state.hubMode = saved
  } catch {}

  const svg = $<SVGSVGElement>('.xv-map')
  const stage = $('#xv-stage')
  const tip = $('#xv-tip')
  const search = $<HTMLInputElement>('#xv-search')
  const cardEls = new Map<string, SVGGElement>()
  svg.querySelectorAll<SVGGElement>('.xv-card').forEach((el) => cardEls.set(el.dataset.key!, el))
  const layer = (name: string) => svg.querySelector<SVGGElement>(`.xv-edges[data-layer="${name}"]`)!
  const activeLayer = () => layer(state.hubMode === 'lines' ? 'all' : 'nohub')

  // ── вид: панорама и масштаб через viewBox

  const view = { x: 0, y: 0, k: 1 }
  const MIN_K = 0.08
  const MAX_K = 2.5
  const LOD_K = 0.5

  const applyView = () => {
    const w = stage.clientWidth
    const h = stage.clientHeight
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${w / view.k} ${h / view.k}`)
    svg.classList.toggle('lod-far', view.k < LOD_K)
    svg.style.setProperty('--xv-inv', String(1 / view.k))
    const zoom = $('#xv-zoom')
    if (zoom) zoom.textContent = `${Math.round(view.k * 100)}%`
  }

  let animation = 0
  const animateTo = (target: { x: number; y: number; k: number }) => {
    cancelAnimationFrame(animation)
    if (reducedMotion) {
      Object.assign(view, target)
      return applyView()
    }
    const from = { ...view }
    const started = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / 280)
      const ease = 1 - Math.pow(1 - t, 3)
      view.x = from.x + (target.x - from.x) * ease
      view.y = from.y + (target.y - from.y) * ease
      view.k = from.k + (target.k - from.k) * ease
      applyView()
      if (t < 1) animation = requestAnimationFrame(step)
    }
    animation = requestAnimationFrame(step)
  }

  // Сверху карту перекрывают плавающие панели: вписываем её в область под ними
  const TOP_INSET = 56
  const fitBox = (box: { x: number; y: number; w: number; h: number }, padding = 40, maxK = MAX_K) => {
    const w = stage.clientWidth
    const h = stage.clientHeight - TOP_INSET
    const k = Math.max(MIN_K, Math.min(maxK, (w - padding * 2) / box.w, (h - padding * 2) / box.h))
    return { x: box.x + box.w / 2 - w / 2 / k, y: box.y + box.h / 2 - (TOP_INSET + h / 2) / k, k }
  }
  const fitAll = (animate = true) => {
    const target = fitBox({ x: 0, y: 0, w: DATA.size.width, h: DATA.size.height }, 24)
    if (animate) animateTo(target)
    else {
      Object.assign(view, target)
      applyView()
    }
  }
  const cardBox = (key: string) => {
    const el = cardEls.get(key)
    if (!el) return null
    const m = /translate\(([-\d.]+)[ ,]([-\d.]+)\)/.exec(el.getAttribute('transform') || '')
    const bg = el.querySelector('.xv-card-bg')!
    return {
      x: Number(m ? m[1] : 0),
      y: Number(m ? m[2] : 0),
      w: Number(bg.getAttribute('width')),
      h: Number(bg.getAttribute('height'))
    }
  }
  const reveal = (key: string) => {
    const keys = [key, ...neighbors(key)]
    const boxes = keys.map(cardBox).filter(Boolean) as { x: number; y: number; w: number; h: number }[]
    const x1 = Math.min(...boxes.map((b) => b.x))
    const y1 = Math.min(...boxes.map((b) => b.y))
    const x2 = Math.max(...boxes.map((b) => b.x + b.w))
    const y2 = Math.max(...boxes.map((b) => b.y + b.h))
    animateTo(fitBox({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, 60, 1.1))
  }
  const revealZone = (id: string) => {
    const zone = svg.querySelector(`.xv-zone[data-zone="${CSS.escape(id)}"] .xv-zone-bg`)
    if (!zone) return
    const n = (name: string) => Number(zone.getAttribute(name))
    animateTo(fitBox({ x: n('x'), y: n('y'), w: n('width'), h: n('height') }, 30))
  }

  const toMap = (clientX: number, clientY: number) => {
    const rect = stage.getBoundingClientRect()
    return { x: view.x + (clientX - rect.left) / view.k, y: view.y + (clientY - rect.top) / view.k }
  }

  stage.addEventListener(
    'wheel',
    (e) => {
      if ((e.target as Element).closest('.xv-legend, .xv-float')) return
      e.preventDefault()
      cancelAnimationFrame(animation)
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))
      const k = Math.max(MIN_K, Math.min(MAX_K, view.k * factor))
      const p = toMap(e.clientX, e.clientY)
      const rect = stage.getBoundingClientRect()
      view.k = k
      view.x = p.x - (e.clientX - rect.left) / k
      view.y = p.y - (e.clientY - rect.top) / k
      applyView()
    },
    { passive: false }
  )

  let drag: { id: number; x: number; y: number; vx: number; vy: number; moved: boolean } | null = null
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (e.target as Element).closest('.xv-legend, .xv-float')) return
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }
  })
  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (!drag.moved && Math.hypot(dx, dy) < 4) return
    if (!drag.moved) {
      drag.moved = true
      stage.classList.add('is-panning')
      hideTip()
    }
    view.x = drag.vx - dx / view.k
    view.y = drag.vy - dy / view.k
    applyView()
  })
  window.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    const moved = drag.moved
    drag = null
    stage.classList.remove('is-panning')
    if (moved) return
    const target = e.target as Element
    const card = target.closest<SVGGElement>('.xv-card')
    const edge = target.closest<SVGGElement>('.xv-edge')
    const row = target.closest<SVGGElement>('.xv-row')
    if (card && row) {
      // Клик по полю закрепляет его связи, повторный — снимает
      togglePin(card.dataset.key!, row.dataset.path!)
    } else if (card) {
      // Клик по шапке (или по карточке в обзорном масштабе) выбирает модель, повторный — снимает выбор
      const key = card.dataset.key!
      select(state.selected === key && !state.pin ? null : key)
    } else if (edge) {
      togglePin(edge.dataset.source!, edge.dataset.field!)
    } else if (stage.contains(target)) {
      select(null)
    }
  })

  // ── подсветка

  function neighbors(key: string) {
    const keys = new Set<string>()
    activeLayer()
      .querySelectorAll<SVGGElement>('.xv-edge')
      .forEach((el) => {
        if (el.dataset.source === key) keys.add(el.dataset.target!)
        if (el.dataset.target === key) keys.add(el.dataset.source!)
      })
    // В режиме ярлыков у выбранной коллекции видны и её связи с хабами
    if (state.hubMode === 'shortcuts') {
      for (const r of [...outgoing.get(key)!, ...incoming.get(key)!])
        keys.add(r.source === key ? r.target : r.source)
    }
    keys.delete(key)
    return [...keys]
  }

  /**
   * Связи строки: поле-ссылка и has-many — свои, BelongsTo — композиция родителя, ключ — все входящие
   * ссылки, плашка embedded-блока и заголовок варианта — связи всех полей внутри.
   */
  const relationsOfRow = (key: string, path: string) => {
    const entity = byKey.get(key)
    if (path.startsWith('@')) {
      const variant = path.slice(1)
      return DATA.relations.filter((r) => r.source === key && r.variant === variant)
    }
    const inside = (field?: string) =>
      field !== undefined && (field === path || field.startsWith(`${path}.`))
    const list = DATA.relations.filter(
      (r) =>
        (r.source === key && inside(r.field)) ||
        (r.kind === 'own' && r.target === key && inside(r.ownerField))
    )
    if (entity && path === entity.idKey) {
      list.push(...DATA.relations.filter((r) => r.target === key && r.kind !== 'own'))
    }
    return [...new Set(list)]
  }

  /** Строки на концах связи: поле-источник и ключ цели либо has-many родителя и BelongsTo ребёнка. */
  const relationEnds = (r: ClientRelation) => {
    if (r.kind === 'own') {
      return [
        { key: r.source, path: r.field },
        { key: r.target, path: r.ownerField ?? byKey.get(r.target)!.idKey }
      ]
    }
    return [
      { key: r.source, path: r.field },
      { key: r.target, path: byKey.get(r.target)!.idKey }
    ]
  }

  const rowEl = (key: string, path: string) =>
    cardEls.get(key)?.querySelector<SVGGElement>(`.xv-row[data-path="${CSS.escape(path)}"]`)

  /** Закреплённый режим — выбрана модель или поле: фокус не меняется от движения курсора. */
  const isPinned = () => Boolean(state.pin || state.selected)

  const applyFocus = () => {
    svg
      .querySelectorAll('.is-on, .is-selected, .is-pinned, .is-linked')
      .forEach((el) => el.classList.remove('is-on', 'is-selected', 'is-pinned', 'is-linked'))
    svg.classList.toggle('is-locked', isPinned())
    if (state.selected) cardEls.get(state.selected)?.classList.add('is-selected')

    if (state.pin) {
      const { key, path } = state.pin
      svg.classList.add('has-focus')
      cardEls.get(key)?.classList.add('is-on')
      rowEl(key, path)?.classList.add('is-pinned')
      for (const r of relationsOfRow(key, path)) {
        svg
          .querySelectorAll(`.xv-edge[data-id="${CSS.escape(r.id)}"]`)
          .forEach((el) => el.classList.add('is-on'))
        for (const end of relationEnds(r)) {
          cardEls.get(end.key)?.classList.add('is-on')
          const el = rowEl(end.key, end.path)
          if (el && !el.classList.contains('is-pinned')) el.classList.add('is-linked')
        }
      }
      return
    }

    if (!isPinned() && state.hoverEdge) {
      svg.classList.add('has-focus')
      svg
        .querySelectorAll<SVGGElement>(`.xv-edge[data-id="${CSS.escape(state.hoverEdge)}"]`)
        .forEach((el) => {
          el.classList.add('is-on')
          cardEls.get(el.dataset.source!)?.classList.add('is-on')
          cardEls.get(el.dataset.target!)?.classList.add('is-on')
        })
      return
    }

    const key = isPinned() ? state.selected : state.hover
    svg.classList.toggle('has-focus', Boolean(key))
    if (!key) return
    cardEls.get(key)?.classList.add('is-on')
    svg.querySelectorAll<SVGGElement>('.xv-edge').forEach((el) => {
      if (el.dataset.source === key || el.dataset.target === key) el.classList.add('is-on')
    })
    neighbors(key).forEach((k) => cardEls.get(k)?.classList.add('is-on'))
  }

  function togglePin(key: string, path: string) {
    if (state.pin && state.pin.key === key && state.pin.path === path) {
      const back = state.beforePin
      state.pin = null
      state.beforePin = null
      select(back)
      return
    }
    if (!state.pin) state.beforePin = state.selected
    state.pin = { key, path }
    state.selected = key
    try {
      history.replaceState(null, '', `#${key}`)
    } catch {}
    hideTip()
    applyFocus()
  }

  svg.addEventListener('pointerover', (e) => {
    if (drag?.moved) return
    const target = e.target as Element
    const row = target.closest<SVGGElement>('.xv-row')
    const card = target.closest<SVGGElement>('.xv-card')
    const edge = target.closest<SVGGElement>('.xv-edge')
    // Шапка модели; в обзорном масштабе строк не видно, и подсказку модели даёт вся карточка
    const onHead = Boolean(
      card &&
      !row &&
      (target.closest('.xv-card-head, .xv-card-title, .xv-card-badge') ||
        svg.classList.contains('lod-far'))
    )

    // В закреплённом режиме фокус не меняется; подсказки — только у подсвеченных карточек и связей
    if (isPinned()) {
      const live =
        (card && card.classList.contains('is-on')) || (!card && edge?.classList.contains('is-on'))
      if (!live) return hideTip()
      if (row && card) {
        const relation = relationOfRow(card.dataset.key!, row.dataset.path!)
        const html = relation
          ? relationTip(relation, fieldIndex.get(card.dataset.key!)?.get(row.dataset.path!))
          : fieldTip(card.dataset.key!, row.dataset.path!)
        if (html) showTip(html, e as PointerEvent)
        else hideTip()
      } else if (card && onHead) {
        showTip(modelTip(card.dataset.key!), e as PointerEvent)
      } else if (edge && !card) {
        const relation = DATA.relations.find((r) => r.id === edge.dataset.id)
        if (relation) showTip(relationTip(relation), e as PointerEvent)
      } else hideTip()
      return
    }

    if (row && card) {
      const relation = relationOfRow(card.dataset.key!, row.dataset.path!)
      state.hoverEdge = relation ? relation.id : null
      state.hover = relation ? null : card.dataset.key!
      const html = relation
        ? relationTip(relation, fieldIndex.get(card.dataset.key!)?.get(row.dataset.path!))
        : fieldTip(card.dataset.key!, row.dataset.path!)
      if (html) showTip(html, e as PointerEvent)
      else hideTip()
    } else if (card) {
      state.hover = card.dataset.key!
      state.hoverEdge = null
      if (onHead) showTip(modelTip(card.dataset.key!), e as PointerEvent)
      else hideTip()
    } else if (edge) {
      state.hoverEdge = edge.dataset.id!
      state.hover = null
      const relation = DATA.relations.find((r) => r.id === edge.dataset.id)
      if (relation) showTip(relationTip(relation), e as PointerEvent)
    } else {
      state.hover = null
      state.hoverEdge = null
      hideTip()
    }
    applyFocus()
  })
  svg.addEventListener('pointerleave', () => {
    state.hover = null
    state.hoverEdge = null
    hideTip()
    applyFocus()
  })
  stage.addEventListener('pointermove', (e) => {
    if (!tip.hidden) moveTip(e.clientX, e.clientY)
  })

  // ── подсказка

  const fieldIndex = new Map<string, Map<string, ClientField>>()
  for (const entity of DATA.entities) {
    const index = new Map<string, ClientField>()
    const walk = (fields: ClientField[]) =>
      fields.forEach((f) => {
        index.set(f.path, f)
        if (f.fields) walk(f.fields)
      })
    walk(entity.fields)
    entity.variants.forEach((v) => walk(v.fields))
    fieldIndex.set(entity.key, index)
  }

  /** Декораторы свойства, как в исходнике схемы; имя декоратора выделено. */
  const decoratorHtml = (decorators?: string[]) =>
    decorators?.length
      ? `<div class="tip-code">${decorators
          .map((d) => esc(d).replace(/^(@[\w.]+)/, '<span class="tip-dec">$1</span>'))
          .join('<br>')}</div>`
      : ''

  // Подсветка TS в подсказке: комментарии, строки, ключевые слова и имена типов
  const TS_TOKENS =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")|\b(interface|type|enum|extends|keyof|typeof|readonly|null|undefined|never|unknown|string|number|boolean|true|false)\b|\b([A-Z][A-Za-z0-9_]*)\b/g
  const highlightTs = (code: string) => {
    let html = ''
    let last = 0
    for (const m of code.matchAll(TS_TOKENS)) {
      html += esc(code.slice(last, m.index))
      const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : 't'
      html += `<span class="ts-${cls}">${esc(m[0])}</span>`
      last = m.index! + m[0].length
    }
    return html + esc(code.slice(last))
  }

  const MAX_CODE_LINES = 60

  /** Тип json-поля кодом: строка поля и объявления типов, на которые она ссылается. */
  const typeCodeHtml = (field: ClientField) => {
    if (!field.typeRefs) return ''
    const blocks = [`${field.name}: ${field.tsType ?? 'unknown'}`]
    let lines = 1
    let skipped = 0
    for (const id of field.typeRefs) {
      const text = DATA.types[id]
      if (!text) continue
      const count = text.split('\n').length
      if (lines + count > MAX_CODE_LINES) {
        skipped++
        continue
      }
      blocks.push(text)
      lines += count + 1
    }
    if (skipped) blocks.push(`// … ещё ${plural(skipped, ['объявление', 'объявления', 'объявлений'])}`)
    return `<pre class="tip-pre">${highlightTs(blocks.join('\n\n'))}</pre>`
  }

  /** Подсказка у строки без связи: тип, значения литерала и JSDoc поля, у плашек — описание блока. */
  const fieldTip = (key: string, path: string) => {
    const entity = byKey.get(key)
    if (!entity) return ''
    if (path.startsWith('@')) {
      const variant = entity.variants.find((v) => `@${v.value}` === path)
      if (!variant) return ''
      return (
        `<b>${esc(entity.discriminatorKey)} = ${esc(variant.value)}</b> <span class="muted">${esc(variant.model)}</span>` +
        `<div class="muted">поля ниже есть только у этого варианта</div>` +
        decoratorHtml(variant.decorators) +
        (variant.doc ? `<div>${md(variant.doc)}</div>` : '')
      )
    }
    const field = fieldIndex.get(key)?.get(path)
    if (!field) return ''
    const type =
      field.kind === 'embedded'
        ? `embedded · ${field.type ?? ''}`
        : field.kind === 'id'
          ? `PK · ${field.type ?? ''}`
          : displayType(field)
    return (
      `<b>${esc(key)}.${esc(path)}</b>${field.nullable ? '<span class="muted">?</span>' : ''} <span class="muted">${esc(type)}</span>` +
      decoratorHtml(field.decorators) +
      typeCodeHtml(field) +
      (field.kind === 'embedded'
        ? '<div class="muted">часть документа, не отдельная коллекция</div>'
        : '') +
      (field.values ? `<div class="muted">${field.values.map(esc).join(' | ')}</div>` : '') +
      (field.doc ? `<div class="tip-doc">${md(field.doc)}</div>` : '')
    )
  }

  const DELETE_TEXT: Record<string, string> = {
    cascade: 'удаление родителя удалит детей',
    restrict: 'удаление цели запрещено, пока есть ссылка',
    'set-null': 'при удалении цели ссылка станет null',
    unlink: 'при удалении цели id уберётся из набора'
  }
  const KIND_TEXT: Record<string, string> = { own: 'композиция', ref: 'ссылка', set: 'набор ссылок' }
  /** Подсказка у связи; декоратор — того поля, на которое навели, по умолчанию поля-источника. */
  const relationTip = (r: ClientRelation, field = fieldIndex.get(r.source)?.get(r.field)) => {
    const from = `${r.source}.${r.field}`
    const del =
      r.kind === 'own' && r.onDelete === 'restrict'
        ? 'родителя нельзя удалить, пока есть дети'
        : DELETE_TEXT[r.onDelete]
    return (
      `<b>${esc(from)}</b> <span style="color:${zoneColor(r.kind === 'own' ? r.source : r.target)}">→ ${esc(r.target)}</span>` +
      `<div class="muted">${KIND_TEXT[r.kind]}${r.variant ? ` · только ${esc(r.variant)}` : ''}${r.nullable ? ' · может быть null' : ''}</div>` +
      `<div><span class="del ${esc(r.onDelete)}">${esc(r.onDelete)}</span> ${esc(del)}</div>` +
      decoratorHtml(field?.decorators) +
      (field?.doc ? `<div class="tip-doc">${md(field.doc)}</div>` : '')
    )
  }
  const moveTip = (x: number, y: number) => {
    const rect = tip.getBoundingClientRect()
    const left = Math.min(x + 14, window.innerWidth - rect.width - 8)
    const top = y + 18 + rect.height > window.innerHeight ? y - rect.height - 12 : y + 18
    tip.style.left = `${Math.max(8, left)}px`
    tip.style.top = `${Math.max(8, top)}px`
  }
  const showTip = (html: string, e: PointerEvent) => {
    tip.innerHTML = html
    tip.hidden = false
    moveTip(e.clientX, e.clientY)
  }
  function hideTip() {
    tip.hidden = true
  }

  // ── поиск

  const applySearch = () => {
    const q = state.query.trim().toLowerCase()
    svg.classList.toggle('has-search', q !== '')
    let count = 0
    cardEls.forEach((el, key) => {
      const match = q !== '' && haystack.get(key)!.some((s) => s.includes(q))
      el.classList.toggle('match', match)
      if (match) count++
      el.querySelectorAll<SVGGElement>('.xv-row').forEach((row) => {
        row.classList.toggle('match', q !== '' && (row.dataset.path || '').toLowerCase().includes(q))
      })
    })
    $('#xv-search-count').textContent = q ? String(count) : ''
  }
  search.addEventListener('input', () => {
    state.query = search.value
    applySearch()
  })
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = state.query.trim().toLowerCase()
      const exact = DATA.entities.find((x) => x.key.toLowerCase() === q)
      const first = exact ?? DATA.entities.find((x) => haystack.get(x.key)!.some((s) => s.includes(q)))
      if (first) select(first.key, { reveal: true })
    } else if (e.key === 'Escape') {
      search.value = ''
      state.query = ''
      applySearch()
      search.blur()
    }
  })

  // ── режим хабов

  const applyHubMode = () => {
    svg.classList.toggle('mode-shortcuts', state.hubMode === 'shortcuts')
    document.querySelectorAll<HTMLButtonElement>('[data-hub-mode]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.hubMode === state.hubMode))
    })
    try {
      localStorage.setItem('xv-hub-mode', state.hubMode)
    } catch {}
    applyFocus()
  }
  document.querySelectorAll<HTMLButtonElement>('[data-hub-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      state.hubMode = b.dataset.hubMode as 'lines' | 'shortcuts'
      applyHubMode()
    })
  )

  // ── подсказка модели

  const displayType = (f: ClientField) => {
    const ts = f.tsType ? f.tsType.replace(/\s*\|\s*null$/, '') : ''
    return ts && ts !== f.type ? ts : f.type || ''
  }

  const embeddedCount = (fields: ClientField[]): number =>
    fields.reduce((n, f) => n + (f.kind === 'embedded' ? 1 + embeddedCount(f.fields || []) : 0), 0)

  const listText = (items: string[], max = 4) =>
    items.length > max
      ? `${items.slice(0, max).join(', ')} и ещё ${items.length - max}`
      : items.join(', ')

  /** Что будет при удалении записи: запреты, каскад, обнуляемые ссылки. */
  const impactLines = (key: string) => {
    const children = outgoing.get(key)!.filter((r) => r.kind === 'own')
    const refsIn = incoming.get(key)!.filter((r) => r.kind !== 'own')
    const blocked = [
      ...children.filter((r) => r.onDelete === 'restrict').map((r) => r.target),
      ...refsIn.filter((r) => r.onDelete === 'restrict').map((r) => `${r.source}.${r.field}`)
    ]
    const cascade = children.filter((r) => r.onDelete === 'cascade').map((r) => r.target)
    const soft = refsIn.filter((r) => r.onDelete !== 'restrict').map((r) => `${r.source}.${r.field}`)
    const lines: string[] = []
    if (blocked.length)
      lines.push(
        `<span class="del restrict">restrict</span> запрещено, пока есть ${esc(listText(blocked))}`
      )
    if (cascade.length)
      lines.push(`<span class="del cascade">cascade</span> удалятся вместе: ${esc(listText(cascade))}`)
    if (soft.length)
      lines.push(
        `<span class="del set-null">set-null</span> обнулятся или отвяжутся: ${esc(listText(soft))}`
      )
    return lines.length ? lines : ['удаляется без последствий: на неё не ссылаются, состава нет']
  }

  /** Подсказка на шапке модели: описание из JSDoc класса, декоратор, состав и последствия удаления. */
  const modelTip = (key: string) => {
    const e = byKey.get(key)
    if (!e) return ''
    const zone = zoneById.get(DATA.zoneOf[key])
    const blocks = embeddedCount(e.fields) + e.variants.reduce((n, v) => n + embeddedCount(v.fields), 0)
    const meta = [
      `ключ <code>${esc(e.idKey)}: ${esc(e.idType)}</code>`,
      plural(fieldCount(e), ['поле', 'поля', 'полей']),
      blocks ? plural(blocks, ['embedded-блок', 'embedded-блока', 'embedded-блоков']) : ''
    ].filter(Boolean)
    const links = `связей: исходящих ${outgoing.get(key)!.length}, входящих ${incoming.get(key)!.length}${
      hubs.has(key) ? `; хаб — ссылаются ${DATA.sources[key]} коллекций` : ''
    }`
    return (
      `<b>${esc(key)}</b>` +
      (zone
        ? ` <span class="tip-zone" style="color: var(${zone.colorVar})">${esc(zone.id)} · ${esc(zone.title)}</span>`
        : '') +
      `<div class="muted">модель ${esc(e.model)} · ${esc(e.file)}${e.namespace ? ` · ${esc(e.namespace)}` : ''}</div>` +
      decoratorHtml(e.decorators) +
      (e.doc ? `<div class="tip-doc">${md(e.doc)}</div>` : '') +
      `<div class="tip-meta">${meta.join(' · ')}</div>` +
      `<div class="tip-meta">${links}</div>` +
      (e.variants.length
        ? `<div class="tip-meta">варианты <code>${esc(e.discriminatorKey)}</code>: ${e.variants
            .map((v) => `${esc(v.value)} — ${esc(v.model)}`)
            .join(', ')}</div>`
        : '') +
      `<div class="tip-impact"><div class="muted">при удалении записи</div>${impactLines(key)
        .map((line) => `<div>${line}</div>`)
        .join('')}</div>`
    )
  }

  // ── легенда

  const legendEl = $('#xv-legend')
  const legendButton = $<HTMLButtonElement>('#xv-legend-toggle')

  const legendHtml = () => {
    const sample = (inner: string) =>
      `<svg width="44" height="14" viewBox="0 0 44 14" aria-hidden="true">${inner}</svg>`
    const line = (dash = '') =>
      `<line x1="2" y1="7" x2="33" y2="7" stroke="currentColor" stroke-width="1.4"${dash}/>`
    const arrow = (fill: string) =>
      `<path d="M42,7 L33,2.5 L33,11.5 Z" fill="${fill}" stroke="currentColor" stroke-width="1.2"/>`
    const diamond = (fill: string) =>
      `<path d="M2,7 L9.5,2.5 L17,7 L9.5,11.5 Z" fill="${fill}" stroke="currentColor"/><line x1="17" y1="7" x2="42" y2="7" stroke="currentColor" stroke-width="2"/>`
    const items = [
      [
        sample(line() + arrow('currentColor')),
        'Ссылка',
        'обязательная, удаление цели запрещено (restrict)'
      ],
      [sample(line() + arrow('var(--xv-surface)')), 'Полая стрелка', 'ссылка может быть null'],
      [
        sample(line(' stroke-dasharray="5 4"') + arrow('var(--xv-surface)')),
        'Пунктир',
        'при удалении цели ссылка обнулится или уйдёт из набора'
      ],
      [
        sample(
          `<path d="M2,2 L12,7 L2,12 M2,7 L12,7" fill="none" stroke="currentColor" stroke-width="1.2"/>` +
            `<line x1="12" y1="7" x2="33" y2="7" stroke="currentColor" stroke-width="1.4"/>` +
            arrow('currentColor')
        ),
        'Воронья лапка',
        'набор ссылок: массив id в поле'
      ],
      [sample(diamond('currentColor')), 'Ромб', 'композиция: дети удалятся вместе с родителем'],
      [
        sample(diamond('var(--xv-surface)')),
        'Полый ромб',
        'композиция: родителя нельзя удалить, пока есть дети'
      ],
      [
        sample(
          `<defs><pattern id="xv-lg-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" stroke-width="1.4" stroke-opacity="0.45"/></pattern></defs>` +
            `<rect x="1.5" y="1.5" width="41" height="11" rx="1" fill="url(#xv-lg-hatch)" stroke="currentColor" stroke-opacity="0.5"/>`
        ),
        'Штриховка',
        'embedded-блок: часть документа, не отдельная коллекция'
      ],
      [
        sample(
          `<rect x="1.5" y="1.5" width="41" height="11" rx="1" fill="currentColor" fill-opacity="0.18"/>`
        ),
        'Сплошная полоса',
        'вариант дискриминатора: ниже поля только этого типа'
      ]
    ]
    let html = `<div class="lg-head"><b>Легенда</b><button type="button" class="lg-close" data-close aria-label="Закрыть легенду">×</button></div>`
    html += `<p class="quiet">${plural(DATA.entities.length, ['коллекция', 'коллекции', 'коллекций'])}, ${plural(DATA.relations.length, ['связь', 'связи', 'связей'])}. Линия выходит из строки поля и окрашена в цвет зоны, куда ведёт.</p>`
    html += '<section><h3>Обозначения</h3><div class="legend">'
    html += items
      .map(
        ([svgHtml, title, hint]) =>
          `<div class="lg">${svgHtml}<span>${title}<small>${hint}</small></span></div>`
      )
      .join('')
    html += '</div></section><section><h3>Зоны</h3><div class="zones">'
    html += DATA.zones
      .map((z) => {
        const count = DATA.entities.filter((e) => DATA.zoneOf[e.key] === z.id).length
        return `<button type="button" class="zone-row" data-zone="${esc(z.id)}" style="--t: var(${z.colorVar})"><span class="zone-dot"></span><span>${esc(z.id)} · ${esc(z.title)}</span><span class="quiet">${count}</span></button>`
      })
      .join('')
    html += '</div></section>'
    if (hubs.size) {
      html += `<section><h3>Хабы</h3><p class="quiet">${[...hubs]
        .map(
          (h) =>
            `<button type="button" class="ent-link" data-key="${esc(h)}" style="--t:${zoneColor(h)}">${esc(h)}</button> — ${DATA.sources[h]} источников`
        )
        .join(
          ', '
        )}. В режиме «Ярлыки» их связи не рисуются линиями: цель видна в строке поля, а линия появляется при выделении.</p></section>`
    }
    html +=
      '<section><h3>Как пользоваться</h3><ul class="keys">' +
      '<li>наведение на шапку модели — описание модели, на поле — тип, декоратор и JSDoc</li>' +
      '<li>клик по шапке — закрепить связи модели, по полю — связи поля; повторный клик снимает</li>' +
      '<li><kbd>/</kbd>поиск по коллекциям и полям</li><li><kbd>0</kbd>вписать карту</li>' +
      '<li><kbd>?</kbd>легенда</li><li><kbd>Esc</kbd>сбросить выделение</li></ul></section>'
    html += `<p class="quiet foot">Собрано ${esc(new Date(DATA.generatedAt).toLocaleString('ru-RU'))}</p>`
    return html
  }

  function setLegend(open: boolean) {
    legendEl.hidden = !open
    legendButton.setAttribute('aria-expanded', String(open))
    try {
      localStorage.setItem('xv-legend', open ? 'open' : 'closed')
    } catch {}
  }

  legendEl.innerHTML = legendHtml()
  legendButton.addEventListener('click', () => setLegend(legendEl.hidden))
  legendEl.addEventListener('click', (e) => {
    const target = e.target as Element
    if (target.closest('[data-close]')) return setLegend(false)
    const zone = target.closest<HTMLElement>('[data-zone]')
    if (zone) return revealZone(zone.dataset.zone!)
    const item = target.closest<HTMLElement>('[data-key]')
    if (item) select(item.dataset.key!, { reveal: true })
  })

  function select(key: string | null, options: { reveal?: boolean } = {}) {
    state.pin = null
    state.beforePin = null
    state.hover = null
    state.hoverEdge = null
    state.selected = key && byKey.has(key) ? key : null
    try {
      history.replaceState(
        null,
        '',
        state.selected ? `#${state.selected}` : location.pathname + location.search
      )
    } catch {}
    applyFocus()
    if (state.selected && options.reveal) reveal(state.selected)
  }

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(
      (document.activeElement as HTMLElement | null)?.tagName || ''
    )
    if (typing) return
    if (e.key === '/') {
      e.preventDefault()
      search.focus()
      search.select()
    } else if (e.key === 'Escape') {
      select(null)
    } else if (e.key === '?') {
      setLegend(legendEl.hidden)
    } else if (e.key === '0') {
      fitAll()
    } else if (e.key === '+' || e.key === '=' || e.key === '-') {
      const factor = e.key === '-' ? 1 / 1.25 : 1.25
      const w = stage.clientWidth / view.k
      const h = stage.clientHeight / view.k
      const k = Math.max(MIN_K, Math.min(MAX_K, view.k * factor))
      animateTo({
        x: view.x + w / 2 - stage.clientWidth / 2 / k,
        y: view.y + h / 2 - stage.clientHeight / 2 / k,
        k
      })
    }
  })

  const onTheme = () => applyView()
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onTheme)

  // ── запуск

  let legendOpen = false
  try {
    legendOpen = localStorage.getItem('xv-legend') === 'open'
  } catch {}
  setLegend(legendOpen)

  // Состояние до перезагрузки: dev-сервер сохраняет его, когда пересобирает карту
  interface Restore {
    view?: { x: number; y: number; k: number }
    selected?: string | null
    pin?: { key: string; path: string } | null
    beforePin?: string | null
    query?: string
  }
  let restore: Restore | null = null
  try {
    restore = JSON.parse(sessionStorage.getItem('xv-restore') || 'null')
    sessionStorage.removeItem('xv-restore')
  } catch {}

  applyHubMode()
  if (restore?.view) {
    Object.assign(view, restore.view)
    applyView()
  } else fitAll(false)

  // При смене размера холста центр видимой области остаётся на месте
  let stageSize = { w: stage.clientWidth, h: stage.clientHeight }
  new ResizeObserver(() => {
    const w = stage.clientWidth
    const h = stage.clientHeight
    if (!w || !h) return
    view.x += (stageSize.w - w) / 2 / view.k
    view.y += (stageSize.h - h) / 2 / view.k
    stageSize = { w, h }
    applyView()
  }).observe(stage)

  const params = new URLSearchParams(location.search)
  const query = restore ? restore.query : params.get('q')
  if (query) {
    search.value = query
    state.query = query
    applySearch()
  }
  if (restore) {
    if (restore.pin && byKey.has(restore.pin.key)) {
      togglePin(restore.pin.key, restore.pin.path)
      state.beforePin = restore.beforePin ?? null
    } else if (restore.selected && byKey.has(restore.selected)) {
      select(restore.selected)
    }
  } else {
    const fromHash = decodeURIComponent(location.hash.slice(1))
    if (byKey.has(fromHash)) select(fromHash, { reveal: true })
    const pinParam = params.get('pin')
    if (pinParam && pinParam.includes('.')) {
      const dot = pinParam.indexOf('.')
      if (byKey.has(pinParam.slice(0, dot))) togglePin(pinParam.slice(0, dot), pinParam.slice(dot + 1))
    }
  }
  if (params.get('hubs') === 'shortcuts' || params.get('hubs') === 'lines') {
    state.hubMode = params.get('hubs') as 'lines' | 'shortcuts'
    applyHubMode()
  }

  ;(window as unknown as { __xv: unknown }).__xv = {
    state: (): Restore => ({
      view: { ...view },
      selected: state.selected,
      pin: state.pin,
      beforePin: state.beforePin,
      query: state.query
    })
  }

  if (DEBUG) {
    const out = $('#xv-debug')
    const sample = DATA.entities[0]
    out.hidden = false
    out.textContent = JSON.stringify({
      errors,
      cards: cardEls.size,
      edgesAll: layer('all').querySelectorAll('.xv-edge').length,
      edgesNohub: layer('nohub').querySelectorAll('.xv-edge').length,
      selected: state.selected,
      pin: state.pin,
      locked: svg.classList.contains('is-locked'),
      focusedEdges: svg.querySelectorAll('.xv-edge.is-on').length,
      focusedCards: svg.querySelectorAll('.xv-card.is-on').length,
      searchMatches: svg.querySelectorAll('.xv-card.match').length,
      restored: Boolean(restore),
      floats: [...document.querySelectorAll<HTMLElement>('.xv-float')].map((el) => {
        const r = el.getBoundingClientRect()
        return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]
      }),
      stage: { w: stage.clientWidth, h: stage.clientHeight },
      view: { ...view },
      lod: svg.classList.contains('lod-far'),
      hubMode: state.hubMode,
      legend: legendEl.hidden ? 'closed' : 'open',
      blockRows: svg.querySelectorAll('.xv-row.block').length,
      variantRows: svg.querySelectorAll('.xv-row.variant').length,
      modelTip: sample
        ? modelTip(sample.key)
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .slice(0, 300)
        : ''
    })
  }
})()
