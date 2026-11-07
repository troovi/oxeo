import type { Collections, ViewContext } from '../../lib/scheme'
import type { Actor } from '../domains'
import type { AppKey } from '../keys'
import type { AppScheme } from '../scheme'

/** Смены по стадиям: число и план ревизоров. */
export type StageSummary = Record<AppKey.ShiftStage, { shifts: number; plan: number }>

/**
 * Сводки, которые считает сервер: клиент получает значение, а не записи. Пересчёт — когда событие тронет прочитанные
 * коллекции.
 */
export class StatsViews {
  constructor(private collections: Collections<AppScheme>) {}

  /** Смены по стадиям с планом ревизоров; `from` — смены с этой даты, без неё — все. */
  async shiftStages(params: { from: string | null }, _ctx: ViewContext<Actor>) {
    const shifts = await this.collections.shift.findBy(
      params.from ? { date: { gte: params.from } } : {}
    )
    const summary: StageSummary = {
      created: { shifts: 0, plan: 0 },
      recruiting: { shifts: 0, plan: 0 },
      completed: { shifts: 0, plan: 0 },
      canceled: { shifts: 0, plan: 0 }
    }

    shifts.forEach((shift) => {
      summary[shift.stage].shifts += 1
      summary[shift.stage].plan += shift.plan
    })

    return summary
  }
}
