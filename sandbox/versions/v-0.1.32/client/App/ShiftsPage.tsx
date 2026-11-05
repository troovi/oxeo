import { useNavigate } from 'react-router'
import { AppPage, RecordsTable } from '../../../../app/kit'
import { AppKey, AppKeys } from '../../core/keys'
import { useFindBy } from '../data'
import { paths } from './paths'

/** Подписи сегментов стадий. */
const STAGE_TITLES: Record<AppKey.ShiftStage, string> = {
  created: 'Новые',
  recruiting: 'В наборе',
  completed: 'Завершённые',
  canceled: 'Отменённые'
}

/**
 * Смены локальной базы, свежие сверху: все или одной стадии — сегменты-маршруты страницы; строка ведёт в запись.
 * Сегмент стадии — отбор по полю, которое у записи меняется: смена входит в сегмент и выходит из него операцией
 * домена — запуском набора, завершением, отменой.
 */
export const ShiftsPage = ({ stage }: { stage?: AppKey.ShiftStage }) => {
  const navigate = useNavigate()

  const shifts = useFindBy('shift', stage ? { stage } : {})

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
        rows={[...shifts].reverse()}
        onRowClick={(shift) => navigate(paths.shift(shift.shiftId))}
      />
    </AppPage>
  )
}
