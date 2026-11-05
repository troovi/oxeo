import { AppPage, SectionTiles } from '../../../../app/kit'
import { useAll } from '../data'
import { paths } from './paths'

/** Главная приложения: разделы с числом записей в локальной базе. */
export const HomePage = () => {
  const workers = useAll('worker')
  const clients = useAll('client')
  const projects = useAll('project')
  const shifts = useAll('shift')
  const dictionaries = useAll('dictionary')

  return (
    <AppPage title="Главная">
      <SectionTiles
        tiles={[
          { to: paths.workers, title: 'Сотрудники', count: workers.length },
          { to: paths.clients, title: 'Клиенты', count: clients.length },
          { to: paths.projects, title: 'Проекты', count: projects.length },
          { to: paths.shifts, title: 'Смены', count: shifts.length },
          { to: paths.dictionaries, title: 'Справочники', count: dictionaries.length }
        ]}
      />
    </AppPage>
  )
}
