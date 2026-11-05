# Размер бандла: xeo против популярных state-библиотек

Исследование от 2 ноября 2026 года. Вопрос: сколько JavaScript дополнительно скачивает клиент, если React-приложение
построено на `@companix/xeo-scheme` + `@companix/xeo-react`, а не на Redux, MobX, Zustand и других популярных
библиотеках. Учитывается весь стек: React-биндинг и все runtime-зависимости, которые реально попадают в бандл. Все числа
получены из production-сборок одного и того же приложения, реализованного на каждой библиотеке. Каждый бандл проверен
запуском.

## Коротко

- В типовом приложении xeo добавляет к бандлу **+9,3 КБ gzip** (+33,8 КБ min, +8,1 КБ brotli): 11-е место из 16. Это
  тяжелее минималистичных сторов (Zustand 0,7, Nanostores 1,3, Redux 2,1, Valtio 2,3, Signals 2,6, Jotai 3,7 КБ) и
  «средних» библиотек (Zustand + immer 4,4, Legend State 6,9, TinyBase 7,2, Effector 8,4 КБ), но легче Redux Toolkit
  (11,6), MobX (13,8–15,1), XState (14,6) и в 3,6 раза легче MobX-State-Tree (33,2 КБ), ближайшего к xeo аналога по
  возможностям.
- Для масштаба: базовое приложение на React 18 без state-библиотеки весит 46,5 КБ gzip. xeo увеличивает бандл на 20 %,
  Redux Toolkit на 25 %, MobX на 30 %, MobX-State-Tree на 71 %, Zustand на 1,4 %.
- Цена xeo почти не зависит от того, сколько возможностей использует приложение. Tree-shaking на xeo почти не работает:
  даже минимальное приложение получает 93 % полного API (33,5 из 35,9 КБ min). У Redux Toolkit, Effector, TinyBase и
  Jotai в типовое приложение попадает 36–61 % пакета, и по мере использования API размер растёт. При импорте всего API
  xeo (9,6 КБ gzip) легче Redux Toolkit (18,8), TinyBase (17,8), MobX (17,5), XState (16,8) и Effector (16,5).
- Самая тяжёлая часть xeo — класс `DataProcessor`: 11,3 КБ min / 2,6 КБ gzip, 38 % xeo-scheme. Бандлеры не удаляют
  неиспользуемые методы класса, поэтому `changeDiscriminator` и `getExternalRelations` (вместе с хелпером 3,8 КБ min)
  попадают и в приложения, которые их не вызывают.
- По min xeo выглядит хуже, чем по gzip. 33,8 КБ min — уровень Redux Toolkit (30,6), зато отношение gzip/min у xeo
  лучшее среди всех стеков, 27 %. Причина: треть байтов dist (у Effector — 12 %) занимают идентификаторы длиной от 8
  символов, в основном имена свойств и методов (`collections`, `discriminatorKey`, `getModelSchemaByTarget`…).
  Минификатор их не сокращает, а gzip хорошо сжимает повторы. По сети передаётся сжатый размер, а парсинг и компиляция
  JS работают с несжатым.
- Вспомогательных зависимостей у xeo минимум: `@companix/utils-js` (0,5 КБ min) и `fast-deep-equal` (0,7 КБ min). Трекер
  изменений собственный, без immer. Для сравнения, стек Redux Toolkit устанавливает 10 пакетов, из них 7 попадают в
  бандл, и один только immer весит 9,6 КБ min.
- Контрольная сборка на Vite 8 (Rolldown + Oxc) даёт те же выводы: числа отличаются не больше чем на 1,2 КБ gzip, xeo
  остаётся на 11-м месте.

## Методика

### Стенд

- React 18.3.1 и react-dom 18.3.1 у всех стеков, потому что peer-зависимость `@companix/xeo-react` — `react ^18.3.1`.
- Основной сборщик — Vite 7.3.0 (та же версия, что в монорепозитории): Rollup 4 и минификация esbuild, все настройки
  `build` по умолчанию, кроме `build.sourcemap: 'hidden'`. Контрольный сборщик — Vite 8.3.5 (Rolldown и минификатор
  Oxc).
- Node 20.19.6, npm 11.21.0. Зависимости установлены одной командой в один проект, поэтому общие пакеты
  (`use-sync-external-store`, `immer`, `mobx`) у всех стеков одной версии.
- Версии библиотек — последние в npm на дату замера, с двумя исключениями. TinyBase 5.4.9 — последняя версия с
  поддержкой React 18 (6.x и новее требуют React 19, текущая версия 10.0.1). Legend State 2.1.15 — текущий `latest`,
  версия 3 пока в beta.
- xeo измерялся в виде опубликованных пакетов `@companix/xeo-scheme@0.1.32` и `@companix/xeo-react@0.1.3`, то есть ровно
  того, что ставит клиент. Они совпадают с текущими исходниками в репозитории.

### Два режима замера

1. **Типовое приложение.** На каждой библиотеке реализовано одно и то же: коллекция todo, нормализованная по `id`, и три
   стартовые записи. Есть компонент записи, подписанный на свою запись, список, счётчики «всего / выполнено»
   (производное значение) и операции create, update (toggle, rename) и remove. Разметка общая (`shared.tsx`), от
   библиотеки зависят только состояние и хуки. Код написан так, как рекомендуют документации: Redux Toolkit —
   `createEntityAdapter` + `createSlice` + `createSelector`, MobX — `makeAutoObservable` + `observer`, xeo — декораторы
   `@Model`/`@Identifier`/`@Prop`, `DataSource` и `createDataSourceHooks`. Базовая линия — то же приложение на чистом
   React (`useReducer` + Context). **Прирост** = размер бандла приложения минус размер бандла базовой линии, то есть
   точное число байт, которые клиент скачает дополнительно. В прирост входит и разница в коде самого приложения, но код
   занимает 1,4–2,0 КБ min во всех вариантах, так что разница не больше 0,3 КБ.
2. **Полный API.** Entry вида `import * as ns from '<entry>'` для каждого entry point стека. Пространства имён
   сохраняются в `globalThis`, поэтому tree-shaking ничего не удаляет; `react` и `react-dom` вынесены во внешние
   зависимости. Это верхняя граница: столько стоит стек, если использовать всё. Сравнение двух режимов показывает,
   насколько хорошо библиотека поддаётся tree-shaking.

### Метрики

- **min** — размер минифицированного файла из `dist/assets`. **gzip** — уровень 9, **brotli** — качество 11, как при
  предварительном сжатии статики. 1 КБ = 1000 байт, как в выводе `vite build`.
- **Разбивка по пакетам** сделана по source map итогового минифицированного файла: каждый байт принадлежит источнику
  ближайшего mapping слева, как в source-map-explorer. Размеры min по пакетам точные с точностью до границ между
  mapping'ами. gzip по пакетам (помечен `*`) — оценка: фрагменты каждого пакета сжимаются отдельно от остального файла и
  сжимаются хуже, поэтому сумма по пакетам на 2–11 % больше совместного сжатия.
- Строка «Итого стек» в таблицах состава — совместное сжатие всех фрагментов библиотек, без React, кода приложения и
  рантайма сборщика. Она может отличаться от прироста в сводной таблице на ±0,4 КБ gzip (прирост включает разницу в коде
  приложения и сжатие в контексте всего файла) и от таблицы полного API на 0,1–0,2 КБ (там указан размер всего файла).

### Проверка работоспособности

Каждый собранный бандл (17 приложений × 2 сборщика) запускался в jsdom. Сценарий: монтирование, add, toggle, rename и
remove с проверкой DOM после каждого шага. Результат — 17/17 на Vite 7 и 17/17 на Vite 8, то есть измерялись работающие
приложения, а не вырезанные tree-shaking'ом заглушки.

### Что не измерялось

Время парсинга, компиляции и исполнения, скорость ререндеров, память, DX, типизация, SSR, dev-сборки. Не измерялись и
необязательные модули: RTK Query, persist-плагины, devtools. Recoil не включён: проект архивирован и не развивается.

## Результаты: типовое приложение (Vite 7)

| # | Стек | Пакетов в бандле | Прирост min | Прирост gzip | Прирост brotli | Весь бандл, gzip | Разница с xeo, gzip |
|--:|------|:---:|--:|--:|--:|--:|--:|
| — | React 18.3.1 без state-библиотеки (useReducer + Context) | — | 144,2 всего | 46,5 всего | 40,8 всего | 46,5 | — |
| 1 | Zustand | 1 | 1,6 | 0,7 | 0,6 | 47,2 | −8,6 |
| 2 | Nanostores + @nanostores/react | 2 | 2,7 | 1,3 | 1,2 | 47,8 | −7,9 |
| 3 | Redux без RTK + react-redux | 3 | 5,7 | 2,1 | 1,9 | 48,6 | −7,2 |
| 4 | Valtio | 2 | 5,8 | 2,3 | 2,0 | 48,8 | −6,9 |
| 5 | Preact Signals для React | 3 | 7,2 | 2,6 | 2,3 | 49,0 | −6,7 |
| 6 | Jotai | 1 | 8,4 | 3,7 | 3,2 | 50,1 | −5,6 |
| 7 | Zustand + immer middleware | 2 | 11,2 | 4,4 | 4,1 | 50,9 | −4,8 |
| 8 | Legend State v2 | 1 | 17,6 | 6,9 | 6,2 | 53,4 | −2,4 |
| 9 | TinyBase 5 + ui-react | 1 | 15,7 | 7,2 | 6,3 | 53,7 | −2,1 |
| 10 | Effector + effector-react | 3 | 18,8 | 8,4 | 7,5 | 54,9 | −0,9 |
| 11 | **xeo (xeo-scheme + xeo-react)** | 4 | 33,8 | 9,3 | 8,1 | 55,8 | — |
| 12 | Redux Toolkit + react-redux | 7 | 30,6 | 11,6 | 10,4 | 58,1 | +2,3 |
| 13 | MobX + mobx-react-lite | 2 | 47,7 | 13,8 | 12,3 | 60,3 | +4,5 |
| 14 | XState + @xstate/react | 4 | 43,7 | 14,6 | 12,8 | 61,1 | +5,3 |
| 15 | MobX + mobx-react | 3 | 51,7 | 15,1 | 13,3 | 61,5 | +5,8 |
| 16 | MobX-State-Tree + mobx-react-lite | 3 | 115,9 | 33,2 | 29,3 | 79,7 | +23,9 |

Из чего состоит базовая линия, которая одинакова у всех стеков:

| Часть бандла | min | gzip* |
|------|--:|--:|
| `react-dom` | 130,2 | 41,5 |
| `react` (+ jsx-runtime) | 7,4 | 2,9 |
| `scheduler` | 4,0 | 1,7 |
| код приложения | 1,7 | 0,8 |
| рантайм сборщика (modulepreload-полифил, CJS-interop) | 0,8 | 0,5 |
| **Весь бандл (точно)** | **144,2** | **46,5** |

Что видно из таблицы:

- Первая группа (до 4,5 КБ gzip) — сторы-примитивы: Zustand (в том числе с immer), Nanostores, Redux без RTK, Valtio,
  Signals, Jotai. Нормализацию, схему данных и связи в них пишет код приложения.
- Вторая группа (6–10 КБ) — Legend State, TinyBase, Effector, xeo. Отсюда начинаются библиотеки, которые берут на себя
  модель данных.
- Третья группа (11–15 КБ) — Redux Toolkit, MobX, XState. Отдельно стоит MobX-State-Tree (33 КБ): он единственный из
  измеренных даёт сравнимый с xeo набор возможностей «из коробки» (типизированные модели, идентификаторы, ссылки,
  снапшоты, патчи).

## Результаты: полный API

| Стек | Импортируемые entry points (`import *`) | min | gzip | brotli | Доля полного API в типовом приложении (min) |
|------|------|--:|--:|--:|--:|
| Zustand | `zustand`, `zustand/react/shallow` | 1,7 | 0,8 | 0,7 | 93 % |
| Nanostores + @nanostores/react | `nanostores`, `@nanostores/react` | 6,2 | 2,8 | 2,5 | 48 % |
| Valtio | `valtio` | 6,7 | 2,8 | 2,6 | 91 % |
| Preact Signals для React | `@preact/signals-react`, `@preact/signals-react/runtime` | 9,4 | 3,5 | 3,2 | 80 % |
| Redux без RTK + react-redux | `redux`, `react-redux` | 13,9 | 5,3 | 4,8 | 41 % |
| Jotai | `jotai`, `jotai/utils` | 15,4 | 6,3 | 5,6 | 54 % |
| Zustand + immer middleware | `zustand`, `zustand/react/shallow`, `zustand/middleware/immer`, `immer` | 20,8 | 7,7 | 7,1 | 54 % |
| Legend State v2 | `@legendapp/state`, `@legendapp/state/react` | 24,8 | 9,6 | 8,8 | 72 % |
| **xeo (xeo-scheme + xeo-react)** | `@companix/xeo-scheme`, `@companix/xeo-react` | 35,9 | 9,6 | 8,7 | 93 % |
| Effector + effector-react | `effector`, `effector-react` | 39,6 | 16,5 | 15,0 | 47 % |
| XState + @xstate/react | `xstate`, `@xstate/react` | 52,1 | 16,8 | 15,2 | 83 % |
| MobX + mobx-react-lite | `mobx`, `mobx-react-lite` | 59,7 | 17,5 | 15,8 | 80 % |
| TinyBase 5 + ui-react | `tinybase`, `tinybase/ui-react` | 43,7 | 17,8 | 15,9 | 36 % |
| Redux Toolkit + react-redux | `@reduxjs/toolkit`, `react-redux` | 50,4 | 18,8 | 17,1 | 61 % |
| MobX + mobx-react | `mobx`, `mobx-react` | 63,7 | 18,8 | 17,0 | 81 % |
| MobX-State-Tree + mobx-react-lite | `mobx-state-tree`, `mobx`, `mobx-react-lite` | 134,1 | 38,6 | 34,4 | 86 % |

Последняя колонка показывает, какая часть полного API попала в типовое приложение. У xeo, MobX, MobX-State-Tree и XState
она 80–93 %: стоимость почти постоянна и мало растёт с ростом приложения. У TinyBase, Redux без RTK, Effector,
Nanostores, Jotai и Redux Toolkit она 36–61 %: минимальное приложение получается лёгким, а реальное, которое использует
больше API, растёт к колонке «полный API». Реальное приложение обычно лежит между двумя режимами.

## Контроль: Vite 8 (Rolldown + Oxc)

| Стек | Типовое, Δgzip Vite 7 | Типовое, Δgzip Vite 8 | Полный API, gzip Vite 7 | Полный API, gzip Vite 8 |
|------|--:|--:|--:|--:|
| Zustand | 0,7 | 0,8 | 0,8 | 0,8 |
| Nanostores + @nanostores/react | 1,3 | 1,3 | 2,8 | 2,7 |
| Redux без RTK + react-redux | 2,1 | 2,1 | 5,3 | 5,2 |
| Valtio | 2,3 | 1,8 | 2,8 | 2,4 |
| Preact Signals для React | 2,6 | 2,3 | 3,5 | 3,6 |
| Jotai | 3,7 | 3,2 | 6,3 | 5,7 |
| Zustand + immer middleware | 4,4 | 4,2 | 7,7 | 7,3 |
| Legend State v2 | 6,9 | 6,4 | 9,6 | 9,1 |
| TinyBase 5 + ui-react | 7,2 | 6,6 | 17,8 | 16,4 |
| Effector + effector-react | 8,4 | 7,8 | 16,5 | 16,1 |
| **xeo (xeo-scheme + xeo-react)** | 9,3 | 8,7 | 9,6 | 9,4 |
| Redux Toolkit + react-redux | 11,6 | 10,5 | 18,8 | 18,0 |
| MobX + mobx-react-lite | 13,8 | 12,6 | 17,5 | 16,6 |
| XState + @xstate/react | 14,6 | 13,5 | 16,8 | 16,3 |
| MobX + mobx-react | 15,1 | 13,9 | 18,8 | 17,9 |
| MobX-State-Tree + mobx-react-lite | 33,2 | 32,6 | 38,6 | 38,6 |
| _React без библиотеки (весь бандл)_ | _46,5_ | _45,6_ | — | — |

Vite 8 немного лучше минифицирует (базовая линия на 0,9 КБ gzip меньше), но разница по стекам не превышает 1,2 КБ gzip,
а порядок мест почти тот же: меняются местами только Valtio и Redux. xeo на 11-м месте в обоих случаях.

## Состав стеков: вспомогательные библиотеки и их размер

Ниже для каждого стека перечислены все runtime-зависимости из `package.json` (рекурсивно, включая обязательные
peer-зависимости, кроме самого React) с фактическим размером в бандле. Строка «0» означает, что пакет устанавливается,
но в бандл не попадает. `*` — оценка сжатия по отдельности, см. методику.

### xeo — `@companix/xeo-scheme` + `@companix/xeo-react`

- **Что даёт:** схему моделей на декораторах (`@Model`, `@Prop`, `@Identifier`, связи `@ReferenceTo`, ownership,
  embedded, дискриминированные модели), нормализованные коллекции с индексами, проверку и каскадное удаление по связям,
  трекер изменений с патчами (без immer) и подписку компонентов на отдельные поля сущности через Proxy.
- **В типовом приложении:** `@Model`, `@Identifier`, `@Prop`, `DataScheme`, `defineCollection`, `DataSource`,
  `createBaseDriver`, `driver.bootstrap`; хуки `createDataSourceHooks` → `useAll`, `useEntity`, `useCount`, `useFindBy`,
  `useMutations`.

| Пакет | Версия | Откуда | Типовое: min | Типовое: gzip* | Полный API: min | Полный API: gzip* |
|------|------|------|--:|--:|--:|--:|
| `@companix/xeo-react` | 0.1.3 | основной | 2,8 | 1,2 | 2,7 | 1,1 |
| `@companix/xeo-scheme` | 0.1.32 | зависимость `@companix/xeo-react` | 29,5 | 7,6 | 31,8 | 8,3 |
| `@companix/utils-js` | 0.0.68 | зависимость `@companix/xeo-scheme` | 0,5 | 0,3 | 0,6 | 0,4 |
| `fast-deep-equal` | 3.1.3 | зависимость `@companix/xeo-scheme` | 0,7 | 0,3 | 0,7 | 0,3 |
| **Итого стек** | | | **33,5** | **8,9** | **35,8** | **9,6** |

### Redux Toolkit — `@reduxjs/toolkit` + `react-redux`

- **Что даёт:** store с иммутабельными обновлениями через immer, `createSlice`, нормализацию (`createEntityAdapter`),
  мемоизированные селекторы (reselect), thunk и интеграцию с Redux DevTools. Dev-проверки вырезаются из
  production-сборки. RTK Query — отдельный entry `@reduxjs/toolkit/query/react`, он не измерялся.
- **В типовом приложении:** `configureStore`, `createSlice`, `createEntityAdapter`, `createSelector`; `Provider`,
  `useSelector`, `useDispatch`.
- Пакеты `@standard-schema/*` нужны только RTK Query, а `@types/use-sync-external-store` содержит только типы, поэтому в
  бандл они не попадают.

| Пакет | Версия | Откуда | Типовое: min | Типовое: gzip* | Полный API: min | Полный API: gzip* |
|------|------|------|--:|--:|--:|--:|
| `@reduxjs/toolkit` | 2.13.0 | основной | 11,4 | 4,6 | 22,9 | 8,9 |
| `@standard-schema/spec` (в бандл не попадает) | 1.1.0 | зависимость `@reduxjs/toolkit` | 0 | 0 | 0 | 0 |
| `@standard-schema/utils` (в бандл не попадает) | 0.3.0 | зависимость `@reduxjs/toolkit` | 0 | 0 | 0 | 0 |
| `immer` | 11.2.9 | зависимость `@reduxjs/toolkit` | 9,6 | 3,9 | 9,6 | 3,9 |
| `redux` | 5.0.1 | зависимость `@reduxjs/toolkit` | 2,9 | 1,3 | 3,2 | 1,3 |
| `redux-thunk` | 3.1.0 | зависимость `@reduxjs/toolkit` | 0,1 | 0,1 | 0,1 | 0,1 |
| `reselect` | 5.3.0 | зависимость `@reduxjs/toolkit` | 2,9 | 1,3 | 4,1 | 1,8 |
| `react-redux` | 9.3.1 | основной | 2,8 | 1,2 | 9,6 | 3,7 |
| `@types/use-sync-external-store` (только типы) | 0.0.6 | зависимость `react-redux` | 0 | 0 | 0 | 0 |
| `use-sync-external-store` | 1.7.0 | зависимость `react-redux` | 0,8 | 0,5 | 0,8 | 0,5 |
| **Итого стек** | | | **30,5** | **11,7** | **50,3** | **18,7** |

### Redux без RTK — `redux` + `react-redux`

- **Что даёт:** минимальный store, reducer и подписку. Нормализацию и иммутабельные обновления пишет код приложения.
- **В типовом приложении:** `legacy_createStore`; `Provider`, `useSelector`, `useDispatch`, `shallowEqual`.

| Пакет | Версия | Откуда | Типовое: min | Типовое: gzip* | Полный API: min | Полный API: gzip* |
|------|------|------|--:|--:|--:|--:|
| `redux` | 5.0.1 | основной | 1,7 | 0,8 | 3,5 | 1,5 |
| `react-redux` | 9.3.1 | основной | 3,1 | 1,4 | 9,5 | 3,7 |
| `@types/use-sync-external-store` (только типы) | 0.0.6 | зависимость `react-redux` | 0 | 0 | 0 | 0 |
| `use-sync-external-store` | 1.7.0 | зависимость `react-redux` | 0,9 | 0,5 | 0,8 | 0,5 |
| **Итого стек** | | | **5,8** | **2,5** | **13,8** | **5,3** |

### MobX — `mobx` + `mobx-react-lite`

- **Что даёт:** прозрачную реактивность (observable, computed, action) и точечные ререндеры через `observer`. Модель
  данных и связи описываются собственными классами приложения.
- **В типовом приложении:** `makeAutoObservable`; `observer`.
- mobx плохо поддаётся tree-shaking: 43,5 из 54,9 КБ min попадают даже в минимальное приложение.

| Пакет | Версия | Откуда | Типовое: min | Типовое: gzip* | Полный API: min | Полный API: gzip* |
|------|------|------|--:|--:|--:|--:|
| `mobx` | 7.1.4 | основной | 43,5 | 12,4 | 54,9 | 15,9 |
| `mobx-react-lite` | 5.1.2 | основной | 4,3 | 1,6 | 4,7 | 1,8 |
| **Итого стек** | | | **47,8** | **13,8** | **59,6** | **17,4** |

### MobX с полным биндингом — `mobx` + `mobx-react`

- **Что даёт:** то же, плюс поддержку классовых компонентов и `Provider`/`inject`. `mobx-react` сам зависит от
  `mobx-react-lite`, поэтому в бандле оба пакета.
- **В типовом приложении:** `makeAutoObservable`; `observer` из `mobx-react`.

| Пакет | Версия | Откуда | Типовое: min | Типовое: gzip* | Полный API: min | Полный API: gzip* |
|------|------|------|--:|--:|--:|--:|
| `mobx` | 7.1.4 | основной | 43,6 | 12,4 | 54,9 | 15,9 |
| `mobx-react` | 10.0.3 | основной | 4,0 | 1,7 | 4,2 | 1,8 |
| `mobx-react-lite` | 5.1.2 | зависимость `mobx-react` | 4,2 | 1,6 | 4,5 | 1,7 |
| **Итого стек** | | | **51,8** | **15,1** | **63,5** | **18,7** |

### MobX-State-Tree — `mobx-state-tree` + `mobx` + `mobx-react-lite`

- **Что даёт:** ближе всех к xeo по возможностям: типизированные модели с runtime-проверкой, идентификаторы и ссылки
  (`types.reference`), дерево владения, union-типы, снапшоты, JSON-патчи и middleware. Работает поверх MobX, поэтому
  платить приходится за обе библиотеки.
- **В типовом приложении:** `types.model`, `types.map`, `types.identifierNumber`, `.views`, `.actions`; `observer`.
- `ts-essentials` — библиотека типов, в бандл не попадает.

| Пакет | Версия | Откуда | Типовое: min | Типовое: gzip* | Полный API: min | Полный API: gzip* |
|------|------|------|--:|--:|--:|--:|
| `mobx-state-tree` | 9.0.0 | основной | 62,8 | 18,0 | 74,2 | 21,4 |
| `ts-essentials` (в бандл не попадает) | 9.4.2 | зависимость `mobx-state-tree` | 0 | 0 | 0 | 0 |
| `mobx` | 7.1.4 | peer от `mobx-state-tree` | 48,7 | 14,1 | 55,1 | 15,9 |
| `mobx-react-lite` | 5.1.2 | основной | 4,3 | 1,6 | 4,7 | 1,8 |
| **Итого стек** | | | **115,8** | **33,1** | **134,0** | **38,5** |

### Zustand — `zustand`

- **Что даёт:** store на хуках с селекторами. Нормализацию и производные значения пишет код приложения.
- **В типовом приложении:** `create`, `useShallow`.
- Zustand 5 использует встроенный в React 18 `useSyncExternalStore`, поэтому `use-sync-external-store` ему не нужен (он
  требуется только для `zustand/traditional`).

| Пакет | Версия | Откуда | Типовое: min | Типовое: gzip* | Полный API: min | Полный API: gzip* |
|------|------|------|--:|--:|--:|--:|
| `zustand` | 5.0.16 | основной | 1,6 | 0,8 | 1,6 | 0,8 |
| **Итого стек** | | | **1,6** | **0,8** | **1,6** | **0,8** |

### Zustand + immer — `zustand` + `immer`

- **Что даёт:** то же, плюс мутабельный синтаксис обновлений через immer middleware. Этот вариант отдельно показывает
  цену immer: 9,6 КБ min / 4,0 КБ gzip.
- **В типовом приложении:** `create`, `immer` из `zustand/middleware/immer`, `useShallow`.

| Пакет | Версия | Откуда | Типовое: min | Типовое: gzip* | Полный API: min | Полный API: gzip* |
|------|------|------|--:|--:|--:|--:|
| `zustand` | 5.0.16 | основной | 1,7 | 0,8 | 1,9 | 0,8 |
| `immer` | 11.2.9 | основной | 9,6 | 4,0 | 18,8 | 7,0 |
| **Итого стек** | | | **11,3** | **4,6** | **20,7** | **7,7** |

### Jotai — `jotai`

- **Что даёт:** атомарную модель: атомы, производные атомы, атомы-действия и утилиты.
- **В типовом приложении:** `atom`, `useAtomValue`, `useSetAtom`, `selectAtom` из `jotai/utils`.

| Пакет | Версия | Откуда | Типовое: min | Типовое: gzip* | Полный API: min | Полный API: gzip* |
|------|------|------|--:|--:|--:|--:|
| `jotai` | 3.0.1 | основной | 8,4 | 3,7 | 15,2 | 6,2 |
| **Итого стек** | | | **8,4** | **3,7** | **15,2** | **6,2** |

### Valtio — `valtio`

- **Что даёт:** proxy-состояние с мутабельным API. `useSnapshot` отслеживает прочитанные поля через `proxy-compare`.
- **В типовом приложении:** `proxy`, `useSnapshot`.

| Пакет | Версия | Откуда | Типовое: min | Типовое: gzip* | Полный API: min | Полный API: gzip* |
|------|------|------|--:|--:|--:|--:|
| `valtio` | 2.3.2 | основной | 3,5 | 1,6 | 4,0 | 1,8 |
| `proxy-compare` | 3.0.1 | зависимость `valtio` | 2,6 | 1,2 | 2,5 | 1,2 |
| **Итого стек** | | | **6,1** | **2,6** | **6,5** | **2,7** |

### Effector — `effector` + `effector-react`

- **Что даёт:** события, сторы, эффекты, реактивный граф и scope для SSR и тестов.
- **В типовом приложении:** `createEvent`, `createStore`, `.on`, `.map`; `useUnit`, `useStoreMap`.

| Пакет | Версия | Откуда | Типовое: min | Типовое: gzip* | Полный API: min | Полный API: gzip* |
|------|------|------|--:|--:|--:|--:|
| `effector` | 23.4.4 | основной | 14,1 | 6,6 | 30,1 | 13,1 |
| `effector-react` | 23.3.0 | основной | 2,8 | 1,4 | 7,6 | 3,2 |
| `use-sync-external-store` | 1.7.0 | зависимость `effector-react` | 1,7 | 0,8 | 1,7 | 0,8 |
| **Итого стек** | | | **18,6** | **8,4** | **39,5** | **16,5** |

### XState — `xstate` + `@xstate/react`

- **Что даёт:** конечные автоматы и акторную модель. Это другой класс задач; XState включён в сравнение как одна из
  самых популярных state-библиотек. Для простого store у тех же авторов есть `@xstate/store` (не измерялся).
- **В типовом приложении:** `setup`, `createMachine`, `assign`; `createActorContext`, `shallowEqual`.

| Пакет | Версия | Откуда | Типовое: min | Типовое: gzip* | Полный API: min | Полный API: gzip* |
|------|------|------|--:|--:|--:|--:|
| `xstate` | 5.33.3 | основной | 39,5 | 13,0 | 47,6 | 15,1 |
| `@xstate/react` | 6.1.0 | основной | 2,1 | 1,1 | 2,5 | 1,2 |
| `use-isomorphic-layout-effect` | 1.2.1 | зависимость `@xstate/react` | 0,1 | 0,1 | 0,1 | 0,1 |
| `use-sync-external-store` | 1.7.0 | зависимость `@xstate/react` | 1,7 | 0,8 | 1,7 | 0,8 |
| **Итого стек** | | | **43,5** | **14,5** | **51,9** | **16,7** |

### Nanostores — `nanostores` + `@nanostores/react`

- **Что даёт:** атомы, map-сторы с подпиской на отдельные ключи и computed.
- **В типовом приложении:** `map`, `computed`; `useStore` с опцией `keys`.

| Пакет | Версия | Откуда | Типовое: min | Типовое: gzip* | Полный API: min | Полный API: gzip* |
|------|------|------|--:|--:|--:|--:|
| `nanostores` | 1.5.5 | основной | 2,5 | 1,3 | 5,4 | 2,4 |
| `@nanostores/react` | 2.0.1 | основной | 0,4 | 0,3 | 0,7 | 0,4 |
| **Итого стек** | | | **2,9** | **1,5** | **6,1** | **2,7** |

### Preact Signals — `@preact/signals-react`

- **Что даёт:** сигналы и computed с точечной подпиской. Без Babel-плагина компонент подписывается вызовом
  `useSignals()`; с плагином `@preact/signals-react-transform` код приложения будет другим (плагин не измерялся).
- **В типовом приложении:** `signal`, `computed`, `useSignals`.

| Пакет | Версия | Откуда | Типовое: min | Типовое: gzip* | Полный API: min | Полный API: gzip* |
|------|------|------|--:|--:|--:|--:|
| `@preact/signals-react` | 3.12.0 | основной | 1,9 | 0,9 | 2,8 | 1,2 |
| `@preact/signals-core` | 1.14.5 | зависимость `@preact/signals-react` | 4,8 | 1,7 | 5,7 | 2,1 |
| `use-sync-external-store` | 1.7.0 | зависимость `@preact/signals-react` | 0,8 | 0,4 | 0,8 | 0,4 |
| **Итого стек** | | | **7,5** | **2,8** | **9,2** | **3,4** |

### Legend State v2 — `@legendapp/state`

- **Что даёт:** observable-деревья с точечной подпиской и computed. Persist-плагины — отдельные entry, они не
  измерялись.
- **В типовом приложении:** `observable`, `computed`; `observer`.
- `use-sync-external-store` объявлен в зависимостях, но React-entry версии 2 его не импортирует, поэтому в бандл он не
  попадает.

| Пакет | Версия | Откуда | Типовое: min | Типовое: gzip* | Полный API: min | Полный API: gzip* |
|------|------|------|--:|--:|--:|--:|
| `@legendapp/state` | 2.1.15 | основной | 17,8 | 7,1 | 24,6 | 9,5 |
| `use-sync-external-store` (в бандл не попадает) | 1.7.0 | зависимость `@legendapp/state` | 0 | 0 | 0 | 0 |
| **Итого стек** | | | **17,8** | **7,1** | **24,6** | **9,5** |

### TinyBase 5 — `tinybase` + `tinybase/ui-react`

- **Что даёт:** табличный store (tables, rows, cells), схемы, а также индексы, связи, запросы и метрики — отдельные
  модули в том же entry; в типовое приложение они не попали. Persisters и синхронизация подключаются через отдельные
  entry.
- **В типовом приложении:** `createStore`; `Provider`, `useCell`, `useRowIds`, `useTable`.
- Из всех стеков TinyBase лучше всего поддаётся tree-shaking: в типовое приложение попадает 36 % полного API.

| Пакет | Версия | Откуда | Типовое: min | Типовое: gzip* | Полный API: min | Полный API: gzip* |
|------|------|------|--:|--:|--:|--:|
| `tinybase` | 5.4.9 | основной | 15,6 | 7,1 | 43,6 | 17,8 |
| **Итого стек** | | | **15,6** | **7,1** | **43,6** | **17,8** |

## Из чего состоит xeo-scheme

npm-пакет xeo-scheme — один заранее минифицированный файл без source map, поэтому для разбивки по модулям то же типовое
приложение собрано из исходников `xeo/scheme/lib` (с `globalThis.__DEV__ = false` и удалением `console.*`, как в
`rollup.config.ts` пакета). Итог совпадает с npm-пакетом с точностью до 0,6 %: 29,7 против 29,5 КБ min.

| Модуль `xeo/scheme/lib` | Типовое: min | Типовое: gzip* | Полный API: min | Полный API: gzip* |
|------|--:|--:|--:|--:|
| `core/data-processor.ts` | 11,3 | 2,6 | 11,3 | 2,6 |
| `core/data-scheme.ts` | 4,6 | 1,4 | 5,1 | 1,4 |
| `storages/metadata.storage.ts` | 2,8 | 0,8 | 2,8 | 0,8 |
| `base-driver/collections.driver.ts` | 1,7 | 0,5 | 2,3 | 0,8 |
| `base-driver/table.driver.ts` | 2,2 | 0,8 | 2,2 | 0,8 |
| `core/changes-tracker/observer.ts` | 1,9 | 0,9 | 1,9 | 0,8 |
| `base-driver/indexed.collection.ts` | 1,7 | 0,8 | 1,7 | 0,7 |
| `core/data-source.ts` | 0,7 | 0,3 | 0,7 | 0,3 |
| `core/helpers/query-builder.ts` | 0,7 | 0,4 | 0,7 | 0,4 |
| `core/changes-tracker/array-plugins.ts` | 0,4 | 0,2 | 0,4 | 0,2 |
| `decorators/relations/ownership.decorator.ts` | 0,4 | 0,2 | 0,4 | 0,2 |
| `decorators/relations/model-to-model.decorators.ts` | 0,4 | 0,2 | 0,4 | 0,2 |
| `utils/x-ray.ts` | 0 | 0 | 0,3 | 0,2 |
| `decorators/relations/references.decorator.ts` | 0 | 0 | 0,3 | 0,1 |
| `utils/get-deep-value.ts` | 0,3 | 0,2 | 0,3 | 0,2 |
| `core/helpers/errors.ts` | 0,1 | 0,1 | 0,2 | 0,2 |
| `core/changes-tracker/index.ts` | 0,2 | 0,1 | 0,2 | 0,1 |
| `decorators/discriminated-model.decorator.ts` | 0 | 0 | 0,1 | 0,1 |
| `decorators/link-embedded.decorator.ts` | 0 | 0 | 0,1 | 0,1 |
| `decorators/identifier.decorator.ts` | 0,1 | 0,1 | 0,1 | 0,1 |
| `decorators/embedded.decorator.ts` | 0 | 0 | 0,1 | 0,1 |
| `utils/is-target-equal.ts` | 0,1 | 0,1 | 0,1 | 0,1 |
| `decorators/prop.decorator.ts` | 0,1 | 0,1 | 0,1 | 0,1 |
| `decorators/discriminator.decorator.ts` | 0 | 0 | 0,1 | 0,1 |
| `core/types/driver.types.ts` | 0 | 0 | 0,1 | 0,1 |
| `decorators/model.decorator.ts` | 0,1 | 0,1 | 0,1 | 0,1 |
| `utils/dev.ts` | 0 | 0 | 0,0 | 0,0 |
| **Итого xeo-scheme** | **29,7** | **7,6** | **31,9** | **8,2** |

`DataProcessor` (`core/data-processor.ts`) по методам, в типовом приложении:

| Метод | min | gzip* | Нужен типовому приложению |
|------|--:|--:|:---:|
| `changeDiscriminator` | 2,8 | 0,9 | нет |
| `getRemoveQueries` (запреты и каскад удаления) | 2,4 | 0,7 | да, через `remove` |
| `update` | 2,2 | 0,9 | да |
| `create` | 1,8 | 0,6 | да |
| `getExternalRelations` | 0,7 | 0,3 | нет |
| `save` | 0,5 | 0,2 | да |
| `getModelReferences`, `getModelProperiesMap`, `getModelId` | 0,4 | 0,2 | да |
| `composeDiscriminatedData` | 0,2 | 0,2 | нет |
| хелперы модуля и конструктор | 0,1 | 0,1 | да |
| `remove` | 0,1 | 0,1 | да |
| **Итого** | **11,3** | | |

Выводы по xeo:

- Цена xeo почти постоянна. Tree-shaking убирает из полного API только 2,2 КБ min: `x-ray`, декораторы `@ReferenceTo`,
  embedded и дискриминаторов, а также часть кода `DataScheme` и `collections.driver`. Всё остальное статически связано с
  `DataScheme`, `DataSource` и `DataProcessor`.
- Неиспользуемые методы остаются в бандле, потому что Rollup, esbuild и Rolldown не удаляют методы классов. В приложении
  без дискриминаторов и без `getExternalRelations` это 3,8 КБ min (~1,1 КБ gzip) только в `DataProcessor`. Сэкономить их
  можно, только если на эти операции не будет статических ссылок: сейчас конструктор `DataSource` добавляет
  `changeDiscriminator` и `getExternalRelations` в API каждой коллекции, так что одного выноса методов из класса в
  функции недостаточно.
- Хорошее сжатие — следствие длинных несокращаемых имён свойств и методов. Для сети это плюс, для времени парсинга нет:
  по несжатому размеру xeo (33,8 КБ) на уровне Redux Toolkit (30,6 КБ).
- Сторонних runtime-зависимостей у xeo две, вместе 1,2 КБ min. React-биндинг `xeo-react` (2,8 КБ min) сопоставим с
  другими биндингами в типовом приложении: `react-redux` 2,8–3,1, `effector-react` 2,8, `@xstate/react` 2,1,
  `mobx-react-lite` 4,3 КБ min.

## Как читать эти числа

- Библиотеки функционально не равны. 0,7 КБ Zustand и 9,3 КБ xeo покупают разные вещи: в первом случае store, во втором
  — схему, связи, каскады, патчи и подписку на уровне полей. На Zustand всё это пришлось бы писать в коде приложения.
  Честнее всего сравнивать xeo с библиотеками, которые берут на себя модель данных: MobX-State-Tree (33,2 КБ), Redux
  Toolkit (11,6 КБ, но без схемы и связей), TinyBase (7,2 КБ в типовом приложении и до 17,8 КБ при полном API со
  связями, запросами, индексами и метриками).
- Типовое приложение маленькое и не использует связи ни в одном стеке. xeo и MobX-State-Tree платят за связи всё равно,
  а TinyBase и Redux Toolkit — только когда их используют. Поэтому для приложения, активно использующего связи, полезнее
  смотреть на колонку «полный API».
- Точные числа — прирост в сводной таблице и размеры файлов в таблице полного API. Строки «Итого» в таблицах состава —
  совместное сжатие фрагментов библиотек, они расходятся с приростом не больше чем на ±0,4 КБ gzip. gzip отдельных
  пакетов — оценка, завышенная на 2–11 %.
- Все размеры — production-сборки с `NODE_ENV=production`; dev-сборки заметно больше у всех библиотек.

## Как воспроизвести

Стенд собирался во временном каталоге вне репозитория:

1. Пустой проект с зависимостями из таблиц выше (`npm i --ignore-scripts`) и `tsconfig.json` с `"jsx": "react-jsx"`,
   `"experimentalDecorators": true` и `"strictPropertyInitialization": false`, как в самом xeo-scheme.
2. Для каждого стека — `apps/<стек>/index.html` и `main.tsx` по сценарию выше, плюс общий `apps/shared.tsx`. Для полного
   API — `full/<стек>.ts` с `import * as` всех entry points.
3. Программный `vite.build()` с `configFile: false` и `build.sourcemap: 'hidden'`, для полного API с
   `rollupOptions.external` для `react` и `react-dom`.
4. Разбор source map через `source-map-js`, сжатие через `node:zlib` (gzip level 9, brotli quality 11), smoke-тест в
   jsdom 26.

Для примера — вариант xeo, который измерялся (`Row`, `Stats`, `AddButton`, `mount`, `seed` и `newTodo` взяты из общего
`shared.tsx`):

```tsx
@Model({ name: 'Todo' })
class TodoModel {
  @Identifier({ type: 'number' })
  id: number

  @Prop({ type: 'string' })
  title: string

  @Prop({ type: 'boolean' })
  done: boolean
}

const scheme = new DataScheme({ todo: defineCollection(TodoModel, 'id') })
const dataSource = new DataSource(scheme, { createDriver: createBaseDriver })
dataSource.driver.bootstrap({ todo: seed.map((todo) => ({ ...todo })) })

const { useAll, useEntity, useFindBy, useCount, useMutations } = createDataSourceHooks(dataSource)

const TodoItem = ({ id }: { id: number }) => {
  const todo = useEntity('todo', id)
  const { update, remove } = useMutations('todo')

  if (!todo) {
    return null
  }

  return (
    <Row
      id={id}
      title={todo.title}
      done={todo.done}
      onToggle={() => update(id, (draft) => void (draft.done = !draft.done))}
      onRename={() => update(id, (draft) => void (draft.title += '!'))}
      onRemove={() => remove(id)}
    />
  )
}

const TodoList = () => {
  const todos = useAll('todo')
  return <ul id="list">{todos.map((todo) => <TodoItem key={todo.id} id={todo.id} />)}</ul>
}

const StatsBox = () => {
  const total = useCount('todo')
  const done = useFindBy('todo', { done: true }).length
  return <Stats total={total} done={done} />
}
```
