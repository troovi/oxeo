/**
 * Сервер и приложение одной командой: два дочерних процесса с общим выводом. Остановка — Ctrl+C.
 *
 *   npm run dev -w=@oxeo/sandbox
 */
const { spawn } = require('child_process')
const path = require('path')

const root = path.resolve(__dirname, '..')

const run = (script) => {
  const child = spawn('npm', ['run', script], { cwd: root, stdio: 'inherit' })

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      process.exit(code)
    }
  })

  return child
}

const children = [run('server'), run('app')]

process.on('SIGINT', () => {
  children.forEach((child) => child.kill('SIGINT'))
  process.exit(0)
})
