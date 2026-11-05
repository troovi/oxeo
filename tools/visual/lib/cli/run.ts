/** Запуск сборки в дочернем процессе и ожидание её результата. */
import { fork, type ChildProcess } from 'child_process'
import * as path from 'path'
import type { WorkerMessage } from './worker'

export interface BuildRun {
  child: ChildProcess
  done: Promise<WorkerMessage>
}

export const startBuild = (configPath: string): BuildRun => {
  const child = fork(path.join(__dirname, 'worker.js'), [configPath], {
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    execArgv: []
  })
  const done = new Promise<WorkerMessage>((resolve) => {
    let message: WorkerMessage | null = null
    child.on('message', (m) => (message = m as WorkerMessage))
    child.on('error', (error) => resolve({ type: 'error', message: error.message }))
    child.on('exit', (code, signal) =>
      resolve(
        message ?? {
          type: 'error',
          message: signal ? `сборка прервана (${signal})` : `сборка завершилась с кодом ${code}`
        }
      )
    )
  })
  return { child, done }
}
