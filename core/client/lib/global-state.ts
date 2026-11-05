/**
 * Глобальное состояние клиента — общее для чтений и сборщиков. Чтение не получает компонент аргументом, поэтому узнаёт
 * отсюда, чей проход идёт сейчас.
 */
import type { Tracker } from './tracker'

class OxeoGlobals {
  /** Сборщик прохода, который идёт сейчас; `null` — чтение вне рендера. */
  currentTracker: Tracker | null = null
}

export const globalState = new OxeoGlobals()
