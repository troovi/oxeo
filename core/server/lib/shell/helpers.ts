/** Исполнение доменов на сервере: экземпляры доменов над коллекциями и поиск метода для вызова. */
import {
  DomainCall,
  DomainContext,
  DomainError,
  DomainServices,
  DomainsMap
} from '@oxeo/scheme'

type DomainMethod = (params: unknown, ctx: DomainContext<any, any>) => Promise<unknown>

/** Экземпляры доменов над коллекциями базы. */
export const initializeDomains = <T extends DomainsMap>(
  domains: T,
  collections: ConstructorParameters<T[keyof T]>[0]
) => {
  const services = {} as DomainServices<T>

  for (const name in domains) {
    services[name] = new domains[name](collections) as DomainServices<T>[typeof name]
  }

  return services
}

const hasOwn = Object.prototype.hasOwnProperty

/**
 * Метод домена для вызова `methodOf(services, call)(call.params, ctx)`. Домен — собственный ключ
 * реестра, метод объявлен в самом классе домена: не унаследован (`toString`…) и не конструктор.
 * Какие методы публичны, решают маршруты (`DomainRoutes`): TS-`private` в рантайме не виден, поэтому
 * хелперы домена объявляются `private`, а вызовы приходят только из маршрутов сервера и его событий.
 */
export const methodOf = (services: object, { domain, method }: DomainCall): DomainMethod => {
  const registry = services as Record<string, Record<string, unknown>>
  const service = hasOwn.call(registry, domain) ? registry[domain] : null
  const declared =
    service !== null && method !== 'constructor' && hasOwn.call(Object.getPrototypeOf(service), method)

  if (!declared || typeof service[method] !== 'function') {
    throw new DomainError('notFound', `Operation ${domain}.${method} not found`)
  }

  return (service[method] as DomainMethod).bind(service)
}
