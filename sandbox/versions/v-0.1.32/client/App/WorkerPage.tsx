import { useNavigate, useParams } from 'react-router'
import { AppPage, RecordFields, RecordsTable } from '../../../../app/kit'
import { useEntities, useEntity, useFindBy } from '../data'
import { paths } from './paths'

/**
 * Запись сотрудника: поля, значения справочников (регионы и гражданство), клиенты, где он менеджер, и участие
 * в сменах.
 */
export const WorkerPage = () => {
  const params = useParams()
  const navigate = useNavigate()

  const workerId = Number(params.workerId)

  const worker = useEntity('worker', workerId)
  const clients = useFindBy('client', { managerId: workerId })
  const participants = useFindBy('participant', { workerId })

  const linked = worker ? [...worker.regionIds, worker.citizenshipId] : []
  const optionIds = linked.filter((value): value is string => value !== null)
  const options = useEntities('option', optionIds)

  if (!worker) {
    return <AppPage.Empty>Сотрудника {params.workerId} нет в локальной базе</AppPage.Empty>
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
          rows={[...participants].reverse()}
          onRowClick={(participant) => navigate(paths.shift(participant.shiftId))}
        />
      </AppPage.Section>
    </AppPage>
  )
}
