/** Сервис, зависящий от домена. */
import { Service } from '@oxeo/scheme/di'
import { GoodDomain } from './good.domain'

@Service()
export class LeakyService {
  constructor(readonly domain: GoodDomain) {}
}
