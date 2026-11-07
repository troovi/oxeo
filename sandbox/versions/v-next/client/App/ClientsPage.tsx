import { useNavigate } from 'react-router'
import { AppPage, RecordsTable } from '../../../../app/kit'
import { useDb } from '../data'
import { LoadState } from './LoadState'
import { paths } from './paths'

/** Все клиенты, свежие сверху; строка ведёт в запись. */
export const ClientsPage = () => {
  const navigate = useNavigate()

  const state = useDb((db) => db.client.all())

  return (
    <AppPage title="Клиенты" aside={state.data?.length}>
      {state.stage === 'success' ? (
        <RecordsTable
          rows={[...state.data].sort((a, b) => b.createdAt - a.createdAt)}
          onRowClick={(client) => navigate(paths.client(client.clientId))}
        />
      ) : (
        <LoadState state={state} />
      )}
    </AppPage>
  )
}
