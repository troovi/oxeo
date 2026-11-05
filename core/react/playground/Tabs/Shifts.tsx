import { generateCode } from '@companix/utils-js'
import { mock } from '@companix/xeo-devkit'
import {
  useAll,
  useEntity,
  useExists,
  useExistsBy,
  useFindBy,
  useFindOneBy,
  useMutations
} from '../dataSource'
import { Renders, useRenderCount } from '../use-render-count'

const STAGE_TYPES = ['recruiting', 'reminding', 'inventory', 'completed', 'payed', 'canceled'] as const
type StageType = (typeof STAGE_TYPES)[number]

let shiftCounter = 2

const ShiftControls = () => {
  const { create } = useMutations('shift')
  const { create: createChat } = useMutations('chat')

  const addShift = () => {
    const id = ++shiftCounter

    createChat(
      mock.NoteChat({
        chatId: `chat-s${id}`,
        shiftId: id
      })
    )

    create(
      mock.Shift({
        shiftId: id,
        projectId: id % 2 === 0 ? 1002 : 1001,
        locationId: id % 2 === 0 ? 'location-2' : 'location-1',
        chatId: `chat-s${id}`,
        adname: `Shift ${id}`,
        revisorRate: 100 + id * 10
      })
    )
  }

  return <button onClick={addShift}>+ Add Shift</button>
}

const ShiftItem = ({ shiftId }: { shiftId: number }) => {
  const renders = useRenderCount()
  const shift = useEntity('shift', shiftId)
  const { update, remove } = useMutations('shift')

  if (!shift) return null

  const nextStage = () => {
    const idx = STAGE_TYPES.indexOf(shift.stage.type as StageType)
    const next = STAGE_TYPES[(idx + 1) % STAGE_TYPES.length]
    update(shiftId, (d) => {
      d.stage =
        next === 'canceled' ? { type: 'canceled', reason: 'test' } : ({ type: next } as typeof d.stage)
    })
  }

  const changeRate = () => {
    update(shiftId, (draft) => {
      draft.revisorRate = Math.floor(100 + Math.random() * 400)
    })
  }

  const rename = () => {
    update(shiftId, (draft) => {
      draft.adname = `Shift ${generateCode(4)}`
    })
  }

  return (
    <li style={{ marginBottom: 8 }}>
      <b>#{shift.shiftId}</b> {shift.adname} — {shift.revisorRate}₽/h{' '}
      <span style={{ fontSize: 11, background: '#eef', padding: '1px 4px', borderRadius: 3 }}>
        {shift.stage.type}
      </span>{' '}
      <Renders count={renders} />
      <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
        <button onClick={rename}>Rename</button>
        <button onClick={changeRate}>Rate</button>
        <button onClick={nextStage}>Next stage</button>
        <button onClick={() => remove(shiftId)}>Remove</button>
      </div>
    </li>
  )
}

const ShiftsByStage = ({ stage }: { stage: StageType }) => {
  const renders = useRenderCount()
  const shifts = useFindBy('shift', { stage: { type: stage } })

  return (
    <div style={{ flex: 1 }}>
      <h4>
        useFindBy stage={stage} ({shifts.length}) <Renders count={renders} />
      </h4>
      <ul style={{ paddingLeft: 16, minHeight: 40 }}>
        {shifts.map((s) => (
          <li key={s.shiftId}>
            #{s.shiftId} — {s.adname}
          </li>
        ))}
      </ul>
    </div>
  )
}

const ShiftFindOne = () => {
  const renders = useRenderCount()
  const shift = useFindOneBy('shift', { stage: { type: 'recruiting' } })

  return (
    <div>
      <b>useFindOneBy recruiting:</b> {shift ? `#${shift.shiftId} ${shift.adname}` : '—'}{' '}
      <Renders count={renders} />
    </div>
  )
}

const ShiftExistsBy = () => {
  const renders = useRenderCount()
  const hasPayed = useExistsBy('shift', { stage: { type: 'payed' } })
  const hasCanceled = useExistsBy('shift', { stage: { type: 'canceled' } })

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <span>
        payed exists: <b>{String(hasPayed)}</b> <Renders count={renders} />
      </span>
      <span>
        canceled exists: <b>{String(hasCanceled)}</b>
      </span>
    </div>
  )
}

interface ExistsCheckProps {
  shiftId: number
}

const ShiftExists = ({ shiftId }: ExistsCheckProps) => {
  const renders = useRenderCount()
  const exists = useExists('shift', shiftId)

  return (
    <span>
      Shift #{shiftId}: {exists ? 'exists' : 'not found'} <Renders count={renders} />
    </span>
  )
}

export const ShiftsSection = () => {
  const renders = useRenderCount()
  const shifts = useAll('shift')

  return (
    <section>
      <h3>Shifts</h3>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <h4>
            All shifts ({shifts.length}) <Renders count={renders} />
          </h4>
          <ul style={{ paddingLeft: 16 }}>
            {shifts.map((s) => (
              <ShiftItem key={s.shiftId} shiftId={s.shiftId} />
            ))}
          </ul>
          <ShiftControls />
        </div>
        <div style={{ flex: 1 }}>
          <ShiftsByStage stage="recruiting" />
          <ShiftsByStage stage="inventory" />
          <ShiftFindOne />
          <div style={{ marginTop: 8 }}>
            <ShiftExistsBy />
          </div>
          <div style={{ marginTop: 8 }}>
            <ShiftExists shiftId={1} />
            <br />
            <ShiftExists shiftId={999} />
          </div>
        </div>
      </div>
    </section>
  )
}
