// @ts-nocheck
/* eslint-disable */

// Как версия песочницы пользовалась бы xeo 1.0: сборка клиента, поток событий, страницы App, формы и обработчики.
// Те же страницы, что у `v-0.1.32`, — чтобы видеть, что меняется в коде приложения

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { AppPage, RecordFields, RecordsTable, SectionTiles, network } from '../../../app/kit'
import { createClient, createObserver, createUseData } from '../lib'
import type { AppDomains } from '../core/domains'
import type { AppScheme } from '../core/scheme'
import { StreamMessage } from './protocol'

// ------------------------------------------------ data.ts -----------------------------------------------

export const BASE_URL = '/api/v-1.0'

/** Запрос к серверу версии через `network` kit — его видит Networks; отказ — ошибка с текстом сервера. */
const post = async (url: string, body: unknown) => {
  const response = await network.fetch(`${BASE_URL}/${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload.message ?? response.statusText)
  }

  return payload
}

/**
 * Клиент версии. Схема и домены — только типами: ни декораторов, ни классов доменов в сборке клиента нет. Плашка
 * пересинхронизации из 0.1 больше не нужна: клиент забывает всё и перезапрашивает сам.
 */
export const client = createClient<AppScheme, AppDomains>({
  transport: {
    query: (batch) => post('data/query', batch),
    call: ({ domain, method, params }) => post(`domains/${domain}/${method}`, params)
  }
})

export const { data, DomainsAPI } = client

export const observer = createObserver(client, {
  fallback: <AppPage.Loading />,
  error: ({ retry }) => <AppPage.Failed onRetry={retry} />
})

export const useData = createUseData(client)

/** Поток событий; снимка нет — первый пакет запросов страницы и есть старт. */
export const connect = () => {
  const stream = network.stream(`${BASE_URL}/events`, ['event', 'resync'])

  stream.addEventListener('event', (message) => {
    client.push(JSON.parse(message.data))
  })

  stream.addEventListener('resync', (message) => {
    client.resync(`сервер: ${JSON.parse(message.data)}`)
  })

  stream.onerror = () => {
    client.resync('поток событий прервался')
  }
}

// ------------------------------------------------- pages ------------------------------------------------

/**
 * Главная: числа разделов без загрузки записей — `count` считает сервер. В 0.1 здесь было пять `useAll`, то есть
 * почти вся база ради пяти чисел.
 */
export const HomePage = observer(() => {
  return (
    <AppPage title="Главная">
      <SectionTiles
        tiles={[
          { to: paths.workers, title: 'Сотрудники', count: data.worker.count() },
          { to: paths.clients, title: 'Клиенты', count: data.client.count() },
          { to: paths.projects, title: 'Проекты', count: data.project.count() },
          { to: paths.shifts, title: 'Смены', count: data.shift.count() },
          { to: paths.dictionaries, title: 'Справочники', count: data.dictionary.count() }
        ]}
      />
    </AppPage>
  )
})

/**
 * Запись сотрудника — одно обращение к серверу: в первом проходе собраны сотрудник, клиенты менеджера и участия; значения
 * справочника и смены участий приходят захватом по ссылкам. Код — как в 0.1, только прямые чтения вместо хуков.
 */
export const WorkerPage = observer(() => {
  const params = useParams()
  const navigate = useNavigate()

  const workerId = Number(params.workerId)

  const worker = data.worker.get(workerId)
  const clients = data.client.find({ managerId: workerId })
  const participants = data.participant.find({ workerId })

  if (!worker) {
    return <AppPage.Empty>Сотрудника {params.workerId} нет</AppPage.Empty>
  }

  // чтение после раннего выхода и в цикле — то, чего не умели хуки; значения уже пришли захватом
  const optionIds = [...worker.regionIds, worker.citizenshipId].filter(Boolean)
  const options = optionIds.map((id) => data.option.get(id))

  return (
    <AppPage
      title={`#${worker.workerId} ${worker.name}`}
      back={{ to: paths.workers, title: 'Сотрудники' }}
    >
      <RecordFields record={worker} />
      <AppPage.Section title={`Справочники · ${options.length}`}>
        <RecordsTable rows={options} />
      </AppPage.Section>
      <AppPage.Section title={`Клиенты менеджера · ${clients.length}`}>
        <RecordsTable rows={clients} onRowClick={(item) => navigate(paths.client(item.clientId))} />
      </AppPage.Section>
      <AppPage.Section title={`Участие в сменах · ${participants.length}`}>
        <RecordsTable rows={participants} onRowClick={(item) => navigate(paths.shift(item.shiftId))} />
      </AppPage.Section>
    </AppPage>
  )
})

/**
 * Смены месяца — диапазон по изменяемому полю: перенос смены на другую дату приходит событием с целой записью, и
 * клиент сам решает, вошла она в месяц или вышла. Сотрудников, клиентов, проекты разумно читать целиком, смены —
 * так, частью.
 */
export const ShiftsPage = observer(
  () => {
    const navigate = useNavigate()

    const [month, setMonth] = useState('2026-11')

    const shifts = data.shift.find({ date: { gte: `${month}-01`, lt: nextMonth(month) } })

    return (
      <AppPage title="Смены" aside={shifts.length}>
        <MonthSwitch value={month} onChange={setMonth} />
        <RecordsTable rows={shifts} onRowClick={(shift) => navigate(paths.shift(shift.shiftId))} />
      </AppPage>
    )
  },
  { fallback: <AppPage.Loading title="Смены" /> }
)

// ------------------------------------------------- forms ------------------------------------------------

/**
 * Своя версия формы — запись, прочитанная при открытии: объект версии неизменяем, копия не нужна. Компонент формы —
 * в обёртке, поэтому сотрудник догружается, если окно открыли сразу по ссылке.
 */
export const RenameWorkerForm = observer(({ workerId }: { workerId: number }) => {
  const [worker] = useState(() => data.worker.get(workerId))

  const { manager, handleSubmit } = useForm(scheme, {
    defaultValues: { name: worker.name },
    onSubmit: (values) => DomainsAPI.workers.rename({ workerId, name: values.name })
  })
  // …
})

/**
 * Варианты селекта сотрудников. `useOptions` зовёт поле formkit — компонент не в `observer`, поэтому чтение идёт через
 * мост: поле подписано на сотрудников и само показывает загрузку по `isLoading`, как ждёт договор formkit.
 */
const useWorkerOptions = () => {
  const { value: workers, isLoading } = useData(() => data.worker.all())
  const options = workers.map((worker) => ({ value: worker.workerId, title: worker.name }))

  return { options, isLoading }
}

// ----------------------------------------------- handlers -----------------------------------------------

/**
 * Перед удалением значения справочника — сколько сотрудников его потеряют. Страница справочника сотрудников не
 * читала: синхронное `data.worker.find(…)` здесь бросило бы ошибку, поэтому — явная загрузка. Равенство со скаляром
 * по полю-массиву — как в Mongo: сотрудники, у которых значение есть среди регионов.
 */
export const useRemoveOption = () => {
  return async (value: string) => {
    const workers = await data.worker.load({ regionIds: value })
    const isConfirmed = await alerts.confirm(
      `Значение снимется у ${workers.length} сотрудников. Удалить?`
    )

    if (isConfirmed) {
      await DomainsAPI.dictionary.removeOption({ value })
    }
  }
}
