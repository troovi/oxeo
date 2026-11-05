/**
 * Посев через операции доменов от имени системы — так же, как сеет CRM: целостность и счётчики ведёт
 * библиотека. Посев детерминированный: свой генератор случайных чисел с фиксированным зерном и момент
 * T0, поэтому перезапуск сервера даёт ту же базу. Размеры — константами, чтобы менять вес снимка.
 */
import { DomainRoutes } from '../lib'
import { AppKey, AppKeys } from '../core/keys'
import { AppDomains } from '../core/domains'
import { JournalService } from './journal.service'

type Routes = DomainRoutes<AppDomains>

interface Call<D extends keyof Routes & string, M extends keyof Routes[D] & string> {
  domain: D
  method: M
  params: Routes[D][M]['params']
}

const SIZES = {
  office: 8,
  revisors: 40,
  clients: 12,
  projects: 30,
  shiftsPerProject: 8,
  participantsPerShift: { min: 3, max: 6 }
}

/** Момент «сейчас» посева: смены раньше него завершены, позже — в наборе или ещё новые. */
export const T0 = Date.UTC(2026, 10, 4, 9)

/** Доля будущих смен, у которых посев не запускает набор: они остаются в стадии `created`. */
const NEW_SHIFTS_SHARE = 0.3

const HOUR = 3_600_000
const DAY = 24 * HOUR

const FIRST_NAMES = [
  'Иван',
  'Анна',
  'Олег',
  'Мария',
  'Пётр',
  'Елена',
  'Сергей',
  'Ольга',
  'Дмитрий',
  'Наталья',
  'Андрей',
  'Татьяна',
  'Алексей',
  'Ирина',
  'Максим',
  'Светлана'
]

const LAST_NAMES = [
  'Иванов',
  'Петров',
  'Сидоров',
  'Козлов',
  'Смирнов',
  'Попов',
  'Волков',
  'Соколов',
  'Лебедев',
  'Новиков',
  'Морозов',
  'Павлов',
  'Семёнов',
  'Голубев',
  'Виноградов',
  'Богданов'
]

const COMPANIES = [
  'Лента',
  'Магнит',
  'Пятёрочка',
  'Перекрёсток',
  'Ашан',
  'Метро',
  'ВкусВилл',
  'Дикси',
  'О’Кей',
  'Спортмастер',
  'Детский мир',
  'Леруа Мерлен'
]

const REGIONS = [
  'Москва',
  'Санкт-Петербург',
  'Казань',
  'Новосибирск',
  'Екатеринбург',
  'Нижний Новгород'
]

const CITIZENSHIPS = ['Россия', 'Беларусь', 'Казахстан', 'Узбекистан', 'Киргизия']

/** Должности офисных, кроме директора: он один — первый сотрудник посева. */
const OTHER_POSITIONS = AppKeys.Position.filter((position) => position !== 'director')

/** mulberry32 — маленький детерминированный генератор для посева. */
const createRandom = (seed: number) => {
  let state = seed

  return () => {
    state = (state + 0x6d2b79f5) | 0

    let t = Math.imul(state ^ (state >>> 15), 1 | state)

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const seed = async (shell: JournalService['shell']) => {
  const random = createRandom(2026)

  const pick = <T>(items: T[]) => {
    return items[Math.floor(random() * items.length)]
  }

  const between = (min: number, max: number) => {
    return min + Math.floor(random() * (max - min + 1))
  }

  const fullName = (i: number) => {
    return `${LAST_NAMES[i % LAST_NAMES.length]} ${FIRST_NAMES[(i * 7) % FIRST_NAMES.length]}`
  }

  const contacts = (i: number) => {
    return {
      phone: `+7 900 ${String(1000000 + i).slice(1)}`,
      email: `worker${i}@example.com`
    }
  }

  let at = T0 - 120 * DAY

  /** Операция от имени системы в момент `moment`; по умолчанию — через час после предыдущей. */
  const run = async <D extends keyof Routes & string, M extends keyof Routes[D] & string>(
    call: Call<D, M>,
    moment = (at += HOUR)
  ) => {
    const event = await shell.run(call, null, { at: moment })

    return event.result
  }

  // dictionaries

  await run({ domain: 'dictionary', method: 'ensureDictionaries', params: {} })

  const regionIds: string[] = []
  const citizenshipIds: string[] = []

  for (const title of REGIONS) {
    regionIds.push(
      await run({ domain: 'dictionary', method: 'addOption', params: { dictionary: 'regions', title } })
    )
  }

  for (const title of CITIZENSHIPS) {
    citizenshipIds.push(
      await run({
        domain: 'dictionary',
        method: 'addOption',
        params: { dictionary: 'citizenships', title }
      })
    )
  }

  /** Справочные поля сотрудника: один или два региона; гражданство чаще первое, иногда не указано. */
  const dictionaryFields = () => {
    const first = pick(regionIds)
    const second = pick(regionIds)
    const roll = random()

    return {
      regionIds: first === second ? [first] : [first, second],
      citizenshipId: roll < 0.7 ? citizenshipIds[0] : roll < 0.9 ? pick(citizenshipIds.slice(1)) : null
    }
  }

  // workers

  const officeIds: number[] = []
  const revisorIds: number[] = []

  for (let i = 0; i < SIZES.office; i++) {
    const positions: AppKey.Position[] = i === 0 ? ['director'] : [pick(OTHER_POSITIONS)]

    officeIds.push(
      await run({
        domain: 'workers',
        method: 'createOffice',
        params: { name: fullName(i), contacts: contacts(i), positions, ...dictionaryFields() }
      })
    )
  }

  for (let i = 0; i < SIZES.revisors; i++) {
    revisorIds.push(
      await run({
        domain: 'workers',
        method: 'createRevisor',
        params: {
          name: fullName(SIZES.office + i),
          contacts: contacts(SIZES.office + i),
          category: pick(AppKeys.Category),
          ...dictionaryFields()
        }
      })
    )
  }

  // clients and projects

  const clientIds: number[] = []
  const projectIds: number[] = []

  for (let i = 0; i < SIZES.clients; i++) {
    clientIds.push(
      await run({
        domain: 'clients',
        method: 'create',
        params: {
          name: COMPANIES[i % COMPANIES.length],
          managerId: pick(officeIds)
        }
      })
    )
  }

  for (let i = 0; i < SIZES.projects; i++) {
    const clientId = clientIds[i % clientIds.length]

    projectIds.push(
      await run({
        domain: 'projects',
        method: 'create',
        params: {
          clientId,
          name: `Инвентаризация ${COMPANIES[(i % clientIds.length) % COMPANIES.length]} · ${i + 1}`,
          recruiterIds: [officeIds[1 + (i % (officeIds.length - 1))]]
        }
      })
    )
  }

  // shifts: dates spread from −60 to +30 days around T0

  for (const projectId of projectIds) {
    for (let i = 0; i < SIZES.shiftsPerProject; i++) {
      const dayOffset = between(-60, 30)
      const shiftStart = T0 + dayOffset * DAY
      const createdAt = shiftStart - 10 * DAY

      const shiftId = await run(
        {
          domain: 'shifts',
          method: 'create',
          params: {
            projectId,
            date: new Date(shiftStart).toISOString().slice(0, 10),
            plan: between(2, 5),
            rate: between(12, 20) * 100
          }
        },
        createdAt
      )

      if (random() < 0.05) {
        await run(
          {
            domain: 'shifts',
            method: 'cancel',
            params: { shiftId, reason: 'Клиент перенёс пересчёт' }
          },
          createdAt + HOUR
        )
        continue
      }

      // будущая смена остаётся новой: набор у неё запускают из панели операций
      if (shiftStart > T0 && random() < NEW_SHIFTS_SHARE) {
        continue
      }

      await run({ domain: 'shifts', method: 'launchRecruiting', params: { shiftId } }, createdAt + HOUR)

      const count = between(SIZES.participantsPerShift.min, SIZES.participantsPerShift.max)
      const crew = [...revisorIds].sort(() => random() - 0.5).slice(0, count)
      const participantIds: string[] = []

      for (const [index, workerId] of crew.entries()) {
        participantIds.push(
          await run(
            {
              domain: 'shifts',
              method: 'addParticipant',
              params: {
                shiftId,
                workerId,
                role: index === 0 ? 'manager' : 'revisor'
              }
            },
            createdAt + 2 * HOUR + index * HOUR
          )
        )
      }

      if (shiftStart > T0) {
        continue
      }

      for (const participantId of participantIds) {
        const roll = random()
        const attendance = roll < 0.75 ? 'onTime' : roll < 0.92 ? 'late' : 'absent'

        await run(
          {
            domain: 'shifts',
            method: 'setAttendance',
            params: { participantId, attendance }
          },
          shiftStart + 9 * HOUR
        )
      }

      await run({ domain: 'shifts', method: 'complete', params: { shiftId } }, shiftStart + 18 * HOUR)
    }
  }
}
