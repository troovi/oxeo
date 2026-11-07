import { useNavigate, useParams } from 'react-router'
import { AppPage, RecordFields, RecordsTable } from '../../../../app/kit'
import { useDb } from '../data'
import { LoadState } from './LoadState'
import { paths } from './paths'

/** Вход маршрута: другой проект — новый экземпляр записи, иначе до ответа был бы виден прежний. */
export const ProjectPage = () => {
  const { projectId } = useParams()

  return <ProjectRecord key={projectId} projectId={Number(projectId)} />
}

/** Запись проекта: поля (клиент — ссылкой) и смены проекта. */
const ProjectRecord = ({ projectId }: { projectId: number }) => {
  const navigate = useNavigate()

  const state = useDb((db) => {
    return { project: db.project.get(projectId), shifts: db.shift.find({ projectId }) }
  })

  if (state.stage !== 'success') {
    return <LoadState state={state} />
  }

  const { project, shifts } = state.data

  if (!project) {
    return <AppPage.Empty>Проекта {projectId} нет</AppPage.Empty>
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
}
