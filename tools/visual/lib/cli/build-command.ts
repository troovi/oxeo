/** `oxeo-visual build`: одна сборка и запись `<name>.html` и `<name>.svg`. */
import * as fs from 'fs'
import * as path from 'path'
import { describeBuild, log } from './output'
import { startBuild } from './run'

export interface BuildOptions {
  configPath: string
  /** Папка вместо `output.dir` из конфига. */
  out?: string
}

export const buildOnce = async ({ configPath, out }: BuildOptions) => {
  const started = Date.now()
  const message = await startBuild(configPath).done
  if (message.type === 'error') {
    log(`сборка не удалась:\n${message.message}`)
    process.exitCode = 1
    return
  }
  const dir = out ? path.resolve(out) : message.settings.output.dir
  const base = path.join(dir, message.settings.output.name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(`${base}.html`, message.html)
  fs.writeFileSync(`${base}.svg`, message.svg)
  log(describeBuild(message.metrics, Date.now() - started))
  log(`${path.relative(process.cwd(), `${base}.html`)}, ${path.relative(process.cwd(), `${base}.svg`)}`)
}
