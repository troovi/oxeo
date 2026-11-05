import { useNavigate } from 'react-router'
import { AppPage, RecordsTable } from '../../../../app/kit'
import { data, observer } from '../data'
import { paths } from './paths'

/** Все клиенты, свежие сверху; строка ведёт в запись. */
export const ClientsPage = observer(() => {
  const navigate = useNavigate()

  const clients = data.client.all()

  return (
    <AppPage title="Клиенты" aside={clients.length}>
      <RecordsTable
        rows={[...clients].sort((a, b) => b.createdAt - a.createdAt)}
        onRowClick={(client) => navigate(paths.client(client.clientId))}
      />
    </AppPage>
  )
})
