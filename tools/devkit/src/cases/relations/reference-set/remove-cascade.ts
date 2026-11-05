import { createCase, createTableTest } from '../../tools'
import { mock } from '../../..'

export const caseJXI = createCase('#JXI - ReferenceSet cascade cleanup', {
  execute: async (kit, dataSource) => {
    // create options
    await kit.addScan({ scanId: 'scan-1' })
    await kit.addBankCard({ cardId: 'bank-card-1' })
    await kit.addBankDetail({ detailId: 'bank-detail-1' })
    // add worker
    await kit.addRevisorWorker({
      workerId: 1,
      scans: ['scan-1'], // ReferenceSet
      bank_cards: ['bank-card-1'], // ReferenceSet
      bank_details: ['bank-detail-1'] // ReferenceSet
    })
    // remove worker
    await dataSource.collections.worker.remove(1)
  },
  expectations: {
    tables: {},
    scheme: {}
  }
})

export const caseISX = createCase('#ISX - ReferenceSet cascade cleanup (expect one entity)', {
  execute: async (kit, dataSource) => {
    await kit.addScan({ scanId: 'scan-1' })
    await kit.addBankCard({ cardId: 'bank-card-1' })
    await kit.addBankDetail({ detailId: 'bank-detail-1' })
    await kit.addBankDetail({ detailId: 'bank-detail-2' })
    // add worker
    await kit.addRevisorWorker({
      workerId: 1,
      scans: ['scan-1'], // ReferenceSet
      bank_cards: ['bank-card-1'], // ReferenceSet
      bank_details: ['bank-detail-1', 'bank-detail-2'] // ReferenceSet
    })

    await dataSource.collections.scan.remove('scan-1')
    await dataSource.collections.bankCard.remove('bank-card-1')
    await dataSource.collections.bankDetail.remove('bank-detail-1')
  },
  expectations: {
    tables: {
      ...createTableTest('worker', {
        column: (source) => source.commonRefs.bank_details,
        rows: [{ worker: 1, bankDetail: 'bank-detail-2' }]
      })
    },
    scheme: {
      bankDetail: [mock.BankDetail({ detailId: 'bank-detail-2' })],
      worker: [
        mock.Revisor({
          workerId: 1,
          scans: [],
          bank_cards: [],
          bank_details: ['bank-detail-2']
        })
      ]
    }
  }
})
