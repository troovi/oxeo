// ---------------------------------------------------------------------------
// 2. Field-level tracking — only re-render when the read field changes
// ---------------------------------------------------------------------------

import { useEntity, useMutations } from '../dataSource'
import { Renders, useRenderCount } from '../use-render-count'

interface ShiftFieldProps {
  shiftId: number
}

const ShiftName = ({ shiftId }: ShiftFieldProps) => {
  const renders = useRenderCount()
  const shift = useEntity('shift', shiftId)

  if (!shift) return null

  return (
    <div>
      <b>adname:</b> {shift.adname} <Renders count={renders} />
    </div>
  )
}

const ShiftComment = ({ shiftId }: ShiftFieldProps) => {
  const renders = useRenderCount()
  const shift = useEntity('shift', shiftId)

  if (!shift) return null

  return (
    <div>
      <b>comment:</b> {shift.comment || '(empty)'} <Renders count={renders} />
    </div>
  )
}

const ShiftStage = ({ shiftId }: ShiftFieldProps) => {
  const renders = useRenderCount()
  const shift = useEntity('shift', shiftId)

  if (!shift) return null

  return (
    <div>
      <b>stage:</b> {shift.stage.type} <Renders count={renders} />
    </div>
  )
}

const ShiftRate = ({ shiftId }: ShiftFieldProps) => {
  const renders = useRenderCount()
  const shift = useEntity('shift', shiftId)

  if (!shift) return null

  return (
    <div>
      <b>rate:</b> {shift.revisorRate}₽ <Renders count={renders} />
    </div>
  )
}

export const FieldTrackingDemo = () => {
  const shiftId = 1
  const { update } = useMutations('shift')

  const updateName = () => {
    update(shiftId, (draft) => {
      draft.adname = `Renamed at ${Date.now() % 10000}`
    })
  }

  const updateComment = () => {
    update(shiftId, (draft) => {
      draft.comment = `Note ${Date.now() % 10000}`
    })
  }

  const updateRate = () => {
    update(shiftId, (draft) => {
      draft.revisorRate = Math.floor(100 + Math.random() * 200)
    })
  }

  return (
    <section>
      <h3>Field-Level Tracking (Shift #{shiftId})</h3>
      <p>Each field is a separate hook. Updating one field only re-renders that component.</p>

      <ShiftName shiftId={shiftId} />
      <ShiftComment shiftId={shiftId} />
      <ShiftStage shiftId={shiftId} />
      <ShiftRate shiftId={shiftId} />

      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        <button onClick={updateName}>Update adname</button>
        <button onClick={updateComment}>Update comment</button>
        <button onClick={updateRate}>Update rate</button>
      </div>
    </section>
  )
}
