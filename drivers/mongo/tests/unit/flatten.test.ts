import { buildFlattenMap } from '../../lib/utils/flatten'

console.log(
  buildFlattenMap({
    workerId: 3,
    type: 'office',
    tgid: null,
    createdAt: 1710000000,
    avatar: {
      name: 'avatar.png',
      url: 'https://example.com/avatar.png',
      size: 12345,
      type: 'image/png'
    },
    skills: ['skill1', 'skill2'],
    payments: ['cash', 'bank_card'],
    name: 'Ivan',
    surname: 'Ivanov',
    patronymic: 'Ivanovich',
    email: 'ivan@example.com',
    sex: 'male',
    status: 'working',
    date_birth: { year: 1990, month: 1, day: 15 },
    date_employ: { year: 2024, month: 3, day: 1 },
    contacts: {
      phone_base: '+79990000000',
      phone_base_verified: false,
      phone_extra: '+79990000001',
      phone_extra_verified: false,
      whatsapp_phone: '+79990000000',
      whatsapp_verified: false,
      viber_phone: '+79990000000',
      viber_verified: false,
      telegram_nickname: '@ivanov',
      telegram_phone: '+79990000000',
      telegram_phone_verified: false,
      film: {
        anime: 'naruto',
        isTheater: false,
        actors: []
      }
    },
    documents: {
      citizenship: null,
      passport_number: '123456',
      passport_serial: '1111',
      passport_issued_by: 'MVD',
      passport_issued_date: { year: 2010, month: 5, day: 20 },
      place_of_birth: 'Moscow',
      registration_place: 'Moscow',
      inn: '7700000000',
      snils: '123-456-789 00'
    },
    about: {
      height: 180,
      shoe_size: '42',
      clothing_size: 'L',
      regions: [],
      kind_of_work: [],
      employments: []
    },
    scans: [],
    bank_cards: [],
    bank_details: [],
    password: 'P@ssw0rd',
    roles: []
  })
)
