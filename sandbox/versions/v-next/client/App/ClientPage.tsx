import { useNavigate, useParams } from 'react-router'
import { AppPage, RecordFields, RecordsTable } from '../../../../app/kit'
import { useDb } from '../data'
import { LoadState } from './LoadState'
import { paths } from './paths'

/** Вход маршрута: другой клиент — новый экземпляр записи, иначе до ответа был бы виден прежний. */
export const ClientPage = () => {
  const { clientId } = useParams()

  return <ClientRecord key={clientId} clientId={Number(clientId)} />
}

/** Запись клиента: поля (менеджер — ссылкой) и проекты клиента. */
const ClientRecord = ({ clientId }: { clientId: number }) => {
  const navigate = useNavigate()

  const state = useDb((db) => {
    return { client: db.client.get(clientId), projects: db.project.find({ clientId }) }
  })

  if (state.stage !== 'success') {
    return <LoadState state={state} />
  }

  const { client, projects } = state.data

  if (!client) {
    return <AppPage.Empty>Клиента {clientId} нет</AppPage.Empty>
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
}
