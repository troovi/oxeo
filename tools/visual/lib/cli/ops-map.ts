/** `oxeo-visual ops-map`: таблица операций в README между маркерами `ops:map`; текст вокруг блока — ручной. */
import * as fs from 'fs'
import * as path from 'path'
import { opsMapBlock, replaceOpsMap, summaryOf } from '../operations'
import { log } from './output'
import { startBuild } from './run'

export interface OpsMapOptions {
  configPath: string
  /** README вместо `operations.readme` из конфига. */
  readme?: string
}

export const opsMap = async ({ configPath, readme }: OpsMapOptions) => {
  const message = await startBuild(configPath, 'ops').done
  if (message.type !== 'operations') {
    log(`операции не собраны:\n${message.type === 'error' ? message.message : message.type}`)
    process.exitCode = 1
    return
  }
  const file = readme ? path.resolve(readme) : message.readme
  if (!file) throw new Error('не задан README: operations.readme в конфиге или --readme <файл>')
  const text = fs.readFileSync(file, 'utf8')
  fs.writeFileSync(file, replaceOpsMap(text, opsMapBlock(message.model)))
  log(`${summaryOf(message.model)} → ${path.relative(process.cwd(), file)}`)
}
