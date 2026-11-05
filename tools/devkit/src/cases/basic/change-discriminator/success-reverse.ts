import { createCase, createTableTest } from '../../tools'
import { mock } from '../../..'

// revisor → office: has-many seats старой формы пуст (зависимостей нет) → морф разрешён;
// у новой формы устанавливается variant-связь roles (валидируется + создаётся запись в таблице)
export const caseCDB = createCase('#CDB - changeDiscriminator revisor → office', {
  execute: async (kit, dataSource) => {
    await kit.addRole({ value: 'role-1' })
    await kit.addRevisorWorker({ workerId: 2, name: 'Rev Name', email: 'rev@mail.ru' })

    await dataSource.collections.worker.changeDiscriminator(2, 'office', {
      password: 'off-pass',
      roles: ['role-1']
    })
  },
  expectations: {
    tables: {
      ...createTableTest('worker', {
        column: (source) => source.discriminatorRefs!.office.roles,
        rows: [{ worker: 2, role: 'role-1' }]
      })
    },
    scheme: {
      role: [mock.Role({ value: 'role-1' })],
      worker: [
        mock.Office({
          workerId: 2,
          name: 'Rev Name',
          email: 'rev@mail.ru',
          password: 'off-pass',
          roles: ['role-1']
        })
      ]
    }
  }
})
