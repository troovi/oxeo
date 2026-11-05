/**
 * Подготовка манифестов к публикации: типы — из `dist`, зависимости от своих пакетов — `*`, `@oxeo/devkit` не публикуется.
 * Запускается только в CI: правит `package.json` на месте.
 */
const fs = require('fs')

for (const directory of ['core', 'drivers', 'tools']) {
  for (const packageName of fs.readdirSync(directory)) {
    const packagePath = `${directory}/${packageName}/package.json`

    if (!fs.existsSync(packagePath)) {
      continue
    }

    const manifest = JSON.parse(fs.readFileSync(packagePath, 'utf8'))

    manifest.types = './dist/index.d.ts'

    for (const source of ['devDependencies', 'dependencies']) {
      const dependencies = manifest[source]

      for (const name in dependencies) {
        if (name === '@oxeo/devkit') {
          delete dependencies[name]
          continue
        }

        if (name.startsWith('@companix') || name.startsWith('@oxeo')) {
          dependencies[name] = '*'
        }
      }
    }

    fs.writeFileSync(packagePath, JSON.stringify(manifest, null, 2))
  }
}
