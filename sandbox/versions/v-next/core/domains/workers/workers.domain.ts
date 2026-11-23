import { z } from 'zod'
import { Collections, DomainContext, Ids, Params, existing } from '../../../lib/scheme'
import { Domain } from '../../../lib/di'
import { invariant } from '../context'
import { WorkerEntities } from '../../scheme'
import { DictionaryDomain } from '../dictionary/dictionary.domain'
import { WorkersParams } from './workers.params'

/** Поля сотрудника из справочников — в параметрах создания. */
interface DictionaryFields {
  regionIds: string[]
  citizenshipId: string | null
}

@Domain()
export class WorkersDomain {
  constructor(
    private collections: Collections,
    private ids: Ids
  ) {}

  // ------------------------------------------- operations --------------------------------------------

  /**
   * Офисный сотрудник: номер из счётчика, статус `working`, момент создания — `ctx.at`; регионы и
   * гражданство — значения своих справочников. Возвращает `workerId`.
   */
  @Params(WorkersParams.CreateOffice)
  async createOffice(params: z.infer<typeof WorkersParams.CreateOffice>, ctx: DomainContext) {
    await this.expectDictionaries(params)

    const workerId = await this.ids.number('worker')

    await this.collections.worker.create({
      workerId,
      type: 'office',
      name: params.name,
      status: 'working',
      createdAt: ctx.at,
      contacts: { phone: params.contacts.phone, email: params.contacts.email },
      regionIds: [...params.regionIds],
      citizenshipId: params.citizenshipId,
      positions: [...params.positions]
    })

    return workerId
  }

  /**
   * Ревизор с категорией; номер — из того же счётчика, что у офисных, справочники — как у офисного.
   * Возвращает `workerId`.
   */
  @Params(WorkersParams.CreateRevisor)
  async createRevisor(params: z.infer<typeof WorkersParams.CreateRevisor>, ctx: DomainContext) {
    await this.expectDictionaries(params)

    const workerId = await this.ids.number('worker')

    await this.collections.worker.create({
      workerId,
      type: 'revisor',
      name: params.name,
      status: 'working',
      createdAt: ctx.at,
      contacts: { phone: params.contacts.phone, email: params.contacts.email },
      regionIds: [...params.regionIds],
      citizenshipId: params.citizenshipId,
      category: params.category
    })

    return workerId
  }

  /** Переименование — точечный патч одного поля. */
  @Params(WorkersParams.Rename)
  async rename({ workerId, name }: z.infer<typeof WorkersParams.Rename>) {
    await this.getWorker(workerId)

    await this.collections.worker.update(workerId, (draft) => {
      draft.name = name
    })
  }

  /** Увольнение: статус `fired`; уволенный повторно не увольняется и не может быть актором. */
  @Params(WorkersParams.Fire)
  async fire({ workerId }: z.infer<typeof WorkersParams.Fire>) {
    const worker = await this.getWorker(workerId)

    if (worker.status === 'fired') {
      throw invariant('Сотрудник уже уволен')
    }

    await this.collections.worker.update(workerId, (draft) => {
      draft.status = 'fired'
    })
  }

  // --------------------------------------------- helpers ---------------------------------------------

  /** Работающий сотрудник: только такой назначается менеджером, кадровиком и участником смены. */
  static isWorking(worker: WorkerEntities.Worker | null): worker is WorkerEntities.Worker {
    return worker !== null && worker.status === 'working'
  }

  /** Сотрудник или отказ `notFound` — для других доменов. */
  static loadWorker(collections: Collections, workerId: number) {
    return existing(collections.worker.get(workerId), `сотрудник ${workerId}`)
  }

  // --------------------------------------------- private ---------------------------------------------

  private getWorker(workerId: number) {
    return WorkersDomain.loadWorker(this.collections, workerId)
  }

  /** Регионы — из справочника `regions`, гражданство — из `citizenships`; до выдачи номера. */
  private async expectDictionaries({ regionIds, citizenshipId }: DictionaryFields) {
    await DictionaryDomain.expectOptions(this.collections, { dictionary: 'regions', values: regionIds })

    if (citizenshipId !== null) {
      await DictionaryDomain.expectOptions(this.collections, {
        dictionary: 'citizenships',
        values: [citizenshipId]
      })
    }
  }
}
