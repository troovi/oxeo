/** Перечисления песочницы: литералы в коде, тип — из значения. */
const values = <T extends string>(items: T[]) => {
  return items
}

type ItemOf<T extends string[]> = T[number]

export const AppKeys = {
  WorkerType: values(['office', 'revisor']),
  WorkerStatus: values(['working', 'fired']),
  Position: values(['director', 'recruiter', 'manager', 'accountant']),
  Category: values(['junior', 'middle', 'senior']),
  ProjectStage: values(['active', 'completed']),
  ShiftStage: values(['created', 'recruiting', 'completed', 'canceled']),
  Role: values(['revisor', 'manager']),
  Attendance: values(['onTime', 'late', 'absent']),
  /** Справочники — перечень фиксирован, значения заводятся операциями домена `dictionary`. */
  Dictionary: values(['regions', 'citizenships']),
  /** Источники числовых идентификаторов — счётчики коллекции `counter`. */
  CounterSource: values(['worker', 'client', 'project', 'shift'])
}

export namespace AppKey {
  export type WorkerType = ItemOf<typeof AppKeys.WorkerType>
  export type WorkerStatus = ItemOf<typeof AppKeys.WorkerStatus>
  export type Position = ItemOf<typeof AppKeys.Position>
  export type Category = ItemOf<typeof AppKeys.Category>
  export type ProjectStage = ItemOf<typeof AppKeys.ProjectStage>
  export type ShiftStage = ItemOf<typeof AppKeys.ShiftStage>
  export type Role = ItemOf<typeof AppKeys.Role>
  export type Attendance = ItemOf<typeof AppKeys.Attendance>
  export type Dictionary = ItemOf<typeof AppKeys.Dictionary>
  export type CounterSource = ItemOf<typeof AppKeys.CounterSource>
}
