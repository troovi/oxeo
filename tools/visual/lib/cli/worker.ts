/**
 * Процесс одной сборки: загружает конфиг проекта (TypeScript — через ts-node проекта), строит карту и отдаёт
 * результат родителю по IPC. Отдельный процесс на каждую сборку нужен потому, что декораторы oxeo регистрируют
 * метаданные в глобальном хранилище: повторная загрузка схемы в том же процессе их задвоила бы.
 */
import * as path from 'path'
import * as ts from 'typescript'
import { buildSchemeMap, type SchemeMapResult } from '../build'
import type { OxeoVisualConfig } from '../project'

export interface BuildSettings {
  configDir: string
  sourceDir: string
  /** Корни, изменения в которых запускают пересборку в режиме dev. */
  watch: string[]
  output: { dir: string; name: string }
}

export type WorkerMessage =
  | {
      type: 'result'
      html: string
      svg: string
      metrics: SchemeMapResult['metrics']
      settings: BuildSettings
    }
  | { type: 'error'; message: string }

const isTypeScript = (file: string) => /\.(c|m)?ts$/.test(file)

/** ts-node берётся из проекта: та же версия и тот же tsconfig, что у самого проекта. */
const registerTypeScript = (configPath: string) => {
  const dir = path.dirname(configPath)
  let tsNode: string
  try {
    tsNode = require.resolve('ts-node', { paths: [dir] })
  } catch {
    throw new Error(
      `${path.basename(configPath)} написан на TypeScript, а ts-node в проекте не найден. Установите его: npm i -D ts-node`
    )
  }
  require(tsNode).register({
    project: ts.findConfigFile(dir, ts.sys.fileExists),
    transpileOnly: true,
    compilerOptions: { module: 'commonjs' }
  })
}

const run = async (configPath: string): Promise<WorkerMessage> => {
  if (isTypeScript(configPath)) registerTypeScript(configPath)
  const loaded = require(configPath)
  const config: OxeoVisualConfig | undefined = loaded?.default ?? loaded
  if (!config?.scheme) {
    throw new Error(
      `${path.basename(configPath)}: не задана схема — экспортируйте defineConfig({ scheme, ... })`
    )
  }

  const dir = path.dirname(configPath)
  const resolve = (p: string) => path.resolve(dir, p)
  const sourceDir = resolve(config.sourceDir)
  const tsconfig = config.tsconfig
    ? resolve(config.tsconfig)
    : ts.findConfigFile(dir, ts.sys.fileExists)
  const result = await buildSchemeMap(config.scheme, { sourceDir, tsconfig, config })

  return {
    type: 'result',
    html: result.html,
    svg: result.svg,
    metrics: result.metrics,
    settings: {
      configDir: dir,
      sourceDir,
      watch: [...new Set([dir, sourceDir, ...(config.watch ?? []).map(resolve)])],
      output: { dir: resolve(config.output?.dir ?? '.'), name: config.output?.name ?? 'scheme-map' }
    }
  }
}

const send = (message: WorkerMessage) => {
  if (process.send) process.send(message, () => process.exit(message.type === 'result' ? 0 : 1))
  else process.exit(message.type === 'result' ? 0 : 1)
}

run(path.resolve(process.argv[2]))
  .then(send)
  .catch((error: unknown) =>
    send({
      type: 'error',
      message: error instanceof Error ? (error.stack ?? error.message) : String(error)
    })
  )
