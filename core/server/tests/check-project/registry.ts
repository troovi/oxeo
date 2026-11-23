/** Реестры проекта проверки полноты. */
import { BareDomain } from './bare.domain'
import { GoodDomain } from './good.domain'
import { MixedDomain } from './mixed.domain'
import { ReportReader } from './report.view'

export const appDomains = { good: GoodDomain, bare: BareDomain, mixed: MixedDomain }

export const appViews = { reports: ReportReader }
