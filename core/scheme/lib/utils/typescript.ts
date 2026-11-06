export type ObjectType<T> = { new (): T } | Function

export interface Type<T = any> extends Function {
  new (...args: any[]): T
}

export type ExtractType<T> = T extends Type<infer M> ? M : never

export type KeyOfType<T, V> = keyof {
  [P in keyof T as T[P] extends V ? P : never]: any
}

export type TargetHost = {
  target: Function
}

export type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> }
