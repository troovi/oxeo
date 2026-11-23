import type { z } from 'zod'
import { Collections, Params } from '../../lib/scheme'
import type { ViewContext } from '../../lib/scheme'
import { View } from '../../lib/di'
import type { AppKey } from '../keys'
import { StatsViewParams } from './stats.params'

/** Смены по стадиям: число и план ревизоров. */
export type StageSummary = Record<AppKey.ShiftStage, { shifts: number; plan: number }>

/**
 * Сводки, которые считает сервер: клиент получает значение, а не записи. Пересчёт — когда событие тронет прочитанные
 * коллекции.
 */
@View()
export class StatsView {
  constructor(private collections: Collections) {}

  /** Смены по стадиям с планом ревизоров; `from` — смены с этой даты, без неё — все. */
  @Params(StatsViewParams.ShiftStages)
  async shiftStages(params: z.infer<typeof StatsViewParams.ShiftStages>, _ctx: ViewContext) {
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
