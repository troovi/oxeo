# oxeo

Библиотека данных для приложений с сервером и клиентом. Проект описывает схему данных и бизнес-операции в одном месте,
oxeo следит за целостностью и связями, сервер исполняет операции, а клиент держит только ту часть базы, которую читает,
и получает изменения готовыми.

Устройство держится на одном правиле: **операцию исполняет только сервер**. Клиент домены не повторяет, поэтому полная
копия базы ему не нужна.

Раньше библиотека называлась xeo: её опубликованная версия 0.1 — пакеты `@companix/xeo-*`.

## Структура проекта

oxeo предполагает три части: общее ядро и два приложения над ним.

```
project/
  core/                  схемы, домены и параметры операций — общие для сервера и клиента
    keys.ts              перечисления: значения без oxeo, их можно импортировать и на клиенте
    scheme.ts            модели и DataScheme
    domains/
      index.ts           реестр доменов
      params.ts          реестр схем параметров — рантайму
      <name>/
        <name>.domain.ts операции
        <name>.params.ts параметры операций на zod
  server/                серверное приложение: рантайм доменов, драйвер базы, маршруты
  client/                клиентское приложение: клиент oxeo, компоненты
```

| Часть    | Что в ней                                 | Как использует `core` | Пакеты oxeo                           |
| -------- | ----------------------------------------- | --------------------- | ------------------------------------ |
| `core`   | схемы, домены, параметры операций         | —                     | `@oxeo/scheme`                         |
| `server` | рантайм, драйвер, маршруты, транспорт     | исполняет в рантайме  | `@oxeo/server`, драйвер базы           |
| `client` | клиент oxeo, компоненты, экраны            | **только типы**       | `@oxeo/client`, привязка (`@oxeo/react`) |

Главное правило структуры: клиент импортирует из `core` только типы, через `import type`. Схемы, реализация доменов и
zod предназначены серверу. Из `import type` сборщик ничего не берёт, поэтому ни декораторы, ни домены, ни zod в сборку
клиента не попадают, а клиент всё равно знает тип каждой записи и каждого вызова.

Значения из `core` клиент импортирует только из файлов без oxeo: например, перечисления `keys.ts`. Импорт значения из
файла со схемой или доменом потянет за собой весь `@oxeo/scheme`.

## core

Схема — модели на декораторах и `DataScheme` над ними. Связи объявляются в схеме, целостность держит oxeo.

```ts
// core/scheme.ts
import {
  DataScheme,
  Identifier,
  InferScheme,
  Model,
  Prop,
  ReferenceTo,
  defineCollection
} from '@oxeo/scheme'

@Model({ name: 'Counter' })
export class Counter {
  @Identifier({ type: 'string' })
  source: string

  @Prop({ type: 'number' })
  seq: number
}

@Model({ name: 'Author' })
export class Author {
  @Identifier({ type: 'number' })
  authorId: number

  @Prop({ type: 'string' })
  name: string
}

@Model({ name: 'Note' })
export class Note {
  @Identifier({ type: 'number' })
  noteId: number

  @Prop({ type: 'string' })
  text: string

  @Prop({ type: 'number' })
  createdAt: number

  @ReferenceTo(() => Author)
  authorId: Author['authorId']
}

export const dataScheme = new DataScheme({
  counter: defineCollection(Counter, 'source'),
  author: defineCollection(Author, 'authorId'),
  note: defineCollection(Note, 'noteId')
})

export type AppScheme = InferScheme<typeof dataScheme>
```

Домен — класс над своим окружением. Коллекции и выдача идентификаторов одни на все вызовы, поэтому приходят в
конструктор. То, что у каждого вызова своё, — актор, момент и дата — приходит вторым аргументом метода, контекстом.
Метод, которому контекст не нужен, его не объявляет. Отказ — `DomainError`.

```ts
// core/domains/notes/notes.domain.ts
import { Collections, DomainContext, DomainError, IdSource } from '@oxeo/scheme'
import { z } from 'zod'
import { AppScheme } from '../../scheme'
import { NotesParams } from './notes.params'

export class NotesDomain {
  constructor(
    private collections: Collections<AppScheme>,
    private ids: IdSource
  ) {}

  /** Новая заметка автора; возвращает её номер. */
  async add(params: z.infer<typeof NotesParams.Add>, ctx: DomainContext) {
    if (!(await this.collections.author.exists(params.authorId))) {
      throw new DomainError('notFound', 'Автор не найден')
    }

    const noteId = await this.ids.number('notes')

    await this.collections.note.create({ noteId, createdAt: ctx.at, ...params })

    return noteId
  }
}
```

Параметры операций выводятся из моделей через `schemaOf`, реестр доменов и его тип экспортируются из
`core/domains/index.ts`. Схемы собираются в реестр `createDomainsParams`: по типу доменов он знает все публичные методы,
поэтому компилятор не пропустит метод без схемы, лишний метод и схему не того типа.

```ts
// core/domains/notes/notes.params.ts
import { schemaOf } from '@oxeo/scheme'
import { Note } from '../../scheme'

export namespace NotesParams {
  export const Add = schemaOf(Note).pick({ text: true, authorId: true })
}

// core/domains/index.ts
export const appDomains = { notes: NotesDomain }

export type AppDomains = typeof appDomains

// core/domains/params.ts
import { createDomainsParams } from '@oxeo/scheme'
import type { AppDomains } from './index'
import { NotesParams } from './notes/notes.params'

export const appParams = createDomainsParams<AppDomains>({
  notes: { add: NotesParams.Add }
})
```

## server

Сервер собирает `DataSource` над драйвером и `DomainRuntime` над доменами. Рантайм выполняет вызовы строго по одному,
рассылает события всем клиентам и отвечает на пакеты запросов. Фреймворк и транспорт — забота приложения: `runtime.run` и
`runtime.query` вешаются на свои маршруты, `broadcast` уходит в свой поток событий.

Параметры каждого вызова проверяет сам рантайм, поэтому маршруту проверять их не нужно. Операции нет в реестре схем —
`DomainError` с кодом `notFound`, параметры не прошли — `ParamsError` с `issues`. Перевести отказ в ответ — забота
приложения.

```ts
// server/runtime.ts
import { createMongoDriver } from '@oxeo-drivers/mongo'
import { DataSource, DomainRuntime } from '@oxeo/server'
import { appDomains } from '../core/domains'
import { appParams } from '../core/domains/params'
import { dataScheme } from '../core/scheme'

const source = new DataSource(dataScheme, { createDriver: createMongoDriver({ connection }) })

export const runtime = new DomainRuntime({
  domains: appDomains,
  params: appParams,
  dataSource: source,
  counterCollection: 'counter',
  resolveActor: (identity) => resolveActor(identity),
  today: (at) => toDateISO(at),
  broadcast: (event) => stream.send(event),
  onPartialWrite: () => stream.resync()
})
```

Драйвер подключается отдельным пакетом. `@oxeo-drivers/mongo` хранит данные в MongoDB и даёт модуль NestJS
(`MongooseDriverModule`, `InjectDataSource`), `@oxeo-drivers/memory` держит их в памяти процесса: он нужен тестам
доменов и песочницам.

## client

Клиент собирается из типов `core` и транспорта. В рантайме от `core` ему ничего не нужно.

```ts
// client/data.ts
import { createClient } from '@oxeo/client'
import { createObserver, createUseData } from '@oxeo/react'
import type { AppDomains } from '../core/domains'
import type { AppScheme } from '../core/scheme'

export const client = createClient<AppScheme, AppDomains>({ transport })

export const { data, DomainsAPI } = client
export const observer = createObserver(client, { fallback: <Spinner />, error: (props) => <LoadError {...props} /> })
export const useData = createUseData(client)
```

Компонент в обёртке `observer` читает данные прямыми вызовами. Недостающее уходит одним пакетом запросов, а пока ответа
нет, обёртка рисует заглушку. Код компонента о загрузке не знает.

```tsx
export const NotePage = observer(({ noteId }: { noteId: number }) => {
  const note = data.note.get(noteId)

  if (!note) {
    return <NotFound />
  }

  return <NoteView note={note} author={data.author.get(note.authorId)} />
})

// операция: исполняет сервер, после await клиент уже держит новые версии записей
await DomainsAPI.notes.add({ text, authorId })
```

Поток событий открывает приложение и передаёт сообщения в `client.push` и `client.resync`. После обрыва потока
приложение вызывает `client.resync`: события за время обрыва потеряны.

## Пакеты

Репозиторий делится на группы: `core/*` — пакеты ядра, `drivers/*` — драйверы баз данных, `tools/*` — инструменты
разработки. Рядом с ними — `sandbox`, песочница версий библиотеки.

| Папка            | Пакет                         | Что в нём                                                                            | Кто берёт                    |
| ---------------- | ----------------------------- | ------------------------------------------------------------------------------------ | ---------------------------- |
| `core/scheme`    | `@oxeo/scheme`        | декораторы, `DataScheme`, `schemaOf`, контракт доменов и коллекций, фильтр, протокол | `core`; клиент — только типы |
| `core/server`    | `@oxeo/server`        | `DataSource`, `DataProcessor`, `DomainRuntime`, договор драйвера                     | сервер                       |
| `core/client`    | `@oxeo/client`        | живая часть базы, чтения, пакеты запросов, события, вызовы операций                  | клиент                       |
| `core/react`     | `@oxeo/react`         | `createObserver`, `createUseData`                                                    | клиент на React              |
| `core/types`     | `@oxeo/types`         | типы HTTP-маршрутов и файлов                                                         | приложения                   |
| `drivers/mongo`  | `@oxeo-drivers/mongo`  | драйвер MongoDB, модуль NestJS                                                       | сервер                       |
| `drivers/memory` | `@oxeo-drivers/memory` | драйвер в памяти процесса                                                            | тесты доменов, песочницы     |
| `tools/devkit`   | `@oxeo/devkit`        | макетная схема и кейсы целостности; не публикуется                                   | тесты пакетов                |
| `tools/visual`   | `@oxeo/visual`        | интерактивная карта схемы                                                            | проект, для разработки       |
| `sandbox`        | `@oxeo/sandbox`       | песочница версий библиотеки; не публикуется, устройство — `sandbox/README.md`        | разработка oxeo               |

Зависимости идут в одну сторону. Драйверы зависят от `@oxeo/server`, он — от `@oxeo/scheme`. Клиентская ветка от
серверной не зависит.

```
@oxeo/scheme  <-  @oxeo/server  <-  @oxeo-drivers/mongo, @oxeo-drivers/memory
@oxeo/scheme  <-  @oxeo/client  <-  @oxeo/react            только типы: фильтр вшит в сборку клиента
```

Что куда кладётся:

- `@oxeo/scheme` — то, на чём пишется `core`, и типы, общие для сервера и клиента: `Collections`, `Where`,
  `DomainContext`, протокол. Домены и схемы импортируют только его.
- `@oxeo/server` — всё, что исполняется только на сервере. Конкретных драйверов и фреймворка в нём нет.
- `@oxeo/client` — всё, что исполняется только на клиенте. От схемы он берёт типы.

Единственное общее для сервера и клиента в рантайме — сверка записи с фильтром `matches`: тот же код работает в драйвере
памяти и на клиенте. Поэтому у `@oxeo/scheme` два входа: главный и `@oxeo/scheme/filter` без декораторов и zod. Сборка
`@oxeo/client` вшивает этот вход в себя, и в рантайме клиент к `@oxeo/scheme` не обращается.

## Разработка

Репозиторий самостоятельный: свой `package.json` с workspaces, свой `node_modules`. Библиотеки автора (`utils-js`, а
песочнице ещё `uikit`, `formkit` и другие) приходят из npm. Команды — из корня.

```
npm install
npm run build      # все пакеты в нужном порядке
npm test           # тесты core/scheme, core/server и core/client
npm run test:mongo # кейсы целостности на MongoDB (127.0.0.1:27017, база oxeo-test)
```

Тесты драйвера идут на `mongoose` 9.3.3, закреплённом в `drivers/mongo`: начиная с драйвера `mongodb` 7.6 рукопожатие с
базой под jest не проходит, на обычном Node оно работает. Диапазон для приложений — `^9.0.0`.

Порядок сборки важен: `@oxeo/scheme`, затем `@oxeo/server`, драйверы, `@oxeo/client`, `@oxeo/react` и `@oxeo/devkit`.
Пакеты подключают друг друга собранными, а `@oxeo/client` вшивает в себя вход `filter` из `dist` пакета `@oxeo/scheme`.

Публикация — `.github/workflows/publish.yml`, пока выключена: push workflow не запускает. Когда она включена, push в
`master` публикует пакет, у которого изменился `package.json`; нужен секрет `NPM_TOKEN`. Номер версии поднимается
вручную.
