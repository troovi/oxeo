// ---------------------------------------------------------------------------
// 4. Workers — discriminated models, create/remove/update
// ---------------------------------------------------------------------------

import { generateCode } from '@companix/utils-js'
import { mock } from '@companix/xeo-devkit'
import { useAll, useEntity, useMutations } from '../dataSource'
import { Renders, useRenderCount } from '../use-render-count'

let workerCounter = 4

export const WorkersList = () => {
  const renders = useRenderCount()
  const workers = useAll('worker')
  const { create } = useMutations('worker')

  const addOffice = () => {
    const id = ++workerCounter

    create(
      mock.Office({
        workerId: id,
        name: `Office ${id}`,
        surname: `S${id}`,
        email: `office${id}@test.ru`
      })
    )
  }

  const addRevisor = () => {
    const id = ++workerCounter

    create(
      mock.Revisor({
        workerId: id,
        name: `Revisor ${id}`,
        surname: `S${id}`,
        email: `revisor${id}@test.ru`
      })
    )
  }

  return (
    <section>
      <h3>
        Workers ({workers.length}) <Renders count={renders} />
      </h3>
      <p style={{ fontSize: 11, color: '#888', margin: '4px 0' }}>
        useAll tracks workerId only — field updates dont rerender the list.
      </p>
      <ul style={{ paddingLeft: 16 }}>
        {workers.map((w) => (
          <WorkerItem key={w.workerId} workerId={w.workerId} />
        ))}
      </ul>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={addOffice}>+ Office</button>
        <button onClick={addRevisor}>+ Revisor</button>
      </div>
    </section>
  )
}

const WorkerItem = ({ workerId }: { workerId: number }) => {
  const renders = useRenderCount()
  const worker = useEntity('worker', workerId)
  const { update, remove } = useMutations('worker')

  if (!worker) {
    return null
  }

  const rename = () => {
    update(workerId, (draft) => {
      draft.name = `${worker.name.split('~')[0]}~${generateCode(3)}`
    })
  }

  const toggleStatus = () => {
    update(workerId, (draft) => {
      draft.status = draft.status === 'working' ? 'fired' : 'working'
    })
  }

  return (
    <li style={{ marginBottom: 6 }}>
      <span
        style={{
          fontSize: 11,
          background: worker.type === 'office' ? '#ddf' : '#dfd',
          padding: '1px 4px',
          borderRadius: 3
        }}
      >
        {worker.type}
      </span>{' '}
      <b>{worker.name}</b> {worker.surname} — {worker.email}{' '}
      <span style={{ fontSize: 11, color: worker.status === 'working' ? 'green' : '#aaa' }}>
        {worker.status}
      </span>{' '}
      <Renders count={renders} />
      <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
        <button onClick={rename}>Rename</button>
        <button onClick={toggleStatus}>Toggle status</button>
        <button onClick={() => remove(workerId)}>Remove</button>
      </div>
    </li>
  )
}
