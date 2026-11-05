/** Вывод CLI в терминал. */
import type { SchemeMapResult } from '../build'
import { plural } from '../text'

const time = () => new Date().toTimeString().slice(0, 8)

export const log = (message: string) => console.log(`${time()} [oxeo-visual] ${message}`)

export const firstLine = (text: string) => text.split('\n')[0].replace(/^Error:\s*/, '')

export const describeBuild = (metrics: SchemeMapResult['metrics'], ms: number) =>
  `✓ карта собрана: ${plural(metrics.cards, ['коллекция', 'коллекции', 'коллекций'])}, ` +
  `${plural(metrics.all.routes, ['связь', 'связи', 'связей'])}, карта ${metrics.width}×${metrics.height} · ` +
  `${(ms / 1000).toFixed(1)} с`
