import { useNavigate, useParams } from 'react-router'
import { AppPage, RecordFields, RecordsTable } from '../../../../app/kit'
import { useDb } from '../data'
import { LoadState } from './LoadState'
import { paths } from './paths'

/** Вход маршрута: другая смена — новый экземпляр записи, иначе до ответа была бы видна прежняя. */
export const ShiftPage = () => {
  const { shiftId } = useParams()

  return <ShiftRecord key={shiftId} shiftId={Number(shiftId)} />
}

/** Запись смены: поля (проект — ссылкой) и участники; строка участника ведёт в сотрудника. */
const ShiftRecord = ({ shiftId }: { shiftId: number }) => {
  const navigate = useNavigate()

  const state = useDb((db) => {
    return { shift: db.shift.get(shiftId), participants: db.participant.find({ shiftId }) }
  })

  if (state.stage !== 'success') {
    return <LoadState state={state} />
  }

  const { shift, participants } = state.data

  if (!shift) {
    return <AppPage.Empty>Смены {shiftId} нет</AppPage.Empty>
  }

  return (
    <AppPage
      title={`Смена #${shift.shiftId} · ${shift.date}`}
      back={{ to: paths.shifts, title: 'Смены' }}
    >
      <RecordFields record={shift} links={{ projectId: paths.project(shift.projectId) }} />
      <AppPage.Section title={`Участники · ${participants.length}`}>
        <RecordsTable
          rows={[...participants].sort((a, b) => a.addedAt - b.addedAt)}
          onRowClick={(participant) => navigate(paths.worker(participant.workerId))}
        />
      </AppPage.Section>
    </AppPage>
  )
}
