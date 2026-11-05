// @ts-nocheck
import { useMemo } from 'react'

const { useEntity, useAll } = createStore(dataSource)

const RolesList = () => {
  const roles = useAll('role')

  return (
    <div>
      {roles.map((role) => (
        <div key={role.value}>{role.title}</div>
      ))}
    </div>
  )
}

interface ShiftProps {
  shiftId: number
  close: () => void
}

const ShiftPreview = ({ shiftId, close }: ShiftProps) => {
  const shift = useEntity('shift', shiftId)

  const initialScreen = useMemo((): ScreenState => {
    if (shift.stage.type === 'canceled') {
      return 'notes'
    }

    if (shift.stage.type === 'completed' || shift.stage.type === 'payed') {
      return 'results'
    }

    return 'revisors'
  }, [])

  return (
    <div className="full shift-viewer flex">
      <div className="shift-viewer-form flex h-full flex-col">
        <div>Данные смены — #{getUIShiftId(shift.shiftId)}</div>
      </div>
      screen: {initialScreen}
    </div>
  )
}

console.log({ RolesList, ShiftPreview })
