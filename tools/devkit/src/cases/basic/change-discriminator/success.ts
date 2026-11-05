import { createCase, createTableTest } from '../../tools'
import { mock } from '../../..'

// office → revisor: variant-связь старой формы (roles) ЧИСТИТСЯ, общая связь (about.regions)
// СОХРАНЯЕТСЯ, у новой формы появляется has-many seats (пустой), скаляры старой формы исчезают,
// общие поля (name/email) переносятся как есть
export const caseCDA = createCase('#CDA - changeDiscriminator office → revisor', {
  execute: async (kit, dataSource) => {
    await kit.addDictionary({ dictionary: 'regions' })
    await kit.addOption({ value: 'option-1', dictionary: 'regions' })
    await kit.addRole({ value: 'role-1' })

    await kit.addOfficeWorker({
      workerId: 1,
      name: 'Common Name',
      email: 'common@mail.ru',
      roles: ['role-1'], // variant-связь office (будет снесена)
      about: { regions: ['option-1'] } // общая связь (сохранится)
    })

    await dataSource.collections.worker.changeDiscriminator(1, 'revisor', {
      password: 'rev-pass',
      revisor_role: 'senior',
      job_type: 'self_employed',
      seats: []
    })
  },
  expectations: {
    tables: {
      // общая связь сохранена, roles-таблица не указана → ожидается пустой
      ...createTableTest('worker', {
        column: (source) => source.commonRefs['about.regions'],
        rows: [{ worker: 1, options: 'option-1' }]
      })
    },
    scheme: {
      dictionaries: [mock.Dictionary({ dictionary: 'regions', options: ['option-1'] })],
      options: [mock.Option({ value: 'option-1', dictionary: 'regions' })],
      role: [mock.Role({ value: 'role-1' })],
      worker: [
        mock.Revisor({
          workerId: 1,
          name: 'Common Name',
          email: 'common@mail.ru',
          password: 'rev-pass',
          revisor_role: 'senior',
          job_type: 'self_employed',
          seats: [],
          about: { regions: ['option-1'] }
        })
      ]
    }
  }
})
