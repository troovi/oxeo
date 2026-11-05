import { useNavigate } from 'react-router'
import { AppPage, RecordsTable } from '../../../../app/kit'
import { AppKey, AppKeys } from '../../core/keys'
import { data, observer } from '../data'
import { paths } from './paths'

/** Подписи сегментов стадий. */
const STAGE_TITLES: Record<AppKey.ShiftStage, string> = {
  created: 'Новые',
  recruiting: 'В наборе',
  completed: 'Завершённые',
  canceled: 'Отменённые'
}

/**
 * Смены, свежие сверху: все или одной стадии — сегменты-маршруты страницы; строка ведёт в запись. Сегмент стадии —
 * живой запрос по полю, которое у записи меняется: событие несёт смену целиком, и клиент сам решает, вошла она в
 * сегмент или вышла, — даже если до операции смены у него не было.
 */
export const ShiftsPage = observer(({ stage }: { stage?: AppKey.ShiftStage }) => {
  const navigate = useNavigate()

  const shifts = stage ? data.shift.find({ stage }) : data.shift.all()

  return (
    <AppPage title="Смены" aside={shifts.length}>
      <AppPage.Segments
        segments={[
          { to: paths.shifts, title: 'Все' },
          ...AppKeys.ShiftStage.map((item) => ({
            to: paths.shiftsByStage(item),
            title: STAGE_TITLES[item]
          }))
        ]}
      />
      <RecordsTable
        rows={[...shifts].sort((a, b) => b.createdAt - a.createdAt)}
        onRowClick={(shift) => navigate(paths.shift(shift.shiftId))}
      />
    </AppPage>
  )
})
