/**
 * Роли классов для контейнера рантайма — отдельный вход `@oxeo/scheme/di`, только серверу. Контейнер (`@oxeo/server`)
 * собирает домены, представления и их сервисы по типам параметров конструктора, которые TypeScript пишет в
 * `design:paramtypes` при `emitDecoratorMetadata` над классом с декоратором. Метаданные записываются, только если
 * полифил загружен к моменту объявления класса, поэтому вход загружает его первой строкой. В главный вход пакета он не
 * попадает: главный вход грузит и клиент.
 */
import 'reflect-metadata'

/** Роль класса в графе контейнера: корни — домен и представление, общий код — сервис. */
export type ClassRole = 'domain' | 'service' | 'view'

const ROLE_KEY = 'oxeo:role'

const role = (value: ClassRole): ClassDecorator => {
  return (target) => {
    Reflect.defineMetadata(ROLE_KEY, value, target)
  }
}

/** Класс реестра доменов — корень графа: его не внедряют параметром конструктора. */
export function Domain(): ClassDecorator {
  return role('domain')
}

/** Сервис — общий код доменов и представлений; зависит только от сервисов, `Collections` и `Ids`. */
export function Service(): ClassDecorator {
  return role('service')
}

/** Класс реестра представлений — корень графа: его не внедряют параметром конструктора. */
export function View(): ClassDecorator {
  return role('view')
}

/** Роль класса с ролями базовых классов; `null` — класс без декоратора роли. */
export const roleOf = (Class: Function): ClassRole | null => {
  return Reflect.getMetadata(ROLE_KEY, Class) ?? null
}
