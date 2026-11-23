import { z } from 'zod'
import { Collections, DomainContext, Ids, Params, notFound } from '../../../lib/scheme'
import { Domain } from '../../../lib/di'
import { invariant } from '../context'
import { ClientsParams } from './clients.params'
import { WorkersDomain } from '../workers/workers.domain'

@Domain()
export class ClientsDomain {
  constructor(
    private collections: Collections,
    private ids: Ids
  ) {}

  // ------------------------------------------- operations --------------------------------------------

  /** Клиент с менеджером — работающим офисным сотрудником. Возвращает `clientId`. */
  @Params(ClientsParams.Create)
  async create(params: z.infer<typeof ClientsParams.Create>, ctx: DomainContext) {
    const manager = await WorkersDomain.loadWorker(this.collections, params.managerId)

    if (manager.type !== 'office' || !WorkersDomain.isWorking(manager)) {
      throw invariant('Менеджер клиента — работающий офисный сотрудник')
    }

    const clientId = await this.ids.number('client')

    await this.collections.client.create({
      clientId,
      name: params.name,
      managerId: params.managerId,
      createdAt: ctx.at
    })

    return clientId
  }

  /**
   * Удаление клиента. Домен проверяет только существование: клиента с проектами не даст удалить сама
   * схема — ссылка `project.clientId` объявлена `restrict`, и oxeo ответит ошибкой целостности
   * `DEPENDENCY_RESTRICT`.
   */
  @Params(ClientsParams.Remove)
  async remove({ clientId }: z.infer<typeof ClientsParams.Remove>) {
    const client = await this.collections.client.get(clientId)

    if (!client) {
      throw notFound(`клиент ${clientId}`)
    }

    await this.collections.client.remove(clientId)
  }
}
