/**
 * Готовые блоки экрана песочницы — одни для всех версий: каркас (дашборд и приложение), панель операций
 * доменов с окнами, поля и раскладки formkit над uikit, Networks с записью обменов, view страниц приложения.
 * Что зависит от библиотеки версии, версия пишет сама: приложение (роутер и страницы на её чтении данных) и
 * формы действий — их карту она отдаёт панели операций; запросы ведёт через `network`.
 */
export { AppFrame } from './components/AppFrame'
export type { AppNavItem } from './components/AppFrame'
export { AppPage } from './components/AppPage'
export { Panel } from './components/Panel'
export { RecordFields } from './components/RecordFields'
export { RecordsTable } from './components/RecordsTable'
export { SectionTiles } from './components/SectionTiles'
export { Group } from './formkit/layouts/Group'
export { Label } from './formkit/layouts/Label'
export { InputForm } from './formkit/primitives/input'
export { NumberInputForm } from './formkit/primitives/number-input'
export { SelectForm } from './formkit/primitives/select'
export { SelectTagsForm } from './formkit/primitives/select-tags'
export { ResyncBanner } from './layout/ResyncBanner'
export { SandboxScreen } from './layout/SandboxScreen'
export { StatusBanner } from './layout/StatusBanner'
export { network } from './network'
export type { NetworkEntries, NetworkEntry } from './network'
export { DomainsPanel } from './panels/DomainsPanel'
export { NetworkPanel } from './panels/NetworkPanel'
export { createStore } from './store'
export type { ActionForm, ActionFormOptions, DomainAction, DomainGroup } from './types'
