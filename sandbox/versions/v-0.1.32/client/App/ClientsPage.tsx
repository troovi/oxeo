import { useNavigate } from 'react-router'
import { AppPage, RecordsTable } from '../../../../app/kit'
import { useAll } from '../data'
import { paths } from './paths'

/** Все клиенты локальной базы, свежие сверху; строка ведёт в запись. */
export const ClientsPage = () => {
  const navigate = useNavigate()

  const clients = useAll('client')

  return (
    <AppPage title="Клиенты" aside={clients.length}>
      <RecordsTable
        rows={[...clients].reverse()}
        onRowClick={(client) => navigate(paths.client(client.clientId))}
      />
    </AppPage>
  )
}
