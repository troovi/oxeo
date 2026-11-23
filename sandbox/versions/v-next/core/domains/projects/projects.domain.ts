import { z } from 'zod'
import { Collections, DomainContext, Ids, Params, existing, notFound } from '../../../lib/scheme'
import { Domain } from '../../../lib/di'
import { invariant } from '../context'
import { ProjectsParams } from './projects.params'
import { WorkersDomain } from '../workers/workers.domain'

@Domain()
export class ProjectsDomain {
  constructor(
    private collections: Collections,
    private ids: Ids
  ) {}

  // ------------------------------------------- operations --------------------------------------------

  /**
   * Проект клиента в стадии `active`. Кадровики проверяются до выдачи номера: схема бы тоже отказала
   * (`ReferenceSet` на несуществующий сотрудник), но уже после того, как счётчик сдвинулся без события.
   * Возвращает `projectId`.
   */
  @Params(ProjectsParams.Create)
  async create(params: z.infer<typeof ProjectsParams.Create>, ctx: DomainContext) {
    const client = await this.collections.client.get(params.clientId)

    if (!client) {
      throw notFound(`клиент ${params.clientId}`)
    }

    for (const recruiterId of params.recruiterIds) {
      const recruiter = await WorkersDomain.loadWorker(this.collections, recruiterId)

      if (!WorkersDomain.isWorking(recruiter)) {
        throw invariant('Кадровик проекта — работающий сотрудник')
      }
    }

    const projectId = await this.ids.number('project')

    await this.collections.project.create({
      projectId,
      name: params.name,
      clientId: params.clientId,
      stage: 'active',
      recruiterIds: [...params.recruiterIds],
      createdAt: ctx.at,
      completedAt: null
    })

    return projectId
  }

  /** Завершение проекта — когда ни одна его смена не ждёт набора или проведения. */
  @Params(ProjectsParams.Complete)
  async complete({ projectId }: z.infer<typeof ProjectsParams.Complete>, ctx: DomainContext) {
    const project = await ProjectsDomain.loadProject(this.collections, projectId)

    if (project.stage === 'completed') {
      throw invariant('Проект уже завершён')
    }

    const shifts = await this.collections.shift.findBy({ projectId })
    const isOpen = shifts.some((shift) => shift.stage === 'created' || shift.stage === 'recruiting')

    if (isOpen) {
      throw invariant('У проекта есть незавершённые смены')
    }

    await this.collections.project.update(projectId, (draft) => {
      draft.completedAt = ctx.at
      draft.stage = 'completed'
    })
  }

  // --------------------------------------------- helpers ---------------------------------------------

  /** Проект или отказ `notFound` — для других доменов. */
  static loadProject(collections: Collections, projectId: number) {
    return existing(collections.project.get(projectId), `проект ${projectId}`)
  }
}
