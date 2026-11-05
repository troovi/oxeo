import { useNavigate, useParams } from 'react-router'
import { AppPage, RecordFields, RecordsTable } from '../../../../app/kit'
import { data, observer } from '../data'
import { paths } from './paths'

/** Запись клиента: поля (менеджер — ссылкой) и проекты клиента. */
export const ClientPage = observer(() => {
  const params = useParams()
  const navigate = useNavigate()

  const clientId = Number(params.clientId)

  const client = data.client.get(clientId)
  const projects = data.project.find({ clientId })

  if (!client) {
    return <AppPage.Empty>Клиента {params.clientId} нет</AppPage.Empty>
  }

  return (
    <AppPage
      title={`#${client.clientId} ${client.name}`}
      back={{ to: paths.clients, title: 'Клиенты' }}
    >
      <RecordFields record={client} links={{ managerId: paths.worker(client.managerId) }} />
      <AppPage.Section title={`Проекты · ${projects.length}`}>
        <RecordsTable
          rows={[...projects].sort((a, b) => b.createdAt - a.createdAt)}
          onRowClick={(project) => navigate(paths.project(project.projectId))}
        />
      </AppPage.Section>
    </AppPage>
  )
})
