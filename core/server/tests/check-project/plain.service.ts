/** Сервис без декоратора роли — с параметрами конструктора. */
import { Collections } from '@oxeo/scheme'

export class PlainService {
  constructor(readonly collections: Collections) {}
}
