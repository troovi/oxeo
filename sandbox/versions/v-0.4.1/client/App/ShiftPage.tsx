import { useNavigate, useParams } from 'react-router'
import { AppPage, RecordFields, RecordsTable } from '../../../../app/kit'
import { db, live } from '../data'
import { paths } from './paths'

/** Запись смены: поля (проект — ссылкой) и участники; строка участника ведёт в сотрудника. */
export const ShiftPage = live(() => {
  const params = useParams()
  const navigate = useNavigate()

  const shiftId = Number(params.shiftId)

  const shift = db.shift.get(shiftId)
  const participants = db.participant.find({ shiftId })

  if (!shift) {
    return <AppPage.Empty>Смены {params.shiftId} нет</AppPage.Empty>
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
})
