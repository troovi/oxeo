// ---------------------------------------------------------------------------
// useField — single scalar field, re-renders only when that field changes
// useCountBy — filtered count, re-renders on any event that could change result
// ---------------------------------------------------------------------------

import { useField, useMutations, useAll } from '../dataSource'
import { Renders, useRenderCount } from '../use-render-count'

// ---------------------------------------------------------------------------
// useField demo — each cell subscribes to exactly one field of one worker
// ---------------------------------------------------------------------------

const WorkerName = ({ workerId }: { workerId: number }) => {
  const renders = useRenderCount()
  const name = useField('worker', workerId, 'name')
  return (
    <td>
      {name ?? '—'} <Renders count={renders} />
    </td>
  )
}

const WorkerStatus = ({ workerId }: { workerId: number }) => {
  const renders = useRenderCount()
  const status = useField('worker', workerId, 'status')
  return (
    <td style={{ color: status === 'working' ? 'green' : '#aaa' }}>
      {status ?? '—'} <Renders count={renders} />
    </td>
  )
}

const WorkerEmail = ({ workerId }: { workerId: number }) => {
  const renders = useRenderCount()
  const email = useField('worker', workerId, 'email')
  return (
    <td>
      {email ?? '—'} <Renders count={renders} />
    </td>
  )
}

const UseFieldDemo = () => {
  const workers = useAll('worker')
  const { update } = useMutations('worker')

  return (
    <div>
      <h4 style={{ margin: '0 0 4px' }}>useField</h4>
      <p style={{ fontSize: 11, color: '#888', margin: '0 0 8px' }}>
        Each cell is its own hook — updating name only re-renders the name cell.
      </p>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            {['id', 'name', 'status', 'email', 'actions'].map((h) => (
              <th
                key={h}
                style={{ textAlign: 'left', padding: '2px 6px', borderBottom: '1px solid #ddd' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {workers.map((w) => (
            <tr key={w.workerId}>
              <td style={{ padding: '2px 6px', color: '#888' }}>#{w.workerId}</td>
              <WorkerName workerId={w.workerId} />
              <WorkerStatus workerId={w.workerId} />
              <WorkerEmail workerId={w.workerId} />
              <td style={{ padding: '2px 6px' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    style={{ fontSize: 11 }}
                    onClick={() =>
                      update(w.workerId, (d) => {
                        d.name = `${d.name.split('~')[0]}~${Math.random().toString(36).slice(2, 5)}`
                      })
                    }
                  >
                    Rename
                  </button>
                  <button
                    style={{ fontSize: 11 }}
                    onClick={() =>
                      update(w.workerId, (d) => {
                        d.status = d.status === 'working' ? 'fired' : 'working'
                      })
                    }
                  >
                    Status
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Combined tab
// ---------------------------------------------------------------------------

export const FieldAndCountDemo = () => (
  <section>
    <h3>useField &amp; useCountBy</h3>
    <UseFieldDemo />
  </section>
)
