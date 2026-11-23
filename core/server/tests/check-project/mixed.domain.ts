/** Домен, у которого каждый параметр конструктора нарушает своё правило. */
import { Domain } from '@oxeo/scheme/di'
import { GoodDomain } from './good.domain'
import { PlainService } from './plain.service'
import type { TypedService } from './typed.service'

interface Shape {
  size: number
}

interface LocalToken {}
abstract class LocalToken {}

@Domain()
export class MixedDomain {
  constructor(
    readonly shape: Shape,
    readonly typed: TypedService,
    readonly plain: PlainService,
    readonly other: GoodDomain,
    readonly local: LocalToken,
    readonly label: string
  ) {}
}
