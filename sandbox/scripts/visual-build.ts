/**
 * Карта схемы одной версии: конфиг `versions/<version>/xeo-visual.config.ts` в формате `@oxeo/visual`
 * (пути — от его папки), сборка — `buildSchemeMap`, на выходе `<name>.html` и `<name>.svg`. Схема грузится из
 * исходников под `tsx`, как на сервере песочницы; CLI `oxeo-visual` для этого понадобился бы `ts-node`. Зовёт
 * `scripts/visual.js` — процесс на версию.
 *
 *   npx tsx scripts/visual-build.ts versions/v-0.1.32/oxeo-visual.config.ts
 */
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join, relative, resolve } from 'path'
import { OxeoVisualConfig, buildSchemeMap } from '@oxeo/visual'

const TSCONFIG = resolve(__dirname, '../tsconfig.json')

const main = async () => {
  const configPath = resolve(process.argv[2])
  const configDir = dirname(configPath)

  const loaded: { default: OxeoVisualConfig } = await import(configPath)
  const config = loaded.default

  const started = Date.now()
  const options = { sourceDir: resolve(configDir, config.sourceDir), tsconfig: TSCONFIG, config }
  const { html, svg, metrics } = await buildSchemeMap(config.scheme, options)

  const outputDir = resolve(configDir, config.output?.dir ?? '.')
  const base = join(outputDir, config.output?.name ?? 'scheme-map')

  mkdirSync(outputDir, { recursive: true })
  writeFileSync(`${base}.html`, html)
  writeFileSync(`${base}.svg`, svg)

  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  const summary = `коллекций ${metrics.cards}, связей ${metrics.all.routes}, ${seconds} с`

  console.log(`${relative(process.cwd(), base)}.html: ${summary}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
