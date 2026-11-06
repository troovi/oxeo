import { AppPage, SectionTiles } from '../../../../app/kit'
import { db, live } from '../data'
import { paths } from './paths'

/** Главная приложения: разделы с числом записей — счётчики считает сервер, записи не загружаются. */
export const HomePage = live(() => {
  return (
    <AppPage title="Главная">
      <SectionTiles
        tiles={[
          { to: paths.workers, title: 'Сотрудники', count: db.worker.count() },
          { to: paths.clients, title: 'Клиенты', count: db.client.count() },
          { to: paths.projects, title: 'Проекты', count: db.project.count() },
          { to: paths.shifts, title: 'Смены', count: db.shift.count() },
          { to: paths.dictionaries, title: 'Справочники', count: db.dictionary.count() }
        ]}
      />
    </AppPage>
  )
})
