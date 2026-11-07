import { useNavigate } from 'react-router'
import { AppPage, RecordsTable } from '../../../../app/kit'
import { useDb } from '../data'
import { LoadState } from './LoadState'
import { paths } from './paths'

/** Все сотрудники, свежие сверху; строка ведёт в запись. */
export const WorkersPage = () => {
  const navigate = useNavigate()

  const state = useDb((db) => db.worker.all())

  return (
    <AppPage title="Сотрудники" aside={state.data?.length}>
      {state.stage === 'success' ? (
        <RecordsTable
          rows={[...state.data].sort((a, b) => b.createdAt - a.createdAt)}
          onRowClick={(worker) => navigate(paths.worker(worker.workerId))}
        />
      ) : (
        <LoadState state={state} />
      )}
    </AppPage>
  )
}
