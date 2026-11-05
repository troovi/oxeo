import { createCase } from '../../tools'
import { mock } from '../../..'

export const caseEMI = createCase('#EMI - RefernceSet clear links', {
  execute: async (kit, dataSource) => {
    await kit.addScan({ scanId: 'scan-1' })

    await kit.addRevisorWorker({
      workerId: 35,
      scans: ['scan-1'] // ReferenceSet
    })

    await dataSource.collections.worker.update(35, (w) => {
      w.scans = []
    })
  },
  expectations: {
    tables: {},
    scheme: {
      scan: [mock.Scan({ scanId: 'scan-1' })],
      worker: [mock.Revisor({ workerId: 35, scans: [] })]
    }
  }
})
