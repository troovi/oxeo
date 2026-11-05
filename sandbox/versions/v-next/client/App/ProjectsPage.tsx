import { useNavigate } from 'react-router'
import { AppPage, RecordsTable } from '../../../../app/kit'
import { data, observer } from '../data'
import { paths } from './paths'

/** Все проекты, свежие сверху; строка ведёт в запись. */
export const ProjectsPage = observer(() => {
  const navigate = useNavigate()

  const projects = data.project.all()

  return (
    <AppPage title="Проекты" aside={projects.length}>
      <RecordsTable
        rows={[...projects].sort((a, b) => b.createdAt - a.createdAt)}
        onRowClick={(project) => navigate(paths.project(project.projectId))}
      />
    </AppPage>
  )
})
