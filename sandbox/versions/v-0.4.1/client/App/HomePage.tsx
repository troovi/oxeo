import { useNavigate } from 'react-router'
import { AppPage, RecordsTable, SectionTiles } from '../../../../app/kit'
import { db, live, views } from '../data'
import { paths } from './paths'

/**
 * Главная приложения: разделы с числом записей — счётчики считает сервер, записи не загружаются. Ниже — сводка смен по
 * стадиям (представление: значение считает сервер) и пять последних смен (окно `find` с порядком и пределом).
 */
export const HomePage = live(() => {
  const navigate = useNavigate()
  const stages = views.stats.shiftStages({ from: null })
  const latest = db.shift.find({}, { order: { field: 'createdAt', direction: 'desc' }, limit: 5 })

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
      <RecordsTable
        rows={Object.entries(stages).map(([stage, { shifts, plan }]) => ({ stage, shifts, plan }))}
      />
      <RecordsTable rows={latest} onRowClick={(shift) => navigate(paths.shift(shift.shiftId))} />
    </AppPage>
  )
})
