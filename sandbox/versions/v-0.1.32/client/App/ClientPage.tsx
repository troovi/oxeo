import { useNavigate, useParams } from 'react-router'
import { AppPage, RecordFields, RecordsTable } from '../../../../app/kit'
import { useEntity, useFindBy } from '../data'
import { paths } from './paths'

/** Запись клиента: поля (менеджер — ссылкой) и проекты клиента. */
export const ClientPage = () => {
  const params = useParams()
  const navigate = useNavigate()

  const clientId = Number(params.clientId)

  const client = useEntity('client', clientId)
  const projects = useFindBy('project', { clientId })

  if (!client) {
    return <AppPage.Empty>Клиента {params.clientId} нет в локальной базе</AppPage.Empty>
  }

  return (
    <AppPage
      title={`#${client.clientId} ${client.name}`}
      back={{ to: paths.clients, title: 'Клиенты' }}
    >
      <RecordFields record={client} links={{ managerId: paths.worker(client.managerId) }} />
      <AppPage.Section title={`Проекты · ${projects.length}`}>
        <RecordsTable
          rows={[...projects].reverse()}
          onRowClick={(project) => navigate(paths.project(project.projectId))}
        />
      </AppPage.Section>
    </AppPage>
  )
}
