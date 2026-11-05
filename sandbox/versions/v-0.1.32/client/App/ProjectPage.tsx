import { useNavigate, useParams } from 'react-router'
import { AppPage, RecordFields, RecordsTable } from '../../../../app/kit'
import { useEntity, useFindBy } from '../data'
import { paths } from './paths'

/** Запись проекта: поля (клиент — ссылкой) и смены проекта. */
export const ProjectPage = () => {
  const params = useParams()
  const navigate = useNavigate()

  const projectId = Number(params.projectId)

  const project = useEntity('project', projectId)
  const shifts = useFindBy('shift', { projectId })

  if (!project) {
    return <AppPage.Empty>Проекта {params.projectId} нет в локальной базе</AppPage.Empty>
  }

  return (
    <AppPage
      title={`#${project.projectId} ${project.name}`}
      back={{ to: paths.projects, title: 'Проекты' }}
    >
      <RecordFields record={project} links={{ clientId: paths.client(project.clientId) }} />
      <AppPage.Section title={`Смены · ${shifts.length}`}>
        <RecordsTable
          rows={[...shifts].reverse()}
          onRowClick={(shift) => navigate(paths.shift(shift.shiftId))}
        />
      </AppPage.Section>
    </AppPage>
  )
}
