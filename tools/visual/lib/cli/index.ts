/** Точка входа CLI `oxeo-visual`: команды dev и build. */
import * as fs from 'fs'
import * as path from 'path'
import { CONFIG_FILES } from '../project'
import { buildOnce } from './build-command'
import { dev } from './dev'
import { log } from './output'

const HELP = `oxeo-visual — карта схемы данных oxeo

  oxeo-visual dev    [--config <файл>] [--port <номер>] [--no-open]
  oxeo-visual build  [--config <файл>] [--out <папка>]

  dev    сервер с картой в браузере: пересобирает карту при изменении схемы,
         останавливается вместе со скриптом (Ctrl+C)
  build  пишет <name>.html и <name>.svg в output.dir из конфига или в --out

  Конфиг по умолчанию — ${CONFIG_FILES.join(', ')} в текущей папке.
`

const DEFAULT_PORT = 4870

const parse = (argv: string[]) => {
  const [command, ...rest] = argv
  const flags = new Map<string, string | true>()
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    if (!arg.startsWith('--')) continue
    const [name, inline] = arg.slice(2).split('=', 2)
    if (inline !== undefined) flags.set(name, inline)
    else if (rest[i + 1] && !rest[i + 1].startsWith('--')) flags.set(name, rest[++i])
    else flags.set(name, true)
  }
  return { command, flags }
}

const findConfig = (explicit?: string) => {
  if (explicit) {
    const file = path.resolve(explicit)
    if (!fs.existsSync(file)) throw new Error(`конфиг не найден: ${file}`)
    return file
  }
  const found = CONFIG_FILES.map((name) => path.resolve(name)).find((file) => fs.existsSync(file))
  if (!found)
    throw new Error(`нет ${CONFIG_FILES[0]} в ${process.cwd()} — создайте его или укажите --config`)
  return found
}

const main = async () => {
  const { command, flags } = parse(process.argv.slice(2))
  const value = (name: string) =>
    typeof flags.get(name) === 'string' ? (flags.get(name) as string) : undefined

  if (command === 'dev') {
    const port = Number(value('port') ?? process.env.OXEO_VISUAL_PORT ?? DEFAULT_PORT)
    if (!Number.isInteger(port) || port <= 0) throw new Error(`неверный порт: ${value('port')}`)
    await dev({ configPath: findConfig(value('config')), port, open: !flags.has('no-open') })
  } else if (command === 'build') {
    await buildOnce({ configPath: findConfig(value('config')), out: value('out') })
  } else {
    process.stdout.write(HELP)
    if (command && command !== 'help' && command !== '--help') process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  log(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
