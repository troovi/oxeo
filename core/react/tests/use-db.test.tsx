// @vitest-environment jsdom
import { Component, act, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import type { Query, QueryBatch } from '@oxeo/scheme'
import { createClient } from '../../client/lib'
import { createUseDb } from '../lib'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

interface Row {
  id: number
  [field: string]: unknown
}

/** База в памяти и клиент над ней; `log` — состав пакетов, `refused` — коллекции, запросам к которым сервер отказывает. */
const setup = () => {
  const tables = new Map<string, Map<number, Row>>()
  const log: string[][] = []
  const state = { isDown: false, revision: 0, delay: 1 }
  const refused = new Set<string>()
  const errors: Error[] = []

  const tableOf = (collection: string) => {
    if (!tables.has(collection)) {
      tables.set(collection, new Map())
    }

    return tables.get(collection)!
  }

  const answer = (query: Query, records: object[]) => {
    if (query.kind === 'view') {
      return { value: { count: tableOf(query.view).size }, reads: [query.view] }
    }

    if (refused.has(query.collection)) {
      return { error: { code: 'forbidden', message: 'нельзя' } }
    }

    const rows = [...tableOf(query.collection).values()]
    const where = query.kind === 'get' ? {} : (query.where ?? {})
    const isMatched = (row: Row) => Object.entries(where).every(([key, value]) => row[key] === value)
    const found =
      query.kind === 'get' ? rows.filter((row) => query.ids.includes(row.id)) : rows.filter(isMatched)

    if (query.kind === 'count') {
      return { count: found.length }
    }

    found.forEach((record) => records.push({ collection: query.collection, id: record.id, record }))

    return { ids: found.map((record) => record.id) }
  }

  const client = createClient<any, any, any>({
    transport: {
      query: async (batch: QueryBatch) => {
        await new Promise((resolve) => setTimeout(resolve, state.delay))
        log.push(
          batch.queries.map(
            (query) => `${query.kind}:${'collection' in query ? query.collection : query.view}`
          )
        )

        if (state.isDown) {
          throw new Error('нет связи')
        }

        const records: object[] = []
        const results = batch.queries.map((query) => answer(query, records))

        return { records, results } as never
      },
      call: async () => {
        throw new Error('вызовов в этих тестах нет')
      }
    },
    retries: [],
    refreshDelay: 1,
    onReadError: (error) => errors.push(error)
  })

  /** Операция на сервере: новая версия записи в таблицу и событие клиенту. */
  const emit = (collection: string, record: Row) => {
    tableOf(collection).set(record.id, record)
    state.revision += 1

    client.push({
      epoch: 'e1',
      revision: state.revision,
      changes: [{ collection, id: record.id, record }],
      result: null
    } as never)
  }

  client.push({ epoch: 'e1', revision: 0, changes: [], result: null } as never)

  return { client, useDb: createUseDb(client), tableOf, emit, log, state, refused, errors }
}

/** Ожидание короткими шагами: `act` сбрасывает работу React только на выходе, а зависимые чтения идут волнами. */
const settle = async (ms = 40) => {
  for (let passed = 0; passed < ms; passed += 5) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
  }
}

const mount = async (element: React.ReactNode) => {
  const container = document.createElement('div')
  const root = createRoot(container)

  document.body.appendChild(container)

  await act(async () => {
    root.render(element)
  })

  return { container, unmount: () => act(async () => root.unmount()) }
}

describe('useDb', () => {
  it('первая загрузка: loading, затем success; два хука — один пакет', async () => {
    const { useDb, tableOf, log } = setup()
    const stages: string[] = []

    tableOf('task').set(1, { id: 1, title: 'первое' })
    tableOf('person').set(10, { id: 10, name: 'Анна' })

    const Screen = () => {
      const tasks = useDb((db) => db.task.all())
      const person = useDb((db) => db.person.get(10))

      stages.push(tasks.stage)

      return <b>{`${tasks.data?.length ?? '-'} ${person.data?.name ?? '-'}`}</b>
    }

    const { container } = await mount(<Screen />)

    await settle()

    expect(stages[0]).toBe('loading')
    expect(stages.at(-1)).toBe('success')
    expect(container.textContent).toBe('1 Анна')
    expect(log).toHaveLength(1)
  })

  it('покрытое чтение — success в первом же рендере', async () => {
    const { client, useDb, tableOf } = setup()
    const stages: string[] = []

    tableOf('task').set(1, { id: 1, title: 'первое' })
    await client.read((db) => db.task.all())

    const Screen = () => {
      const { stage } = useDb((db) => db.task.all())

      stages.push(stage)

      return null
    }

    await mount(<Screen />)

    expect(stages[0]).toBe('success')
  })

  it('смена фильтра держит прежние данные с isUpdating, контрол остаётся на экране', async () => {
    const { useDb, tableOf } = setup()
    const seen: string[] = []
    const control: { set: (status: string) => void } = { set: () => {} }

    tableOf('task').set(1, { id: 1, status: 'open' })
    tableOf('task').set(2, { id: 2, status: 'done' })

    const Screen = () => {
      const [status, setStatus] = useState('open')
      const state = useDb((db) => db.task.find({ status }))

      control.set = setStatus
      seen.push(
        `${status}:${state.data?.map((task: Row) => task.status).join() ?? '-'}:${state.stage === 'success' && state.isUpdating}`
      )

      return <b>{status}</b>
    }

    const { container } = await mount(<Screen />)

    await settle()
    await act(async () => control.set('done'))
    await settle()

    expect(seen).toContain('done:open:true')
    expect(seen.at(-1)).toBe('done:done:false')
    expect(container.textContent).toBe('done')
  })

  it('чужое событие со ссылкой на незагруженную запись не прячет список', async () => {
    const { useDb, tableOf, emit, state } = setup()

    tableOf('person').set(10, { id: 10, name: 'Анна' })
    tableOf('person').set(11, { id: 11, name: 'Борис' })
    tableOf('task').set(1, { id: 1, status: 'open', personId: 10 })

    const Screen = () => {
      const { data } = useDb((db) => {
        return db.task
          .find({ status: 'open' })
          .map((task: Row) => db.person.get(task.personId as number)?.name)
      })

      return (
        <ul>
          {data?.map((name: string) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )
    }

    const { container } = await mount(<Screen />)

    await settle()
    expect(container.textContent).toBe('Анна')

    state.delay = 30

    await act(async () => {
      emit('task', { id: 2, status: 'open', personId: 11 })
    })

    expect(container.textContent).toBe('Анна')

    await settle(120)

    expect(container.textContent).toBe('АннаБорис')
  })

  it('учёт полей: правка прочитанного поля перерисовывает, чужого — нет', async () => {
    const { useDb, tableOf, emit } = setup()
    const renders = { count: 0 }

    tableOf('task').set(1, { id: 1, title: 'первое', note: 'x' })

    const Screen = () => {
      const { data: task } = useDb((db) => db.task.get(1))

      renders.count += 1

      return <b>{task?.title}</b>
    }

    const { container } = await mount(<Screen />)

    await settle()

    const before = renders.count

    await act(async () => {
      emit('task', { id: 1, title: 'первое', note: 'y' })
    })
    await settle()

    expect(renders.count).toBe(before)

    await act(async () => {
      emit('task', { id: 1, title: 'второе', note: 'y' })
    })
    await settle()

    expect(container.textContent).toBe('второе')
  })

  it('отказ пакета: стадия error, отчёт клиенту, retry запрашивает заново', async () => {
    const { useDb, tableOf, state, errors } = setup()

    tableOf('task').set(1, { id: 1, title: 'первое' })
    state.isDown = true

    const Screen = () => {
      const result = useDb((db) => db.task.all())

      return result.stage === 'error' ? (
        <button onClick={result.retry}>повторить</button>
      ) : (
        <b>{`${result.stage}:${result.data?.length ?? '-'}`}</b>
      )
    }

    const { container } = await mount(<Screen />)

    await settle()

    expect(container.textContent).toBe('повторить')
    expect(errors).toHaveLength(1)

    state.isDown = false

    await act(async () => {
      container.querySelector('button')?.click()
    })
    await settle()

    expect(container.textContent).toBe('success:1')
  })

  it('отказ запроса get сервером доходит до хука', async () => {
    const { useDb, tableOf, refused } = setup()

    tableOf('task').set(1, { id: 1 })
    refused.add('task')

    const Screen = () => {
      const { stage } = useDb((db) => db.task.get(1))

      return <b>{stage}</b>
    }

    const { container } = await mount(<Screen />)

    await settle()

    expect(container.textContent).toBe('error')
  })

  it('отказ при прежних данных: стадия error, данные остаются', async () => {
    const { useDb, tableOf, state } = setup()
    const control: { set: (status: string) => void } = { set: () => {} }

    tableOf('task').set(1, { id: 1, status: 'open' })

    const Screen = () => {
      const [status, setStatus] = useState('open')
      const { stage, data } = useDb((db) => db.task.find({ status }))

      control.set = setStatus

      return <b>{`${stage}:${data?.length ?? '-'}`}</b>
    }

    const { container } = await mount(<Screen />)

    await settle()

    state.isDown = true

    await act(async () => control.set('done'))
    await settle()

    expect(container.textContent).toBe('error:1')
  })

  it('новый монтаж запрашивает упавшее заново', async () => {
    const { useDb, tableOf, state, log } = setup()

    tableOf('task').set(1, { id: 1 })
    state.isDown = true

    const Screen = () => {
      const { stage } = useDb((db) => db.task.all())

      return <b>{stage}</b>
    }

    const first = await mount(<Screen />)

    await settle()

    expect(first.container.textContent).toBe('error')

    await first.unmount()

    state.isDown = false

    const second = await mount(<Screen />)

    await settle()

    expect(second.container.textContent).toBe('success')
    expect(log).toHaveLength(2)
  })

  it('пересинхронизация: экран держит прежнее, затем показывает новое', async () => {
    const { client, useDb, tableOf, state } = setup()

    tableOf('task').set(1, { id: 1, title: 'старое' })

    const Screen = () => {
      const { data: task } = useDb((db) => db.task.get(1))

      return <b>{task?.title}</b>
    }

    const { container } = await mount(<Screen />)

    await settle()

    tableOf('task').set(1, { id: 1, title: 'новое' })
    state.delay = 30

    await act(async () => {
      client.resync('тест')
    })

    expect(container.textContent).toBe('старое')

    await settle(80)

    expect(container.textContent).toBe('новое')
  })

  it('значения представлений — второй параметр колбэка', async () => {
    const { useDb, tableOf } = setup()

    tableOf('stats').set(1, { id: 1 })

    const Screen = () => {
      const { data } = useDb((_, views) => views.stats.total({}))

      return <b>{data?.count ?? '-'}</b>
    }

    const { container } = await mount(<Screen />)

    await settle()

    expect(container.textContent).toBe('1')
  })

  it('ошибка полного прохода идёт в границу ошибок, ошибка на пустых данных — нет', async () => {
    const { useDb, tableOf } = setup()

    tableOf('task').set(1, { id: 1, title: 'первое' })

    class Boundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
      state = { failed: false }

      static getDerivedStateFromError() {
        return { failed: true }
      }

      render() {
        return this.state.failed ? <i>упало</i> : this.props.children
      }
    }

    const Empty = () => {
      // на пустом проходе `get` отдаёт null: разбор поля падает, но проход всё равно выбрасывается
      const { data } = useDb((db) => db.task.get(1).title)

      return <b>{data}</b>
    }

    const Broken = () => {
      useDb(() => {
        throw new Error('настоящая')
      })

      return <b>цело</b>
    }

    const empty = await mount(
      <Boundary>
        <Empty />
      </Boundary>
    )

    await settle()

    expect(empty.container.textContent).toBe('первое')

    const silent = console.error

    console.error = () => {}

    const broken = await mount(
      <Boundary>
        <Broken />
      </Boundary>
    )

    console.error = silent

    expect(broken.container.textContent).toBe('упало')
  })
})

describe('useDb once', () => {
  /** Тело формы: поля читаются один раз при создании, как `createFormManager`. */
  const createForm = (renders: { count: number }) => {
    return ({ task }: { task: Row }) => {
      const manager = useRef<{ title: unknown } | null>(null)

      renders.count += 1

      if (manager.current === null) {
        manager.current = { title: task.title }
      }

      return <b>{String(manager.current.title)}</b>
    }
  }

  it('простые записи на момент открытия: ни одной перерисовки на чужие правки', async () => {
    const { useDb, tableOf, emit } = setup()
    const renders = { count: 0 }
    const seen: { task: Row | null } = { task: null }
    const Form = createForm(renders)

    tableOf('task').set(1, { id: 1, title: 'первое', note: 'x' })

    const Dialog = () => {
      const { data: task } = useDb((db) => db.task.get(1), { once: true })

      seen.task = task ?? null

      return task ? <Form task={task} /> : null
    }

    const { container } = await mount(<Dialog />)

    await settle()

    const before = renders.count

    for (const patch of [{ title: 'правка 1' }, { note: 'правка 2' }]) {
      await act(async () => {
        emit('task', { id: 1, title: 'первое', note: 'x', ...patch })
      })
      await settle()
    }

    expect(renders.count).toBe(before)
    expect(container.textContent).toBe('первое')
    // прокси structuredClone не копирует
    expect(structuredClone(seen.task)).toEqual({ id: 1, title: 'первое', note: 'x' })
  })

  it('живая запись, наоборот, держит подписку: форма не читает поля, поэтому важна вся запись', async () => {
    const { useDb, tableOf, emit } = setup()
    const renders = { count: 0 }
    const Form = createForm(renders)

    tableOf('task').set(1, { id: 1, title: 'первое', note: 'x' })

    const Dialog = () => {
      const { data: task } = useDb((db) => db.task.get(1))

      return task ? <Form task={task} /> : null
    }

    await mount(<Dialog />)
    await settle()

    const before = renders.count

    // первая правка — поле, которое форма прочитала; дальше набор полей пуст, и перерисовывает любая
    for (const patch of [{ title: 'правка' }, { note: 'y' }, { note: 'z' }]) {
      await act(async () => {
        emit('task', { id: 1, title: 'первое', note: 'x', ...patch })
      })
      await settle()
    }

    expect(renders.count - before).toBe(3)
  })

  it('удалённая запись форму не закрывает', async () => {
    const { client, useDb, tableOf } = setup()

    tableOf('task').set(1, { id: 1, title: 'первое' })

    const Dialog = () => {
      const { data: task } = useDb((db) => db.task.get(1), { once: true })

      return <b>{task?.title ?? 'нет'}</b>
    }

    const { container } = await mount(<Dialog />)

    await settle()

    await act(async () => {
      client.push({
        epoch: 'e1',
        revision: 1,
        changes: [{ collection: 'task', id: 1, record: null }],
        result: null
      } as never)
    })
    await settle()

    expect(container.textContent).toBe('первое')
  })

  it('до первого полного результата догружает зависимые чтения', async () => {
    const { useDb, tableOf } = setup()

    tableOf('task').set(1, { id: 1, personId: 10 })
    tableOf('person').set(10, { id: 10, name: 'Анна' })

    const Dialog = () => {
      const { stage, data } = useDb(
        (db) => {
          const task = db.task.get(1)

          return task && db.person.get(task.personId)
        },
        { once: true }
      )

      return <b>{`${stage}:${data?.name ?? '-'}`}</b>
    }

    const { container } = await mount(<Dialog />)

    await settle()

    expect(container.textContent).toBe('success:Анна')
  })
})
