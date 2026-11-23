/**
 * Токены окружения — классы, по которым контейнер рантайма подставляет в конструктор коллекции и выдачу
 * идентификаторов. Токен — абстрактный класс, слитый с интерфейсом: тип — по `Register`, в `design:paramtypes` — сам
 * класс библиотеки, поэтому импорт обычный, не `import type`.
 */
import type { CollectionsOf } from '../core/types/collections.types'
import type { RegisteredCounter, RegisteredScheme } from '../register'
import type { IdSource } from './context'

/** Коллекции схемы проекта (`Register.scheme`); в представлении — только на чтение. */
export interface Collections extends CollectionsOf<RegisteredScheme> {}
export abstract class Collections {}

/**
 * Выдача идентификаторов: номера — счётчиками по источникам `Register.counters`, строки — `hash()`. В представлении
 * её нет.
 */
export interface Ids extends IdSource<RegisteredCounter> {}
export abstract class Ids {}
