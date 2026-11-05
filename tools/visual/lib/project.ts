/**
 * Конфиг визуализации в целевом проекте — файл `oxeo-visual.config.ts` рядом с `package.json`:
 *
 * ```ts
 * import { defineConfig } from '@oxeo/visual'
 * import { dataScheme } from './scheme'
 *
 * export default defineConfig({
 *   scheme: dataScheme,
 *   sourceDir: './scheme',
 *   bands: [['sales', 'execution'], ['clients', 'people']],
 *   zones: [{ id: 'sales', title: 'Продажи', color: '#e2580b', files: [['sales.ts']] }]
 * })
 * ```
 *
 * Пути считаются от папки файла конфига. Конфиг выполняется в отдельном процессе на каждую сборку, поэтому
 * схема с декораторами загружается заново и изменения в ней подхватываются без перезапуска.
 */
import type { VisualConfig } from './config'
import type { SchemeSource } from './scheme-meta'

export interface OxeoVisualConfig extends VisualConfig {
  /** Схема данных проекта (`new DataScheme({...})`); типизирована структурно — подходит любая версия @oxeo/scheme. */
  scheme: SchemeSource
  /** Папка с классами схемы (`*.ts`): из неё берутся файлы, JSDoc, декораторы и типы полей. */
  sourceDir: string
  /** tsconfig проекта для разрешения типов; по умолчанию — ближайший к файлу конфига. */
  tsconfig?: string
  /**
   * Что ещё отслеживать в `oxeo-visual dev`. Папка конфига отслеживается всегда — этого достаточно, если схема и
   * её импорты лежат внутри проекта.
   */
  watch?: string[]
  /** Куда `oxeo-visual build` пишет `<name>.html` и `<name>.svg`; по умолчанию папка конфига и `scheme-map`. */
  output?: { dir?: string; name?: string }
}

export const defineConfig = (config: OxeoVisualConfig): OxeoVisualConfig => config

export const CONFIG_FILES = [
  'oxeo-visual.config.ts',
  'oxeo-visual.config.cts',
  'oxeo-visual.config.js',
  'oxeo-visual.config.cjs'
]
