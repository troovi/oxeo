import { createPopupRegistry } from '@companix/uikit'
import { OperationDialog } from './popups/OperationDialog'

/**
 * Реестр окон kit: блоки зовут `Popups.Open.<Name>(data)`, окна рисует `SandboxScreen`. Компоненты окон
 * импортируются только сюда — прямой импорт из блока замкнул бы цикл модулей.
 */
export const Popups = createPopupRegistry({
  Operation: OperationDialog
})
