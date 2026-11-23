/** Представление: чужое имя, метод без схемы, параметр не по имени сервиса, сервис с доменом. */
import { View } from '@oxeo/scheme/di'
import { LeakyService } from './leaky.service'

@View()
export class ReportReader {
  constructor(readonly leaky: LeakyService) {}

  async total(_params: {}) {
    return 0
  }
}
