/** Формат значений экрана песочницы. */
export const format = {
  bytes: (bytes: number) => {
    if (bytes >= 1_000_000) {
      return `${(bytes / 1_000_000).toFixed(2)} МБ`
    }

    if (bytes >= 1000) {
      return `${(bytes / 1000).toFixed(1)} КБ`
    }

    return `${bytes} Б`
  },
  /** Значение ячейки или подписи в одну строку: `null` — словом, объект — компактным JSON. */
  value: (value: unknown) => {
    if (value === null) {
      return 'null'
    }

    if (typeof value === 'object') {
      return JSON.stringify(value)
    }

    return String(value)
  }
}
