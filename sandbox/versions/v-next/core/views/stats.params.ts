import { z } from 'zod'

export namespace StatsViewParams {
  export const ShiftStages = z.object({ from: z.string().nullable() })
}
