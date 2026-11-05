import { AppPage, SectionTiles } from '../../../../app/kit'
import { data, observer } from '../data'
import { paths } from './paths'

/** Главная приложения: разделы с числом записей — счётчики считает сервер, записи не загружаются. */
export const HomePage = observer(() => {
  return (
    <AppPage title="Главная">
      <SectionTiles
        tiles={[
          { to: paths.workers, title: 'Сотрудники', count: data.worker.count() },
          { to: paths.clients, title: 'Клиенты', count: data.client.count() },
          { to: paths.projects, title: 'Проекты', count: data.project.count() },
          { to: paths.shifts, title: 'Смены', count: data.shift.count() },
          { to: paths.dictionaries, title: 'Справочники', count: data.dictionary.count() }
        ]}
      />
    </AppPage>
  )
})
