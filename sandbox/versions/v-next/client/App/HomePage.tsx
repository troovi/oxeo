import { useNavigate } from 'react-router'
import { AppPage, RecordsTable, SectionTiles } from '../../../../app/kit'
import { useDb } from '../data'
import { LoadState } from './LoadState'
import { paths } from './paths'

/**
 * Главная приложения: разделы с числом записей — счётчики считает сервер, записи не загружаются. Ниже — сводка смен по
 * стадиям (представление: значение считает сервер) и пять последних смен (окно `find` с порядком и пределом).
 */
export const HomePage = () => {
  const navigate = useNavigate()

  const state = useDb((db, views) => {
    return {
      stages: views.stats.shiftStages({ from: null }),
      latest: db.shift.find({}, { order: { field: 'createdAt', direction: 'desc' }, limit: 5 }),
      tiles: [
        { to: paths.workers, title: 'Сотрудники', count: db.worker.count() },
        { to: paths.clients, title: 'Клиенты', count: db.client.count() },
        { to: paths.projects, title: 'Проекты', count: db.project.count() },
        { to: paths.shifts, title: 'Смены', count: db.shift.count() },
        { to: paths.dictionaries, title: 'Справочники', count: db.dictionary.count() }
      ]
    }
  })

  if (state.stage !== 'success') {
    return <LoadState state={state} />
  }

  const { stages, latest, tiles } = state.data

  return (
    <AppPage title="Главная">
      <SectionTiles tiles={tiles} />
      <RecordsTable
        rows={Object.entries(stages).map(([stage, { shifts, plan }]) => ({ stage, shifts, plan }))}
      />
      <RecordsTable rows={latest} onRowClick={(shift) => navigate(paths.shift(shift.shiftId))} />
    </AppPage>
  )
}
