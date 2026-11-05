import { useNavigate, useParams } from 'react-router'
import { AppPage, RecordFields, RecordsTable } from '../../../../app/kit'
import { data, observer } from '../data'
import { paths } from './paths'

/** Запись проекта: поля (клиент — ссылкой) и смены проекта. */
export const ProjectPage = observer(() => {
  const params = useParams()
  const navigate = useNavigate()

  const projectId = Number(params.projectId)

  const project = data.project.get(projectId)
  const shifts = data.shift.find({ projectId })

  if (!project) {
    return <AppPage.Empty>Проекта {params.projectId} нет</AppPage.Empty>
  }

  return (
    <AppPage
      title={`#${project.projectId} ${project.name}`}
      back={{ to: paths.projects, title: 'Проекты' }}
    >
      <RecordFields record={project} links={{ clientId: paths.client(project.clientId) }} />
      <AppPage.Section title={`Смены · ${shifts.length}`}>
        <RecordsTable
          rows={[...shifts].sort((a, b) => b.createdAt - a.createdAt)}
          onRowClick={(shift) => navigate(paths.shift(shift.shiftId))}
        />
      </AppPage.Section>
    </AppPage>
  )
})
