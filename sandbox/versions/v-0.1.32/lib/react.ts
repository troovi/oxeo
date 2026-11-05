/**
 * Хуки версии (`xeo-react` 0.1.3) — отдельный вход поверхности библиотеки: пакет в npm только ESM (`module` без
 * `main`), а сервер песочницы на `tsx` загружает `lib/index.ts` как CommonJS.
 */
export { createDataSourceHooks } from '@companix/xeo-react'
