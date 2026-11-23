/**
 * Карта схемы версии для `@oxeo/visual`: модели, поля, embedded-блоки и связи — из `core/scheme.ts`, здесь
 * только каркас. Схема в одном файле, поэтому зона одна. Сборка — `npm run visual -w=@oxeo/sandbox`,
 * карта — `core/scheme-map.html` и `core/scheme-map.svg`, рядом страница операций —
 * `core/scheme-map-operations.html`, таблица операций — в README версии.
 */
import { defineConfig } from '@oxeo/visual'
import { appDomains } from './core/domains'
import { appDomainsDescriptions } from './core/domains/descriptions'
import { dataScheme } from './core/scheme'

export default defineConfig({
  scheme: dataScheme,
  sourceDir: './core',
  output: { dir: './core', name: 'scheme-map' },
  operations: { domains: appDomains, descriptions: appDomainsDescriptions, readme: './README.md' },
  bands: [['scheme']],
  zones: [
    {
      id: 'scheme',
      title: 'v-next',
      color: '#2563eb',
      colorDark: '#60a5fa',
      files: [['scheme.ts']]
    }
  ]
})
