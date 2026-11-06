import { z } from 'zod'
import { Collections, sortById } from '../../../lib/scheme'
import { DomainContext, DomainIds, invariant, notFound } from '../context'
import { AppScheme, ShiftEntities } from '../../scheme'
import { ProjectsDomain } from '../projects/projects.domain'
import { WorkersDomain } from '../workers/workers.domain'
import { ShiftsParams } from './shifts.params'

/** Ставка менеджера смены — к ставке ревизора. */
const MANAGER_RATE_FACTOR = 1.5

export class ShiftsDomain {
  constructor(
    private collections: Collections<AppScheme>,
    private ids: DomainIds
  ) {}

  // ------------------------------------------- operations --------------------------------------------

  /**
   * Смена активного проекта в стадии `created`, состав пуст (так требует `HasMany`). Возвращает
   * `shiftId`.
   */
  async create(params: z.infer<typeof ShiftsParams.Create>, ctx: DomainContext) {
    const project = await ProjectsDomain.loadProject(this.collections, params.projectId)

    if (project.stage !== 'active') {
      throw invariant('Смены создаются только у активного проекта')
    }

    const shiftId = await this.ids.number('shift')

    await this.collections.shift.create({
      shiftId,
      projectId: params.projectId,
      date: params.date,
      stage: 'created',
      plan: params.plan,
      rate: params.rate,
      cancelReason: null,
      createdAt: ctx.at,
      completedAt: null,
      stats: { attended: null, total: null },
      participantIds: []
    })

    return shiftId
  }

  /** Запуск набора: `created → recruiting`, ставка должна быть задана. */
  async launchRecruiting({ shiftId }: z.infer<typeof ShiftsParams.LaunchRecruiting>) {
    const shift = await this.getShift(shiftId)

    if (shift.stage !== 'created') {
      throw invariant('Набор запускается у новой смены')
    }

    if (shift.rate <= 0) {
      throw invariant('Ставка смены не задана')
    }

    await this.collections.shift.update(shiftId, (draft) => {
      draft.stage = 'recruiting'
    })
  }

  /**
   * Участник смены в наборе: работающий сотрудник, не состоящий в этой смене. Запись `participant` с
   * `BelongsTo` сама попадает в `shift.participantIds`. Возвращает `participantId`.
   */
  async addParticipant(params: z.infer<typeof ShiftsParams.AddParticipant>, ctx: DomainContext) {
    const shift = await this.getShift(params.shiftId)

    if (shift.stage !== 'recruiting') {
      throw invariant('Состав набирается у смены в наборе')
    }

    const worker = await WorkersDomain.loadWorker(this.collections, params.workerId)

    if (!WorkersDomain.isWorking(worker)) {
      throw invariant('Уволенный сотрудник не выходит на смены')
    }

    const isInShift = await this.collections.participant.existsBy({
      shiftId: params.shiftId,
      workerId: params.workerId
    })

    if (isInShift) {
      throw invariant('Сотрудник уже в составе смены')
    }

    const participantId = this.ids.string('participant')

    await this.collections.participant.create({
      participantId,
      shiftId: params.shiftId,
      workerId: params.workerId,
      role: params.role,
      attendance: null,
      earned: null,
      addedAt: ctx.at
    })

    return participantId
  }

  /** Снятие участника до завершения смены: запись удаляется, ссылка из `participantIds` уходит сама. */
  async withdraw({ participantId }: z.infer<typeof ShiftsParams.Withdraw>) {
    const participant = await this.getParticipant(participantId)
    const shift = await this.getShift(participant.shiftId)

    if (shift.stage === 'completed') {
      throw invariant('Состав завершённой смены не меняется')
    }

    await this.collections.participant.remove(participantId)
  }

  /** Явка участника — у смены в наборе; завершение требует явку у всех. */
  async setAttendance({ participantId, attendance }: z.infer<typeof ShiftsParams.SetAttendance>) {
    const participant = await this.getParticipant(participantId)
    const shift = await this.getShift(participant.shiftId)

    if (shift.stage !== 'recruiting') {
      throw invariant('Явка отмечается у смены в наборе')
    }

    await this.collections.participant.update(participantId, (draft) => {
      draft.attendance = attendance
    })
  }

  /**
   * Завершение: у всех участников отмечена явка; каждому начисляется ставка (отсутствующему — 0), итоги
   * — в `stats`, стадия пишется последней отдельной записью.
   */
  async complete({ shiftId }: z.infer<typeof ShiftsParams.Complete>, ctx: DomainContext) {
    const shift = await this.getShift(shiftId)

    if (shift.stage !== 'recruiting') {
      throw invariant('Завершается смена в наборе')
    }

    const found = await this.collections.participant.findBy({ shiftId })
    const participants = sortById(found, (participant) => participant.participantId)

    if (participants.some((participant) => participant.attendance === null)) {
      throw invariant('У всех участников должна быть отмечена явка')
    }

    const stats = { attended: 0, total: 0 }

    for (const participant of participants) {
      const earned = ShiftsDomain.earnedOf(participant, shift.rate)

      stats.attended += participant.attendance === 'absent' ? 0 : 1
      stats.total += earned

      await this.collections.participant.update(participant.participantId, (draft) => {
        draft.earned = earned
      })
    }

    await this.collections.shift.update(shiftId, (draft) => {
      draft.stats.attended = stats.attended
      draft.stats.total = stats.total
      draft.completedAt = ctx.at
    })

    await this.collections.shift.update(shiftId, (draft) => {
      draft.stage = 'completed'
    })
  }

  /** Отмена с причиной — до завершения. */
  async cancel({ shiftId, reason }: z.infer<typeof ShiftsParams.Cancel>) {
    const shift = await this.getShift(shiftId)

    if (shift.stage === 'completed' || shift.stage === 'canceled') {
      throw invariant('Смена уже завершена или отменена')
    }

    await this.collections.shift.update(shiftId, (draft) => {
      draft.cancelReason = reason
      draft.stage = 'canceled'
    })
  }

  // --------------------------------------------- helpers ---------------------------------------------

  /** Начисление участнику по ставке смены: отсутствующему — 0, менеджеру — ставка с коэффициентом. */
  static earnedOf(participant: ShiftEntities.Participant, rate: number) {
    if (participant.attendance === 'absent') {
      return 0
    }

    if (participant.role === 'manager') {
      return rate * MANAGER_RATE_FACTOR
    }

    return rate
  }

  // --------------------------------------------- private ---------------------------------------------

  private async getShift(shiftId: number) {
    const shift = await this.collections.shift.get(shiftId)

    if (!shift) {
      throw notFound(`смена ${shiftId}`)
    }

    return shift
  }

  private async getParticipant(participantId: string) {
    const participant = await this.collections.participant.get(participantId)

    if (!participant) {
      throw notFound(`участник ${participantId}`)
    }

    return participant
  }
}
