/**
 * Карта схемы одной версии: конфиг `versions/<version>/xeo-visual.config.ts` в формате `@oxeo/visual`
 * (пути — от его папки), сборка — `buildSchemeMap`, на выходе `<name>.html` и `<name>.svg`. С `operations` в конфиге —
 * ещё страница `<name>-operations.html` и таблица операций в README между маркерами `ops:map`. Схема грузится из
 * исходников под `tsx`, как на сервере песочницы; CLI `oxeo-visual` для этого понадобился бы `ts-node`. Зовёт
 * `scripts/visual.js` — процесс на версию.
 *
 *   npx tsx scripts/visual-build.ts versions/v-0.1.32/oxeo-visual.config.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join, relative, resolve } from 'path'
import {
  OxeoVisualConfig,
  buildSchemeMap,
  extractOperations,
  opsMapBlock,
  renderOperationsPage,
  replaceOpsMap
} from '@oxeo/visual'

const TSCONFIG = resolve(__dirname, '../tsconfig.json')

const main = async () => {
  const configPath = resolve(process.argv[2])
  const configDir = dirname(configPath)

  const loaded: { default: OxeoVisualConfig } = await import(configPath)
  const config = loaded.default

  const started = Date.now()
  const name = config.output?.name ?? 'scheme-map'
  const operations = config.operations && extractOperations(config.operations, configPath)
  const opsHref = operations ? `./${name}-operations.html` : undefined
  const options = {
    sourceDir: resolve(configDir, config.sourceDir),
    tsconfig: TSCONFIG,
    config,
    opsHref
  }
  const { html, svg, metrics } = await buildSchemeMap(config.scheme, options)

  const outputDir = resolve(configDir, config.output?.dir ?? '.')
  const base = join(outputDir, name)

  mkdirSync(outputDir, { recursive: true })
  writeFileSync(`${base}.html`, html)
  writeFileSync(`${base}.svg`, svg)

  if (operations) {
    writeFileSync(
      `${base}-operations.html`,
      renderOperationsPage({ model: operations, mapHref: `./${name}.html` })
    )
  }

  const readme = config.operations?.readme && resolve(configDir, config.operations.readme)

  if (operations && readme) {
    writeFileSync(readme, replaceOpsMap(readFileSync(readme, 'utf8'), opsMapBlock(operations)))
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  const summary = `коллекций ${metrics.cards}, связей ${metrics.all.routes}, ${seconds} с`

  console.log(`${relative(process.cwd(), base)}.html: ${summary}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
