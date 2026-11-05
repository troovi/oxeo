import { useNavigate } from 'react-router'
import { AppPage, RecordsTable } from '../../../../app/kit'
import { useAll } from '../data'
import { paths } from './paths'

/** Все сотрудники локальной базы, свежие сверху; строка ведёт в запись. */
export const WorkersPage = () => {
  const navigate = useNavigate()

  const workers = useAll('worker')

  return (
    <AppPage title="Сотрудники" aside={workers.length}>
      <RecordsTable
        rows={[...workers].reverse()}
        onRowClick={(worker) => navigate(paths.worker(worker.workerId))}
      />
    </AppPage>
  )
}
