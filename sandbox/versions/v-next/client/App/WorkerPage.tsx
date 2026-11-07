import { useNavigate, useParams } from 'react-router'
import { AppPage, RecordFields, RecordsTable } from '../../../../app/kit'
import type { DictionaryEntities } from '../../core/scheme'
import { useDb } from '../data'
import { LoadState } from './LoadState'
import { paths } from './paths'

/** Вход маршрута: другой сотрудник — новый экземпляр записи, иначе до ответа был бы виден прежний. */
export const WorkerPage = () => {
  const { workerId } = useParams()

  return <WorkerRecord key={workerId} workerId={Number(workerId)} />
}

/**
 * Запись сотрудника: поля, значения справочников (регионы и гражданство), клиенты, где он менеджер, и участие в сменах.
 * Сотрудник, клиенты и участия собираются одним пакетом; значения справочников и смены участий приходят в нём же —
 * захватом по ссылкам.
 */
const WorkerRecord = ({ workerId }: { workerId: number }) => {
  const navigate = useNavigate()

  const state = useDb((db) => {
    const worker = db.worker.get(workerId)

    const linked = worker ? [...worker.regionIds, worker.citizenshipId] : []
    const optionIds = linked.filter((value): value is string => value !== null)
    const found = optionIds.map((value) => db.option.get(value))

    return {
      worker,
      clients: db.client.find({ managerId: workerId }),
      participants: db.participant.find({ workerId }),
      options: found.filter((option): option is DictionaryEntities.Option => option !== null)
    }
  })

  if (state.stage !== 'success') {
    return <LoadState state={state} />
  }

  const { worker, clients, participants, options } = state.data

  if (!worker) {
    return <AppPage.Empty>Сотрудника {workerId} нет</AppPage.Empty>
  }

  return (
    <AppPage
      title={`#${worker.workerId} ${worker.name}`}
      back={{ to: paths.workers, title: 'Сотрудники' }}
    >
      <RecordFields record={worker} />
      <AppPage.Section title={`Справочники · ${options.length}`}>
        <RecordsTable
          rows={options}
          onRowClick={(option) => navigate(paths.dictionary(option.dictionary))}
        />
      </AppPage.Section>
      <AppPage.Section title={`Клиенты менеджера · ${clients.length}`}>
        <RecordsTable rows={clients} onRowClick={(client) => navigate(paths.client(client.clientId))} />
      </AppPage.Section>
      <AppPage.Section title={`Участие в сменах · ${participants.length}`}>
        <RecordsTable
          rows={[...participants].sort((a, b) => b.addedAt - a.addedAt)}
          onRowClick={(participant) => navigate(paths.shift(participant.shiftId))}
        />
      </AppPage.Section>
    </AppPage>
  )
}
