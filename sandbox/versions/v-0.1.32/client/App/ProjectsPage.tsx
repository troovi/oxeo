import { useNavigate } from 'react-router'
import { AppPage, RecordsTable } from '../../../../app/kit'
import { useAll } from '../data'
import { paths } from './paths'

/** Все проекты локальной базы, свежие сверху; строка ведёт в запись. */
export const ProjectsPage = () => {
  const navigate = useNavigate()

  const projects = useAll('project')

  return (
    <AppPage title="Проекты" aside={projects.length}>
      <RecordsTable
        rows={[...projects].reverse()}
        onRowClick={(project) => navigate(paths.project(project.projectId))}
      />
    </AppPage>
  )
}
