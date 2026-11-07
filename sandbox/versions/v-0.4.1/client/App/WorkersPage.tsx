import { useNavigate } from 'react-router'
import { AppPage, RecordsTable } from '../../../../app/kit'
import { db, live } from '../data'
import { paths } from './paths'

/** Все сотрудники, свежие сверху; строка ведёт в запись. */
export const WorkersPage = live(() => {
  const navigate = useNavigate()

  const workers = db.worker.all()

  return (
    <AppPage title="Сотрудники" aside={workers.length}>
      <RecordsTable
        rows={[...workers].sort((a, b) => b.createdAt - a.createdAt)}
        onRowClick={(worker) => navigate(paths.worker(worker.workerId))}
      />
    </AppPage>
  )
})
