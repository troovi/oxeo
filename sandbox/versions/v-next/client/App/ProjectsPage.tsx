import { useNavigate } from 'react-router'
import { AppPage, RecordsTable } from '../../../../app/kit'
import { useDb } from '../data'
import { LoadState } from './LoadState'
import { paths } from './paths'

/** Все проекты, свежие сверху; строка ведёт в запись. */
export const ProjectsPage = () => {
  const navigate = useNavigate()

  const state = useDb((db) => db.project.all())

  return (
    <AppPage title="Проекты" aside={state.data?.length}>
      {state.stage === 'success' ? (
        <RecordsTable
          rows={[...state.data].sort((a, b) => b.createdAt - a.createdAt)}
          onRowClick={(project) => navigate(paths.project(project.projectId))}
        />
      ) : (
        <LoadState state={state} />
      )}
    </AppPage>
  )
}
