import { isPlainObject } from '@companix/utils-js'

const container = (properties: string) => {
  return `${properties}; padding: 2px 4px; border-radius: 4px`
}

export const styles = {
  yellow: container('color: #000; background: #f7df1c'),
  pink: container('color: #fff; background: #ff00a9'),
  boldPink: container('color: #fff; background: #690026'),
  blue: container('color: #fff; background: #3377c6'),
  info: container('color: #fff; background: #4fc08d'),
  util: 'color: blue'
}

export const xRay = {
  splitter: () => {
    console.log(`%c${new Array(100).fill('-').join('')}`, 'color: #616161')
  },
  print: (context: string, style: string = styles.util) => {
    return (...args: any[]) => {
      console.log(
        `%c[X-RAY] %c${context}`,
        'color: #00bcd4;',
        style,
        ...args.map((arg) => (isPlainObject(arg) ? snapshot(arg) : arg))
      )
    }
  }
}

const snapshot = (object: object) => {
  return JSON.parse(JSON.stringify(object))
}
