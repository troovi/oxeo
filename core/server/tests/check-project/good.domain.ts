/** Домен без нарушений: роль, схемы, токены и сервис; помощники — private, # и static. */
import { Collections, Ids, Params } from '@oxeo/scheme'
import { Domain } from '@oxeo/scheme/di'
import { z } from 'zod'
import { GoodService } from './good.service'

@Domain()
export class GoodDomain {
  constructor(
    private collections: Collections,
    private ids: Ids,
    private goodService: GoodService
  ) {}

  @Params(z.object({}))
  async add(_params: {}) {
    return this.helper()
  }

  static create() {
    return null
  }

  private helper() {
    return this.#secret()
  }

  #secret() {
    return [this.collections, this.ids, this.goodService]
  }
}
