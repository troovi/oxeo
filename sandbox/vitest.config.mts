import { fileURLToPath } from 'url'
import { defineConfig } from 'vitest/config'

const schemeBundle = fileURLToPath(new URL('../core/scheme/dist/bundle.cjs.js', import.meta.url))

/**
 * Тесты версий песочницы. TypeScript пишет `design:paramtypes` — по ним контейнер oxeo собирает домены; в
 * `tsconfig.json` песочницы `emitDecoratorMetadata` нет, поэтому флаг задан трансформеру здесь.
 *
 * Пакеты oxeo в workspace — ссылки на папки репозитория, и Vite взял бы `@oxeo/scheme` по полю `module` (ESM), а
 * `@oxeo/server`, собранный в CommonJS, — через `require`: два экземпляра схемы, у каждого свой реестр `@Params` и свой
 * `DomainError`. Сборка CommonJS для обоих — как у проекта, где пакеты лежат в `node_modules`.
 */
export default defineConfig({
  oxc: { decorator: { legacy: true, emitDecoratorMetadata: true } },
  resolve: { alias: [{ find: /^@oxeo\/scheme$/, replacement: schemeBundle }] },
  test: {
    include: ['versions/*/tests/**/*.test.ts'],
    server: { deps: { external: [/\/core\/scheme\/dist\//] } }
  }
})
