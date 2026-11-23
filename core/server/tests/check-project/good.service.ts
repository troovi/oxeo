/** Сервис без нарушений: публичным методам сервиса схема не нужна. */
import { Collections } from '@oxeo/scheme'
import { Service } from '@oxeo/scheme/di'

@Service()
export class GoodService {
  constructor(private collections: Collections) {}

  count() {
    return Object.keys(this.collections).length
  }
}
