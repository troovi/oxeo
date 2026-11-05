import { ChatEntities } from './chat'
import { ClientEntities } from './clients'
import { DictionaryEntities } from './dictionary'
import { ProjectEntities } from './projects'
import { RoleEntities } from './roles'
import { ShiftEntities } from './shifts'
import { WorkerEntities } from './workers'

// prettier-ignore
type MakeProps<T, RequiredKeys extends keyof T = never> = { [P in RequiredKeys]: T[P] } & { [P in Exclude<keyof T, RequiredKeys>]?: T[P] }

type WorkerNestedProps<T extends { about: unknown; documents: unknown; contacts: { film: unknown } }> =
  Omit<T, 'about' | 'documents' | 'contacts'> & {
    about?: Partial<T['about']>
    documents?: Partial<T['documents']>
    contacts?: Omit<Partial<T['contacts']>, 'film'> & {
      film?: Partial<T['contacts']['film']>
    }
  }

// prettier-ignore
export const mock = {
  Dictionary: (params: MakeProps<DictionaryEntities.Dictionary, 'dictionary'>): DictionaryEntities.Dictionary => {
    return {
      dictionary: params.dictionary,
      name: params.name ?? `Dictionary ${params.dictionary}`,
      options: params.options ?? []
    }
  },
  Option(params: MakeProps<DictionaryEntities.Option, 'value' | 'dictionary'>): DictionaryEntities.Option {
    return {
      value: params.value,
      title: params.title ?? `Option ${params.value}`,
      dictionary: params.dictionary
    }
  },
  Role(params: MakeProps<RoleEntities.Role, 'value'>): RoleEntities.Role {
    return {
      value: params.value,
      title: params.title ?? `Role ${params.value}`,
      createdAt: params.createdAt ?? 1
    }
  },
  Scan: (params: MakeProps<WorkerEntities.Scan, 'scanId'>): WorkerEntities.Scan => {
    return {
      scanId: params.scanId,
      name: params.name ?? `Scan ${params.scanId}`,
      createdAt: params.createdAt ?? 0,
      file: params.file ?? { stage: 'empthy' }
    }
  },
  BankCard: (params: MakeProps<WorkerEntities.BankCard, 'cardId'>): WorkerEntities.BankCard => {
    return {
      cardId: params.cardId,
      bank_name: params.bank_name ?? `Card ${params.cardId}`,
      bank_card_number: params.bank_card_number ?? '',
      comment: params.comment ?? '',
      createdAt: params.createdAt ?? 0,
      is_default_card: params.is_default_card ?? false,
      image: params.image ?? { stage: 'empthy' }
    }
  },
  BankDetail: (params: MakeProps<WorkerEntities.BankDetail, 'detailId'>): WorkerEntities.BankDetail => {
    return {
      detailId: params.detailId,
      recipient_count: params.recipient_count ?? '',
      recipient_name:  params.recipient_name ?? '',
      bik: params.bik ?? '',
      kor: params.kor ?? '',
      kpp: params.kpp ?? '',
      inn: params.inn ?? '',
      createdAt:  params.createdAt ?? 0,
      bank_name: params.bank_name ?? `Detail ${params.detailId}`
    }
  },
  Revisor: (params: MakeProps<WorkerNestedProps<WorkerEntities.RevisorProfile>, 'workerId'>): WorkerEntities.RevisorProfile => {
    return {
      workerId: params.workerId,
      type: 'revisor',
      revisor_role: params.revisor_role ?? 'commmon',
      seats: params.seats ?? [],
      job_type: params.job_type ?? 'not_self_employed',
      email: params.email ?? `revisor-${params.workerId}@mail.ru`,
      name: params.name ?? `Revisor ${params.workerId}`,
      sex: params.sex ?? 'male',
      avatar: params.avatar ?? { stage: 'empthy' },
      bank_cards: params.bank_cards ?? [],
      bank_details: params.bank_details ?? [],
      scans: params.scans ?? [],
      createdAt: params.createdAt ?? 0,
      patronymic: params.patronymic ?? '',
      status: params.status ?? 'working', 
      surname: params.surname ?? '',
      tgid: params.tgid ?? null,
      date_employ: params.date_employ ?? { day: 1, year: 1, month: 1 },
      password: params.password ?? '',
      about: {
        clothing_size: params.about?.clothing_size ?? '',
        employments: params.about?.employments ?? [],
        height: params.about?.height ?? 1,
        kind_of_work: params.about?.kind_of_work ?? [],
        regions: params.about?.regions ?? [],
        shoe_size: params.about?.shoe_size ?? ''
      },
      documents: {
        passport_issued_date: params.documents?.passport_issued_date ?? {
          day: 1,
          month: 1,
          year: 2000
        },
        passport_issued_by:  params.documents?.passport_issued_by ?? '',
        passport_serial: params.documents?.passport_serial ?? '',
        inn: params.documents?.inn ?? '',
        place_of_birth: params.documents?.place_of_birth ?? '',
        registration_place: params.documents?.registration_place ?? '',
        citizenship: params.documents?.citizenship ?? 'Rossiya',
        snils: params.documents?.snils ?? '',
        passport_number: params.documents?.passport_number ?? ''
      },
      contacts: {
        phone_extra: params.contacts?.phone_extra ?? '',
        phone_extra_verified: params.contacts?.phone_extra_verified ??  false,
        whatsapp_phone: params.contacts?.whatsapp_phone ??  '',
        whatsapp_verified: params.contacts?.whatsapp_verified ??  false,
        telegram_nickname: params.contacts?.telegram_nickname ??  '',
        telegram_phone: params.contacts?.telegram_phone ??  '',
        telegram_phone_verified: params.contacts?.telegram_phone_verified ??  false,
        viber_phone: params.contacts?.viber_phone ??  '',
        viber_verified: params.contacts?.viber_verified ??  false,
        phone_base: params.contacts?.phone_base ?? '',
        phone_base_verified: params.contacts?.phone_base_verified ?? false,
        film: {
          anime: params.contacts?.film?.anime ?? '',
          isTheater: params.contacts?.film?.isTheater ?? false,
          actors: params.contacts?.film?.actors ?? []
        }
      },
      date_birth: params.date_birth ?? { day: 1, month: 1, year: 2000 }
    }
  },
  Office: (params: MakeProps<WorkerNestedProps<WorkerEntities.OfficeProfile>, 'workerId'>): WorkerEntities.OfficeProfile => {
    return {
      workerId: params.workerId,
      type: 'office',
      password: params.password ?? `pass-${params.workerId}`,
      roles: params.roles ?? [],
      email: params.email ?? `office-${params.workerId}@mail.ru`,
      name: params.name ?? `Office ${params.workerId}`,
      sex: params.sex ?? 'male',
      avatar: params.avatar ?? { stage: 'empthy' },
      bank_cards: params.bank_cards ?? [],
      bank_details: params.bank_details ?? [],
      scans: params.scans ?? [],
      createdAt: params.createdAt ?? 0,
      patronymic: params.patronymic ?? '',
      status: params.status ?? 'working', 
      surname: params.surname ?? '',
      tgid: params.tgid ?? null,
      date_employ: params.date_employ ?? { day: 1, year: 1, month: 1 },
      about: {
        clothing_size: params.about?.clothing_size ?? '',
        employments: params.about?.employments ?? [],
        height: params.about?.height ?? 1,
        kind_of_work: params.about?.kind_of_work ?? [],
        regions: params.about?.regions ?? [],
        shoe_size: params.about?.shoe_size ?? ''
      },
      documents: {
        passport_issued_date: params.documents?.passport_issued_date ?? {
          day: 1,
          month: 1,
          year: 2000
        },
        passport_issued_by:  params.documents?.passport_issued_by ?? '',
        passport_serial: params.documents?.passport_serial ?? '',
        inn: params.documents?.inn ?? '',
        place_of_birth: params.documents?.place_of_birth ?? '',
        registration_place: params.documents?.registration_place ?? '',
        citizenship: params.documents?.citizenship ?? 'Rossiya',
        snils: params.documents?.snils ?? '',
        passport_number: params.documents?.passport_number ?? ''
      },
      contacts: {
        phone_extra: params.contacts?.phone_extra ?? '',
        phone_extra_verified: params.contacts?.phone_extra_verified ??  false,
        whatsapp_phone: params.contacts?.whatsapp_phone ??  '',
        whatsapp_verified: params.contacts?.whatsapp_verified ??  false,
        telegram_nickname: params.contacts?.telegram_nickname ??  '',
        telegram_phone: params.contacts?.telegram_phone ??  '',
        telegram_phone_verified: params.contacts?.telegram_phone_verified ??  false,
        viber_phone: params.contacts?.viber_phone ??  '',
        viber_verified: params.contacts?.viber_verified ??  false,
        phone_base: params.contacts?.phone_base ?? '',
        phone_base_verified: params.contacts?.phone_base_verified ?? false,
        film: {
          anime: params.contacts?.film?.anime ?? '',
          isTheater: params.contacts?.film?.isTheater ?? false,
          actors: params.contacts?.film?.actors ?? []
        }
      },
      date_birth: params.date_birth ?? { day: 1, month: 1, year: 2000 }
    }
  },
  Legal: ({ legalId, ...params}: MakeProps<ClientEntities.Legal, 'legalId'>): ClientEntities.Legal => {
    return {
      legalId,
      name: params.name ?? `Legal ${legalId}`,
      full_name: params.full_name ?? `Legal ${legalId} LLC`,
      inn: params.inn ?? `${legalId}-inn`,
      kpp: params.kpp ?? `${legalId}-kpp`,
      ogrn: params.ogrn ?? `${legalId}-ogrn`,
      rs: params.rs ?? `${legalId}-rs`,
      kors: params.kors ?? `${legalId}-kors`,
      bik: params.bik ?? `${legalId}-bik`,
      bank_name: params.bank_name ?? `Bank ${legalId}`,
      legal_address: params.legal_address ?? `Legal address ${legalId}`,
      fact_address: params.fact_address ?? `Fact address ${legalId}`,
      phone: params.phone ?? '+70000000000',
      email: params.email ?? `${legalId}@mail.ru`
    }
  },
  Location: (params: MakeProps<ClientEntities.Location, 'legalId' | 'location_type' | 'value_type' | 'locationId'>): ClientEntities.Location => {
    return {
      locationId: params.locationId,
      legalId: params.legalId,
      name: params.name ?? `Location ${params.locationId}`,
      address: params.address ?? `Address ${params.locationId}`,
      comment: params.comment ?? '',
      location_type: params.location_type,
      value_type: params.value_type
    }
  },
  Contact: ({ contactId, ...params}: MakeProps<ClientEntities.Contact, 'contactId'>): ClientEntities.Contact => {
    return {
      contactId,
      name: params.name ?? `Name ${contactId}`,
      surname: params.surname ?? `Surname ${contactId}`,
      patronymic: params.patronymic ?? `Patronymic ${contactId}`,
      phone: params.phone ?? '+71111111111',
      email: params.email ?? `${contactId}@mail.ru`,
      rolename: params.rolename ?? 'manager',
      locations: params.locations ?? []
    }
  },
  Client: ({ clientId, ...params }: MakeProps<ClientEntities.Client, 'managerId' | 'clientId'>): ClientEntities.Client => {
    return {
      clientId,
      companyname: params.companyname ?? `Client ${clientId}`,
      comment: params.comment ?? '',
      logo: params.logo ?? { stage: 'empthy' },
      managerId: params.managerId,
      subManagerId: params.subManagerId ?? null,
      createdAt: params.createdAt ?? 1,
      legals: params.legals ?? [],
      locations: params.locations ?? [],
      contacts: params.contacts ?? [],
      projects: params.projects ?? []
    }
  },
  Project: (params: MakeProps<ProjectEntities.Project, 'clientId' | 'curatorId' | 'managerId' | 'projectId'>): ProjectEntities.Project => {
    return {
      projectId: params.projectId,
      name: params.name ?? `Project ${params.projectId}`,
      price: params.price ?? 1000,
      clientId: params.clientId,
      locationsIds: params.locationsIds ?? [],
      curatorId: params.curatorId,
      managerId: params.managerId,
      type_of_works: params.type_of_works ?? [],
      startDate: params.startDate ?? { day: 1, month: 1, year: 2025 },
      endDate: params.endDate ?? { day: 2, month: 1, year: 2025 },
      valuesToCount: params.valuesToCount ?? 10
    }
  },
  Shift: (params: MakeProps<ShiftEntities.Shift, 'locationId' | 'projectId' | 'chatId' | 'shiftId'>): ShiftEntities.Shift => {
    return {
      shiftId: params.shiftId,
      projectId: params.projectId,
      locationId: params.locationId,
      revisorRate: params.revisorRate ?? 100,
      revisorsCount: params.revisorsCount ?? 1,
      comment: params.comment ?? '',
      adname: params.adname ?? `Shift ${params.shiftId}`,
      stage: params.stage ?? { type: 'recruiting' },
      extra_rates: params.extra_rates ?? [],
      equipments: params.equipments ?? [],
      type_of_work: params.type_of_work ?? [],
      date: params.date ?? { day: 1, month: 1, year: 2025 },
      startTime: params.startTime ?? { hours: 9, minutes: 0 },
      endTime: params.endTime ?? { hours: 18, minutes: 0 },
      typeOfShift: params.typeOfShift ?? 'day',
      logs: params.logs ?? [],
      isAttendanceCommited: params.isAttendanceCommited ?? false,
      enabledRevisorRoles: params.enabledRevisorRoles ?? ['commmon'],
      seats: params.seats ?? [],
      chatId: params.chatId
    }
  },
  Seat: (params: MakeProps<ShiftEntities.Seat, 'revisorId' | 'shiftId' | 'chatId' | 'seatId'>): ShiftEntities.Seat => {
    return {
      seatId: params.seatId,
      assignTime: params.assignTime ?? 1,
      revisorId: params.revisorId,
      shiftId: params.shiftId,
      chatId: params.chatId,
      subManagerId: params.subManagerId ?? null,
      paid: params.paid ?? null,
      status: params.status ?? 'reserve',
      confirmed: params.confirmed ?? null,
      attendance: params.attendance ?? null
    }
  },
  NoteChat: (params: MakeProps<ChatEntities.NoteChat, 'shiftId' | 'chatId'>): ChatEntities.NoteChat => {
    return {
      chatId: params.chatId,
      type: 'notechat',
      unreadCount: params.unreadCount ?? 0,
      lastReadCmid: params.lastReadCmid ?? 0,
      lastMessage: params.lastMessage ?? null,
      lastCmid: params.lastCmid ?? 0,
      messages: params.messages ?? [],
      shiftId: params.shiftId
    }
  },
  SeatChat: (params: MakeProps<ChatEntities.SeatChat, 'seatId' | 'chatId'>): ChatEntities.SeatChat => {
    return {
      chatId: params.chatId,
      type: 'seatchat',
      unreadCount: params.unreadCount ?? 0,
      lastReadCmid: params.lastReadCmid ?? 0,
      lastMessage: params.lastMessage ?? null,
      lastCmid: params.lastCmid ?? 0,
      messages: params.messages ?? [],
      seatId: params.seatId
    }
  }
}
