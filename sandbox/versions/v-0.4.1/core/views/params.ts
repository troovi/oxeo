/** Схемы параметров представлений по реестру: сервер проверяет ими каждый запрос значения. Клиент файл не импортирует. */
import { z } from 'zod'
import { createViewsParams } from '../../lib/scheme'
import type { AppViews } from './index'

export const appViewParams = createViewsParams<AppViews>({
  stats: {
    shiftStages: z.object({ from: z.string().nullable() })
  }
})
