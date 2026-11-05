# @oxeo/visual

Интерактивная карта схемы данных oxeo. Модели, поля, embedded-блоки, варианты дискриминатора и связи берутся из
`DataScheme` и исходников схемы. Подсказки показывают JSDoc, декораторы и типы TS, у json-полей — интерфейс значения.
Проект задаёт только каркас карты: зоны, пояса, порядок файлов и цвета.

## Подключение

```json
{
  "devDependencies": {
    "@oxeo/visual": "*",
    "ts-node": "^10.9.0"
  },
  "scripts": {
    "scheme:map": "oxeo-visual dev",
    "scheme:map:build": "oxeo-visual build"
  }
}
```

`ts-node` нужен, если конфиг написан на TypeScript: пакет берёт его из проекта, вместе с `tsconfig.json` проекта.

## Конфиг

`oxeo-visual.config.ts` рядом с `package.json`. Пути считаются от папки конфига.

```ts
import { defineConfig } from '@oxeo/visual'
import { dataScheme } from './scheme'

export default defineConfig({
  scheme: dataScheme,
  sourceDir: './scheme',
  output: { dir: './scheme', name: 'scheme-map' },
  // Пояса сверху вниз, в каждом — зоны слева направо
  bands: [
    ['sales', 'execution'],
    ['people', 'dictionaries']
  ],
  zones: [
    { id: 'sales', title: 'Продажи', color: '#e2580b', colorDark: '#fb923c', files: [['sales.ts']] },
    // Ряды файлов зоны сверху вниз
    {
      id: 'execution',
      title: 'Исполнение',
      color: '#0f8f86',
      files: [['projects.ts', 'shifts.ts'], ['timesheet.ts']]
    },
    { id: 'people', title: 'Люди', color: '#7c3aed', files: [['workers.ts']] },
    {
      id: 'dictionaries',
      title: 'Справочники',
      color: '#a87700',
      files: [['dictionary.ts', 'settings.ts']]
    }
  ]
})
```

| Поле             | Назначение                                                                  |
| ---------------- | --------------------------------------------------------------------------- |
| `scheme`         | схема данных проекта                                                        |
| `sourceDir`      | папка с классами схемы: файлы, JSDoc, декораторы, типы полей                |
| `bands`, `zones` | каркас карты; файлы вне зон попадают в зону «Без зоны»                      |
| `hubMinSources`  | с какого числа ссылающихся коллекций модель считается хабом, по умолчанию 7 |
| `tsconfig`       | tsconfig для разрешения типов; по умолчанию ближайший к конфигу             |
| `watch`          | дополнительные пути для `dev`; папка конфига отслеживается всегда           |
| `output`         | куда `build` пишет `<name>.html` и `<name>.svg`                             |
| `spacing`        | отступы раскладки, см. `DEFAULT_SPACING`                                    |

Описание модели — JSDoc `/** … */` над её классом, описание поля — JSDoc над свойством.

## Команды

```
oxeo-visual dev    [--config <файл>] [--port <номер>] [--no-open]
oxeo-visual build  [--config <файл>] [--out <папка>]
```

`dev` поднимает сервер на `127.0.0.1:4870` (если порт занят — следующий свободный) и открывает карту в браузере.
Пока скрипт работает, изменения в папке конфига и в `watch` пересобирают карту. Страница перезагружается и
сохраняет масштаб, выделение и поиск, а при ошибке сборки показывает её первую строку. `Ctrl+C` останавливает
сервер, открытая страница сообщает, что карта больше не обновляется.

`build` один раз собирает карту и пишет самодостаточный HTML (без сети работает всё, кроме веб-шрифтов) и
статический SVG для документации.

Каждая сборка идёт в отдельном процессе: декораторы oxeo регистрируют метаданные в глобальном хранилище, и
повторная загрузка схемы в том же процессе их задвоила бы.

## API

```ts
import { buildSchemeMap, extractScheme } from '@oxeo/visual'

const { html, svg, metrics } = await buildSchemeMap(dataScheme, { sourceDir, tsconfig, config })
```

Маршрутизация связей — [libavoid-js](https://github.com/Aksem/libavoid-js) (LGPL-2.1).
