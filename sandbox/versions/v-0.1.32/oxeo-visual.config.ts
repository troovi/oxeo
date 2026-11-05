/**
 * Карта схемы версии для `@oxeo/visual`: модели, поля, embedded-блоки и связи — из `core/scheme.ts`, здесь
 * только каркас. Схема в одном файле, поэтому зона одна. Сборка — `npm run visual -w=@oxeo/sandbox`,
 * карта — `core/scheme-map.html` и `core/scheme-map.svg`.
 */
import { defineConfig } from '@oxeo/visual'
import { dataScheme } from './core/scheme'

export default defineConfig({
  scheme: dataScheme,
  sourceDir: './core',
  output: { dir: './core', name: 'scheme-map' },
  bands: [['scheme']],
  zones: [
    {
      id: 'scheme',
      title: 'v-0.1.32',
      color: '#2563eb',
      colorDark: '#60a5fa',
      files: [['scheme.ts']]
    }
  ]
})
