import { CoreError } from '@oxeo/server'
import { createCase } from '../../tools'
import { mock } from '../../..'

// целевой дискриминатор совпадает с текущим
export const caseCDS = createCase('#CDS - changeDiscriminator to the same discriminator', {
  execute: async (kit, dataSource) => {
    await kit.addOfficeWorker({ workerId: 1 })

    await dataSource.collections.worker.changeDiscriminator(1, 'office', {
      password: 'x',
      roles: []
    })
  },
  expectations: {
    tables: {},
    scheme: {
      worker: [mock.Office({ workerId: 1 })]
    },
    error: new CoreError('Worker', {
      reason: 'RELATION_RESTRICT',
      address: 'type',
      info: 'same-discriminator'
    })
  }
})

// целевой дискриминатор не объявлен в модели (обходим типы через any — проверяем рантайм-защиту)
export const caseCDK = createCase('#CDK - changeDiscriminator to unknown discriminator', {
  execute: async (kit, dataSource) => {
    await kit.addOfficeWorker({ workerId: 1 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (dataSource.collections.worker.changeDiscriminator as any)(1, 'manager', {})
  },
  expectations: {
    tables: {},
    scheme: {
      worker: [mock.Office({ workerId: 1 })]
    },
    error: new CoreError('Worker', {
      reason: 'RELATION_RESTRICT',
      address: 'type',
      info: 'unknown-discriminator'
    })
  }
})

// changeDiscriminator на недискриминированной коллекции (типы это запрещают, проверяем рантайм)
export const caseCDN = createCase('#CDN - changeDiscriminator on non-discriminated collection', {
  execute: async (_kit, dataSource) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (dataSource.collections.role as any).changeDiscriminator('role-1', 'x', {})
  },
  expectations: {
    tables: {},
    scheme: {},
    error: new CoreError('Role', {
      reason: 'RELATION_RESTRICT',
      address: '',
      info: 'not-discriminated'
    })
  }
})
