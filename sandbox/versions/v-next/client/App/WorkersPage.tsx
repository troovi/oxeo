import { useNavigate } from 'react-router'
import { AppPage, RecordsTable } from '../../../../app/kit'
import { data, observer } from '../data'
import { paths } from './paths'

/** Все сотрудники, свежие сверху; строка ведёт в запись. */
export const WorkersPage = observer(() => {
  const navigate = useNavigate()

  const workers = data.worker.all()

  return (
    <AppPage title="Сотрудники" aside={workers.length}>
      <RecordsTable
        rows={[...workers].sort((a, b) => b.createdAt - a.createdAt)}
        onRowClick={(worker) => navigate(paths.worker(worker.workerId))}
      />
    </AppPage>
  )
})
