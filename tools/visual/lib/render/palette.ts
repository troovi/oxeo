/**
 * Цветовые токены карты. Светлая палитра — по умолчанию, тёмная — по `prefers-color-scheme` и
 * `data-theme="dark"` на корне страницы. Цвета зон приходят из конфига.
 */
import type { ZoneConfig } from '../config'

interface Palette {
  bg: string
  surface: string
  surface2: string
  line: string
  lineStrong: string
  text: string
  muted: string
  faint: string
  onZone: string
  accent: string
  accentQuiet: string
  match: string
  codeString: string
  codeType: string
}

const LIGHT: Palette = {
  bg: '#f6f6f7',
  surface: '#ffffff',
  surface2: '#f1f1f3',
  line: '#e4e4e7',
  lineStrong: '#d4d4d8',
  text: '#18181b',
  muted: '#63636e',
  faint: '#a1a1aa',
  onZone: '#ffffff',
  accent: '#2563eb',
  accentQuiet: '#e0eafd',
  match: '#f2b200',
  codeString: '#a1501b',
  codeType: '#0f7f77'
}

const DARK: Palette = {
  bg: '#0c0c0e',
  surface: '#151518',
  surface2: '#1f1f23',
  line: '#2a2a2f',
  lineStrong: '#3a3a41',
  text: '#f2f2f3',
  muted: '#a3a3ad',
  faint: '#6c6c75',
  onZone: '#0c0c0e',
  accent: '#6ea2ff',
  accentQuiet: '#1a2944',
  match: '#f4c64a',
  codeString: '#f0a868',
  codeType: '#5fd4c4'
}

export const zoneVar = (id: string) => `--xv-zone-${id.replace(/[^A-Za-z0-9_-]/g, '_')}`

const declarations = (palette: Palette, zones: ZoneConfig[], dark: boolean) =>
  [
    dark ? 'color-scheme: dark;' : '',
    `--xv-bg: ${palette.bg};`,
    `--xv-surface: ${palette.surface};`,
    `--xv-surface-2: ${palette.surface2};`,
    `--xv-line: ${palette.line};`,
    `--xv-line-strong: ${palette.lineStrong};`,
    `--xv-text: ${palette.text};`,
    `--xv-muted: ${palette.muted};`,
    `--xv-faint: ${palette.faint};`,
    `--xv-on-zone: ${palette.onZone};`,
    `--xv-accent: ${palette.accent};`,
    `--xv-accent-quiet: ${palette.accentQuiet};`,
    `--xv-match: ${palette.match};`,
    `--xv-code-string: ${palette.codeString};`,
    `--xv-code-type: ${palette.codeType};`,
    ...zones.map((z) => `${zoneVar(z.id)}: ${dark ? (z.colorDark ?? z.color) : z.color};`)
  ]
    .filter(Boolean)
    .join(' ')

/** Токены для страницы: светлые на `:root`, тёмные — по системе и по явному `data-theme`. */
export const pageThemeCss = (zones: ZoneConfig[]) => `
:root { ${declarations(LIGHT, zones, false)} }
@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ${declarations(DARK, zones, true)} } }
:root[data-theme='dark'] { ${declarations(DARK, zones, true)} }`

/** Токены для отдельного SVG-файла: корень — сам `<svg>`. */
export const svgThemeCss = (zones: ZoneConfig[]) => `
.xv-root { ${declarations(LIGHT, zones, false)} }
@media (prefers-color-scheme: dark) { .xv-root { ${declarations(DARK, zones, true)} } }`
