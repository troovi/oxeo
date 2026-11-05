/**
 * Карты схем версий (`@oxeo/visual`): каждая версия с `oxeo-visual.config.ts` собирается в своём процессе —
 * декораторы oxeo регистрируют модели в глобальном хранилище, и две схемы в одном процессе задвоили бы его.
 *
 *   npm run visual -w=@oxeo/sandbox              # все версии
 *   npm run visual -w=@oxeo/sandbox -- v-0.1.32  # одна
 */
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const versionsDir = path.join(root, 'versions')
const tsx = require.resolve('tsx/cli')

const requested = process.argv.slice(2)
const versions = requested.length > 0 ? requested : fs.readdirSync(versionsDir)

for (const version of versions) {
  const config = path.join(versionsDir, version, 'oxeo-visual.config.ts')

  if (!fs.existsSync(config)) {
    console.log(`${version}: нет oxeo-visual.config.ts — пропущена`)
    continue
  }

  const result = spawnSync(process.execPath, [tsx, 'scripts/visual-build.ts', config], {
    cwd: root,
    stdio: 'inherit'
  })

  if (result.status !== 0) {
    process.exitCode = 1
  }
}
