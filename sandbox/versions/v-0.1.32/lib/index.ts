/**
 * Поверхность библиотеки этой версии — всё, чем пользуются `core`, `server` и `client` версии. У `v-0.1.32` это
 * опубликованные пакеты xeo как есть, закреплённые в `package.json` версии: схема и целостность (`xeo-scheme`
 * 0.1.32), рантайм доменов, оболочки и очередь событий (`xeo-toolkit` 0.1.1). Хуки — отдельный вход
 * `lib/react.ts`: их берёт только клиент. Код версии импортирует библиотеку только из `../lib` — так видно, чего
 * версия требует от библиотеки.
 */
export * from '@companix/xeo-scheme'
// xeo-toolkit 0.1.1 в npm — только CommonJS: `export *` из него Vite при пред-сборке не разворачивает, поэтому
// значения — перечнем; типы стираются при сборке и идут целиком
export { DomainError, createClientShell, createServerShell, sortById } from '@companix/xeo-toolkit'
export type * from '@companix/xeo-toolkit'
export { schemaOf } from '@companix/xeo-toolkit/dist/schemaOf'
