import { useNavigate, useParams } from 'react-router'
import { AppPage, RecordFields, RecordsTable } from '../../../../app/kit'
import type { DictionaryEntities } from '../../core/scheme'
import { db, live } from '../data'
import { paths } from './paths'

/**
 * Запись сотрудника: поля, значения справочников (регионы и гражданство), клиенты, где он менеджер, и участие в сменах.
 * Сотрудник, клиенты и участия собираются одним пакетом; значения справочников и смены участий приходят в нём же —
 * захватом по ссылкам.
 */
export const WorkerPage = live(() => {
  const params = useParams()
  const navigate = useNavigate()

  const workerId = Number(params.workerId)

  const worker = db.worker.get(workerId)
  const clients = db.client.find({ managerId: workerId })
  const participants = db.participant.find({ workerId })

  if (!worker) {
    return <AppPage.Empty>Сотрудника {params.workerId} нет</AppPage.Empty>
  }

  const linked = [...worker.regionIds, worker.citizenshipId]
  const optionIds = linked.filter((value): value is string => value !== null)
  const found = optionIds.map((value) => db.option.get(value))
  const options = found.filter((option): option is DictionaryEntities.Option => option !== null)

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
})
