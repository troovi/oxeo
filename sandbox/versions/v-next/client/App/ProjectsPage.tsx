import { useNavigate } from 'react-router'
import { AppPage, RecordsTable } from '../../../../app/kit'
import { db, live } from '../data'
import { paths } from './paths'

/** Все проекты, свежие сверху; строка ведёт в запись. */
export const ProjectsPage = live(() => {
  const navigate = useNavigate()

  const projects = db.project.all()

  return (
    <AppPage title="Проекты" aside={projects.length}>
      <RecordsTable
        rows={[...projects].sort((a, b) => b.createdAt - a.createdAt)}
        onRowClick={(project) => navigate(paths.project(project.projectId))}
      />
    </AppPage>
  )
})
