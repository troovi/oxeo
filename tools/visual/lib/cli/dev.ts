/**
 * `oxeo-visual dev`: локальный сервер с картой. Карта собирается в дочернем процессе, страница получает события
 * по SSE: пересобирается — перезагружается с сохранением масштаба и выделения, сборка упала — видит ошибку,
 * сервер остановлен — видит, что карта больше не обновляется. Остановка — вместе со скриптом (Ctrl+C).
 */
import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import { openBrowser } from './open'
import { describeBuild, firstLine, log } from './output'
import { startBuild, type BuildRun } from './run'

export interface DevOptions {
  configPath: string
  port: number
  open: boolean
}

const EVENTS_PATH = '/__xeo-visual/events'
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage'])
const WATCHED_FILE = /\.(c|m)?[jt]sx?$|\.json$/

/** Скрипт dev-режима, дописывается в конец страницы карты. */
const devClient = (build: string | null) => `
<style>
#xv-dev { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 100; max-width: min(720px, calc(100vw - 32px)); padding: 8px 14px; border-radius: 6px; font: 500 13px/1.45 system-ui, sans-serif; box-shadow: 0 8px 24px rgb(0 0 0 / 0.18); }
#xv-dev[data-tone='info'] { background: var(--xv-surface, #fff); color: var(--xv-text, #18181b); border: 1px solid var(--xv-line-strong, #d4d4d8); }
#xv-dev[data-tone='error'] { background: #b42318; color: #fff; }
#xv-dev[data-tone='stop'] { background: #3f3f46; color: #fff; }
</style>
<script>
;(() => {
  const BUILD = ${JSON.stringify(build)}
  const bar = document.createElement('div')
  bar.id = 'xv-dev'
  bar.setAttribute('role', 'status')
  bar.hidden = true
  document.body.appendChild(bar)
  const show = (text, tone) => {
    bar.textContent = text
    bar.dataset.tone = tone
    bar.hidden = false
  }
  const reload = () => {
    try {
      if (window.__xv) sessionStorage.setItem('xv-restore', JSON.stringify(window.__xv.state()))
    } catch (e) {}
    location.reload()
  }
  const events = new EventSource(${JSON.stringify(EVENTS_PATH)})
  events.addEventListener('hello', (e) => {
    const { build, error } = JSON.parse(e.data)
    if (build && build !== BUILD) return reload()
    if (error) show('Сборка не удалась: ' + error + ' — подробности в терминале', 'error')
    else bar.hidden = true
  })
  events.addEventListener('building', () => show('Пересобираю карту…', 'info'))
  events.addEventListener('built', (e) => {
    if (JSON.parse(e.data).build !== BUILD) reload()
  })
  events.addEventListener('failed', (e) => {
    show('Сборка не удалась: ' + JSON.parse(e.data).message + ' — подробности в терминале', 'error')
  })
  events.addEventListener('shutdown', () => {
    events.close()
    show('oxeo-visual остановлен: карта больше не обновляется', 'stop')
  })
  events.onerror = () => {
    if (bar.dataset.tone !== 'stop') show('Нет связи с oxeo-visual: сервер остановлен или перезапускается', 'stop')
  }
})()
</script>
`

const waitingPage = () => `<!doctype html>
<meta charset="utf-8" />
<title>oxeo-visual</title>
<style>
body { margin: 0; height: 100vh; display: grid; place-items: center; background: #f6f6f7; color: #63636e; font: 14px/1.5 system-ui, sans-serif; }
@media (prefers-color-scheme: dark) { body { background: #0c0c0e; color: #a3a3ad; } }
</style>
<p>Собираю карту схемы…</p>
${devClient(null)}`

/** Слежение за деревом папок без node_modules, dist и скрытых папок — fs.watch на каждую папку. */
const watchTree = (root: string, listener: (file: string) => void) => {
  const handles: fs.FSWatcher[] = []
  const add = (target: string) => {
    try {
      handles.push(
        fs.watch(target, (_event, file) => listener(file ? path.join(target, String(file)) : target))
      )
    } catch {}
  }
  const visit = (dir: string) => {
    add(dir)
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && !IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        visit(path.join(dir, entry.name))
      }
    }
  }
  if (fs.statSync(root).isDirectory()) visit(root)
  else add(root)
  return () => handles.forEach((handle) => handle.close())
}

const listen = async (server: http.Server, port: number) => {
  for (let candidate = port; candidate < port + 20; candidate++) {
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(candidate, '127.0.0.1', () => {
          server.off('error', reject)
          resolve()
        })
      })
      return candidate
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error
    }
  }
  throw new Error(`порты ${port}–${port + 19} заняты, укажите другой: --port <номер>`)
}

export const dev = async ({ configPath, port, open }: DevOptions) => {
  let html: string | null = null
  let svg: string | null = null
  let build: string | null = null
  let error: string | null = null
  let current: BuildRun | null = null
  let queued = false
  let stopping = false
  const clients = new Set<http.ServerResponse>()

  const broadcast = (event: string, data: unknown = {}) => {
    for (const res of clients) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (url.pathname === EVENTS_PATH) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      })
      res.write(
        `event: hello\ndata: ${JSON.stringify({ build, error: error && firstLine(error) })}\n\n`
      )
      clients.add(res)
      req.on('close', () => clients.delete(res))
      return
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(html ? html + devClient(build) : waitingPage())
      return
    }
    if (url.pathname.endsWith('.svg') && svg) {
      res.writeHead(200, {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-store'
      })
      res.end(svg)
      return
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Не найдено')
  })
  // Держим SSE-соединения живыми через прокси и спящие вкладки
  const ping = setInterval(() => clients.forEach((res) => res.write(': ping\n\n')), 25_000)

  // ── пересборка по изменениям

  const stoppers = new Map<string, () => void>()
  let timer: NodeJS.Timeout | null = null
  let changed = ''
  const onChange = (file: string) => {
    if (stopping || !WATCHED_FILE.test(file)) return
    changed = file
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      log(`изменение: ${path.relative(process.cwd(), changed) || changed}`)
      void rebuild()
    }, 200)
  }
  const watch = (roots: string[]) => {
    // Вложенные корни уже покрыты родителем
    const unique = roots.filter(
      (root) => !roots.some((other) => root !== other && root.startsWith(other + path.sep))
    )
    for (const [root, stop] of stoppers) {
      if (!unique.includes(root)) {
        stop()
        stoppers.delete(root)
      }
    }
    for (const root of unique) {
      if (!stoppers.has(root) && fs.existsSync(root)) stoppers.set(root, watchTree(root, onChange))
    }
  }

  const rebuild = async () => {
    if (current) {
      queued = true
      return
    }
    const started = Date.now()
    broadcast('building')
    current = startBuild(configPath)
    const message = await current.done
    current = null
    if (stopping) return
    if (message.type === 'result') {
      html = message.html
      svg = message.svg
      error = null
      build = String(started)
      log(describeBuild(message.metrics, Date.now() - started))
      broadcast('built', { build })
      watch(message.settings.watch)
    } else {
      error = message.message
      log(`сборка не удалась:\n${message.message}`)
      broadcast('failed', { message: firstLine(message.message) })
    }
    if (queued) {
      queued = false
      void rebuild()
    }
  }

  // ── остановка вместе со скриптом

  const stop = () => {
    if (stopping) return
    stopping = true
    broadcast('shutdown')
    clients.forEach((res) => res.end())
    clearInterval(ping)
    if (timer) clearTimeout(timer)
    stoppers.forEach((stopWatching) => stopWatching())
    current?.child.kill()
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 500).unref()
    log('остановлен')
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  process.on('SIGHUP', stop)

  const actualPort = await listen(server, port)
  const url = `http://127.0.0.1:${actualPort}`
  log(`карта схемы: ${url} — Ctrl+C, чтобы остановить`)
  watch([path.dirname(configPath)])
  if (open) openBrowser(url)
  await rebuild()
}
