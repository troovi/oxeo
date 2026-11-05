// ---------------------------------------------------------------------------
// useEntities — subscribe to a specific subset of ids, field-level tracking
// ---------------------------------------------------------------------------

import { useState } from 'react'
import { generateCode } from '@companix/utils-js'
import { mock } from '@companix/xeo-devkit'
import { useEntities, useMutations } from '../dataSource'
import { Renders, useRenderCount } from '../use-render-count'

let workerCounter = 100

export const EntitiesDemo = () => {
  const [ids, setIds] = useState<number[]>([1, 2, 3])
  const renders = useRenderCount()
  const workers = useEntities('worker', ids)
  const { create, update, remove } = useMutations('worker')

  const addWorker = () => {
    const id = ++workerCounter
    create(mock.Office({ workerId: id, name: `Office ${id}`, email: `office${id}@test.ru` }))
    setIds((prev) => [...prev, id])
  }

  const toggleId = (id: number) => {
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <section>
      <h3>
        useEntities — watching {ids.length} ids <Renders count={renders} />
      </h3>
      <p style={{ fontSize: 11, color: '#888', margin: '4px 0' }}>
        Only re-renders when a tracked field changes on one of the watched ids. Create/remove events
        outside the id set are ignored.
      </p>

      <div style={{ marginBottom: 8 }}>
        <b style={{ fontSize: 12 }}>Tracked ids:</b>{' '}
        {ids.map((id) => (
          <span
            key={id}
            onClick={() => toggleId(id)}
            style={{
              display: 'inline-block',
              margin: '0 3px',
              padding: '1px 6px',
              background: '#d0eaff',
              borderRadius: 3,
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            #{id} ✕
          </span>
        ))}
      </div>

      <ul style={{ paddingLeft: 16 }}>
        {workers.map((w) => (
          <li key={w.workerId} style={{ marginBottom: 6 }}>
            <span
              style={{
                fontSize: 11,
                background: w.type === 'office' ? '#ddf' : '#dfd',
                padding: '1px 4px',
                borderRadius: 3
              }}
            >
              {w.type}
            </span>{' '}
            <b>{w.name}</b> — {w.email}{' '}
            <span style={{ fontSize: 11, color: w.status === 'working' ? 'green' : '#aaa' }}>
              {w.status}
            </span>
            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
              <button
                onClick={() =>
                  update(w.workerId, (d) => {
                    d.name = `${w.name.split('~')[0]}~${generateCode(3)}`
                  })
                }
              >
                Rename
              </button>
              <button
                onClick={() =>
                  update(w.workerId, (d) => {
                    d.status = d.status === 'working' ? 'fired' : 'working'
                  })
                }
              >
                Toggle status
              </button>
              <button
                onClick={() => {
                  remove(w.workerId)
                  toggleId(w.workerId)
                }}
              >
                Remove
              </button>
            </div>
          </li>
        ))}

        {ids.length > 0 && workers.length === 0 && (
          <li style={{ color: '#aaa', fontSize: 12 }}>No entities found for selected ids.</li>
        )}
      </ul>

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={addWorker}>+ Add &amp; track new worker</button>
        <button onClick={() => toggleId(1)}>Toggle id #1</button>
        <button onClick={() => toggleId(2)}>Toggle id #2</button>
      </div>
    </section>
  )
}
