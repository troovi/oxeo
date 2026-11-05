/** Открытие адреса в браузере по умолчанию средствами ОС, без зависимостей. */
import { spawn } from 'child_process'
import { log } from './output'

export const openBrowser = (url: string) => {
  const [command, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '""', url]]
        : ['xdg-open', [url]]
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true })
    child.on('error', () => log(`откройте в браузере: ${url}`))
    child.unref()
  } catch {
    log(`откройте в браузере: ${url}`)
  }
}
