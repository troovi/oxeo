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
    views/
      index.ts           реестр представлений
      params.ts          реестр схем параметров представлений — рантайму
      <name>.views.ts    чтения, которые считает сервер
  server/                серверное приложение: рантайм доменов, драйвер базы, маршруты
  client/                клиентское приложение: клиент oxeo, компоненты
```

| Часть    | Что в ней                               | Как использует `core` | Пакеты oxeo                              |
| -------- | --------------------------------------- | --------------------- | ---------------------------------------- |
| `core`   | схемы, домены, представления, параметры | —                     | `@oxeo/scheme`                           |
| `server` | рантайм, драйвер, маршруты, транспорт   | исполняет в рантайме  | `@oxeo/server`, драйвер базы             |
| `client` | клиент oxeo, компоненты, экраны         | **только типы**       | `@oxeo/client`, привязка (`@oxeo/react`) |

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

Пакет запросов не падает целиком из-за одного запроса. Коллекции нет, параметры представления не прошли схему,
представление упало — результатом этого запроса будет `{ error: { code, message } }`, а остальные запросы пакета
ответят как обычно. Непредвиденная ошибка уходит клиенту кодом `internal` без подробностей, а сама она попадает в
опцию `onQueryError`, где её логирует приложение.

Пакет считается мимо очереди вызовов, поэтому может застать операцию на середине. Ответ несёт эпоху и ревизию —
последнюю выданную, когда расчёт начался: всё до неё ответ учёл, более позднее мог учесть частично. По ней клиент
склеивает ответ с событиями (раздел «Поток событий»).

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

### Представления

Представление — чтение, которое считает сервер и отдаёт клиенту значением: сводки, агрегаты, выборки с логикой, которую
не выражает фильтр. Клиенту не нужны записи, из которых значение сложено. Класс представлений получает в конструкторе
только коллекции, метод — `(params, ctx)`, где `ctx` — кто смотрит и какой сегодня день; результат — JSON. Параметры, как у
операций, проверяет реестр схем.

```ts
// core/views/stats.views.ts
export class StatsViews {
  constructor(private collections: Collections<AppScheme>) {}

  async drafts(params: { authorId: number }, ctx: ViewContext<Actor>) {
    return this.collections.note.count({ authorId: params.authorId, status: 'draft' })
  }
}

// core/views/index.ts
export const appViews = { stats: StatsViews }

export type AppViews = typeof appViews

// core/views/params.ts
export const appViewParams = createViewsParams<AppViews>({
  stats: { drafts: z.object({ authorId: z.number() }) }
})

// server/runtime.ts
new DomainRuntime({ domains, params, views: appViews, viewParams: appViewParams, … })

// маршрут пакета запросов: идентичность — для ctx представлений
runtime.query(batch, identity)
```

Рантайм кэширует значение на день по представлению, методу, параметрам и идентичности. Расчёт идёт над коллекциями,
которые запоминают, что прочитано, и не дают писать: запись из представления — `DomainError` с кодом `forbidden`.
Операция, которая писала в прочитанные коллекции, — удачная или упавшая на полпути, — сбрасывает значение. Ответ несёт
значение и список прочитанных коллекций: по нему клиент знает, когда перезапросить.

### Порядок и предел

`findBy(filter, { order, limit })` — окно: первые `limit` записей в порядке поля верхнего уровня (число или строка), при
равных значениях — по id по возрастанию; предел без порядка — по id. Пустое значение поля идёт раньше чисел, числа —
раньше строк, как в Mongo. Тот же порядок держат драйвер памяти и клиент (`windowOf` из `@oxeo/scheme/filter`), Mongo —
сортировкой `{ field: ±1, id: 1 }`.

### Драйвер

Драйвер подключается отдельным пакетом. `@oxeo-drivers/mongo` хранит данные в MongoDB и даёт модуль NestJS
(`MongooseDriverModule`, `InjectDataSource`), `@oxeo-drivers/memory` держит их в памяти процесса: он нужен тестам
доменов и песочницам.

Индексы Mongo задаёт схема: `index: true` у `@Prop` (строка, число, `literal`) и `@ReferenceTo` — под поля, по
которым идут выборки. Ключ
родителя `BelongsTo` индексируется всегда: по нему читаются дочерние записи.

## client

Клиент собирается из типов `core` и транспорта. В рантайме от `core` ему ничего не нужно.

```ts
// client/data.ts
import { createClient } from '@oxeo/client'
import type { DbApi, ViewsApi } from '@oxeo/client'
import { createUseDb } from '@oxeo/react'
import type { AppDomains } from '../core/domains'
import type { AppScheme } from '../core/scheme'

export const client = createClient<AppScheme, AppDomains, AppViews>({
  transport,
  onReadError: () => toast('Не удалось загрузить данные')
})

export const { DomainsAPI, read: readDb } = client
export const useDb = createUseDb(client)

export type Db = DbApi<AppScheme>
export type Views = ViewsApi<AppViews>
```

### Чтение

Читают данные только через хук `useDb`. `db` и значения представлений существуют только параметрами его колбэка, поэтому
прочитать мимо подписки нельзя: глобального объекта данных нет. Всё, чего не хватило, уходит одним пакетом запросов.

Хук отдаёт состояние, а что рисовать, решает компонент. Заглушки и вида ошибки у библиотеки нет.

```ts
type DbState<T> =
  | { stage: 'loading'; data: undefined }
  | { stage: 'error'; data: T | undefined; retry: () => void }
  | { stage: 'success'; data: T; isUpdating: boolean }
```

`data` есть в каждой стадии. Мелкой части экрана хватает одной проверки, страница смотрит на стадию: ей надо отличить
загрузку от записи, которой нет.

```tsx
// мелкая часть: загрузка, отказ и «записи нет» — одна проверка
export const AuthorName = ({ authorId }: { authorId: number }) => {
  const { data: author } = useDb((db) => db.author.get(authorId))

  if (!author) {
    return null
  }

  return <span>{author.name}</span>
}

// страница
export const NotePage = ({ noteId }: { noteId: number }) => {
  const state = useDb((db) => db.note.get(noteId))

  if (state.stage !== 'success') {
    return <LoadState state={state} />
  }

  if (!state.data) {
    return <NotFound />
  }

  return <NoteView note={state.data} />
}

// операция: исполняет сервер, после await клиент уже держит новые версии записей
await DomainsAPI.notes.add({ text, authorId })
```

Колбэк выполняется целиком: чтение, которому не хватило данных, отдаёт пустое (`null`, `[]`, `0`), и колбэк идёт дальше,
поэтому независимые чтения уходят одним пакетом. Неполный результат наружу не выходит. Условное чтение — условие в
колбэке. Ошибка полного прохода — настоящая, она идёт в границу ошибок React.

Чтение, нужное нескольким местам, — обычная функция с параметром `db`. Требование видно в сигнатуре, такие функции
складываются друг с другом, и их одинаково зовут `useDb` и `readDb`.

```ts
const readNoteCard = (db: Db, noteId: number) => {
  const note = db.note.get(noteId)

  return note && { note, author: db.author.get(note.authorId) }
}

const state = useDb((db) => readNoteCard(db, noteId))
```

### Прежний результат

Хук держит последний полный результат. Пока догружается новое — сменился фильтр, событие принесло строку со ссылкой на
незагруженную запись, клиент пересинхронизировался, — стадия остаётся `success` с прежними данными и `isUpdating`. Экран
не мигает, и поддерживать это в компоненте не нужно.

Производное, которое должно совпадать с данными, считается внутри колбэка: иначе новый период встретится с записями
прежнего. Другая запись — новый экземпляр компонента через `key`: иначе до ответа виден прежний результат.

```tsx
<NoteDesk key={noteId} noteId={noteId} />
```

### Записи

Запись — прокси над неизменяемой версией: он запоминает прочитанные поля, и компонент перерисовывается только на их
изменение. Прокси новый на каждом проходе, поэтому записи сравнивают по id, а в зависимостях хуков пишут id и примитивы.

Поля, которые читают дети компонента, получившие запись пропсом, тоже учитываются — в проходе, чьи прокси им достались.
Учёт прохода принимается, когда React зафиксировал его рендер: если React вызвал компонент и выбросил результат, на
экране остаются дети прежнего рендера, и правка полей, которые они читают, по-прежнему их перерисовывает.

Записи и значения представлений отдаются без копии. Вне `production` они заморожены вглубь: правка на месте падает
сразу, а не портит данные клиента молча. Режим определяет `process.env.NODE_ENV`, его подставляет сборщик приложения; в
сборке `production` эта ветка вырезается. Копия для правки — `structuredClone` простой записи.

Если хуку нужны прочитанные данные, компонент делится на загрузчик и тело: загрузчик читает, тело получает данные
пропсами. Форме нужна запись на момент открытия, а чтение её полей через прокси подписало бы компонент на запись. Для
этого есть второй аргумент: `once` отдаёт первый полный результат простыми объектами, и дальше хук не подписан.

```tsx
export const NoteEditDialog = ({ noteId, close }: NoteEditDialogProps) => {
  const { data: note } = useDb((db) => db.note.get(noteId), { once: true })

  if (!note) {
    return null
  }

  return <NoteEditForm note={note} close={close} />
}
```

### Разовое чтение

Обработчику `db` недоступен. Он читает `readDb` — тем же колбэком и теми же функциями чтения: покрытое разрешается
сразу, зависимые чтения догружаются сами, записи простые, подписки нет.

```ts
await DomainsAPI.notes.publish({ noteId })

const note = await readDb((db) => db.note.get(noteId))
```

### Значения представлений

Значение представления — второй параметр колбэка. Событие, которое тронуло коллекции, прочитанные представлением, ставит
перезапрос значения; события подряд дают один пакет, до ответа виден прежний результат.

```tsx
const { data } = useDb((db, views) => {
  return {
    drafts: views.stats.drafts({ authorId }),
    latest: db.note.find({ authorId }, { order: { field: 'createdAt', direction: 'desc' }, limit: 5 })
  }
})
```

Окно `find(where, { order, limit })` живёт, как обычный запрос: событие вставляет запись, если она лучше худшей в окне,
и та выходит. Если из полного окна ушла запись или худшая сдвинулась дальше, следующая неизвестна: окно перезапрашивается,
а до ответа показывает прежний состав без ушедшей. Над коллекцией, загруженной целиком, окно считается на месте.

### Отказ

Отказ запроса сервером видит только тот хук, который этот запрос прочитал, соседи показывают свои данные. Хук отдаёт
стадию `error` с `retry`, прежние данные остаются в `data`. Опция клиента `onReadError` сообщает об отказе один раз на
пакет: так приложение показывает его там, где компонент вида ошибки не рисует. Новый монтаж запрашивает упавшее заново.
`readDb` получает отказ промисом (`QueryFailedError` с кодом сервера) и в `onReadError` не приходит. Если отказал
перезапрос устаревшего значения, прежнее значение остаётся.

### Поток событий

Поток событий открывает приложение и передаёт сообщения в `client.push` и `client.resync`. После обрыва потока
приложение вызывает `client.resync`: события за время обрыва потеряны.

Ответ на пакет и поток идут разными каналами, поэтому событие может прийти раньше ответа, снятого до операции, или позже
ответа, который её уже учёл. Клиент склеивает их так, что итог не зависит от порядка прихода:

- у каждой версии записи клиент помнит ревизию, которая её принесла: событие — свою, ответ — «после своей». Версия
  старше известной не кладётся: ни прежний ответ поверх события, ни отставшее событие поверх ответа;
- пока пакеты в пути, события копятся в журнале. Ответ, снятый раньше события, применяет его к своим запросам заново: в
  `find` входит запись, которую событие принесло раньше, чем её ждал запрос, и выходит та, что за это время перестала
  подходить или удалена; счётчики и представления пакета, чьи коллекции событие тронуло, перезапрашиваются;
- состав `find` и коллекция целиком помнят ревизию ответа: отставшее событие, которое ответ уже учёл, их не меняет;
- ответ другой эпохи значит, что сервер перезапущен: клиент забывает всё. Первое событие потока другой эпохи, чем у уже
  принятого ответа, — тоже.

## Пакеты

Репозиторий делится на группы: `core/*` — пакеты ядра, `drivers/*` — драйверы баз данных, `tools/*` — инструменты
разработки. Рядом с ними — `sandbox`, песочница версий библиотеки.

| Папка            | Пакет                  | Что в нём                                                                                           | Кто берёт                    |
| ---------------- | ---------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------- |
| `core/scheme`    | `@oxeo/scheme`         | декораторы, `DataScheme`, `schemaOf`, контракт доменов, представлений и коллекций, фильтр, протокол | `core`; клиент — только типы |
| `core/server`    | `@oxeo/server`         | `DataSource`, `DataProcessor`, `DomainRuntime`, договор драйвера                                    | сервер                       |
| `core/client`    | `@oxeo/client`         | живая часть базы, чтения, пакеты запросов, события, вызовы операций                                 | клиент                       |
| `core/react`     | `@oxeo/react`          | `createUseDb`                                                                                       | клиент на React              |
| `core/types`     | `@oxeo/types`          | типы HTTP-маршрутов и файлов                                                                        | приложения                   |
| `drivers/mongo`  | `@oxeo-drivers/mongo`  | драйвер MongoDB, модуль NestJS                                                                      | сервер                       |
| `drivers/memory` | `@oxeo-drivers/memory` | драйвер в памяти процесса                                                                           | тесты доменов, песочницы     |
| `tools/devkit`   | `@oxeo/devkit`         | макетная схема и кейсы целостности; не публикуется                                                  | тесты пакетов                |
| `tools/visual`   | `@oxeo/visual`         | интерактивная карта схемы                                                                           | проект, для разработки       |
| `sandbox`        | `@oxeo/sandbox`        | песочница версий библиотеки; не публикуется, устройство — `sandbox/README.md`                       | разработка oxeo              |

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

Единственное общее для сервера и клиента в рантайме — сверка записи с фильтром `matches` и порядок окна `windowOf`: тот
же код работает в драйвере памяти и на клиенте. Поэтому у `@oxeo/scheme` два входа: главный и `@oxeo/scheme/filter` без декораторов и zod. Сборка
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

Публикация — `.github/workflows/publish.yml`: push в `master` публикует пакет, у которого в этом пуше изменился
`package.json`; нужен секрет `NPM_TOKEN`. Номер версии поднимается вручную: без новой версии публикация такого пакета
упадёт, потому что эта версия уже есть в npm.
