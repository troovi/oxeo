import { useNavigate } from 'react-router'
import { AppPage, RecordsTable } from '../../../../app/kit'
import { AppKey, AppKeys } from '../../core/keys'
import { useDb } from '../data'
import { LoadState } from './LoadState'
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
 * сегмент или вышла, — даже если до операции смены у него не было. Смена сегмента — смена фильтра: до ответа видны
 * прежние строки, а сегменты остаются на месте.
 */
export const ShiftsPage = ({ stage }: { stage?: AppKey.ShiftStage }) => {
  const navigate = useNavigate()

  const state = useDb((db) => (stage ? db.shift.find({ stage }) : db.shift.all()))

  return (
    <AppPage title="Смены" aside={state.data?.length}>
      <AppPage.Segments
        segments={[
          { to: paths.shifts, title: 'Все' },
          ...AppKeys.ShiftStage.map((item) => ({
            to: paths.shiftsByStage(item),
            title: STAGE_TITLES[item]
          }))
        ]}
      />
      {state.stage === 'success' ? (
        <RecordsTable
          rows={[...state.data].sort((a, b) => b.createdAt - a.createdAt)}
          onRowClick={(shift) => navigate(paths.shift(shift.shiftId))}
        />
      ) : (
        <LoadState state={state} />
      )}
    </AppPage>
  )
}
