// ---------------------------------------------------------------------------
// 1. getAll + create/remove — list-level reactivity
// ---------------------------------------------------------------------------

import { mock } from '@companix/xeo-devkit'
import { useAll, useEntity, useMutations } from '../dataSource'
import { Renders, useRenderCount } from '../use-render-count'
import { generateCode } from '@companix/utils-js'

let roleCounter = 10

const RolesList = () => {
  const renders = useRenderCount()
  const roles = useAll('role')

  const { create } = useMutations('role')

  const addRole = async () => {
    const value = `role-${++roleCounter}`
    await create(mock.Role({ value }))
  }

  return (
    <section>
      <h3>
        Roles ({roles.length}) <Renders count={renders} />
      </h3>
      <ul>
        {roles.map((role) => (
          <RoleItem key={role.value} value={role.value} />
        ))}
      </ul>
      <button onClick={addRole}>+ Add Role</button>
    </section>
  )
}

const RolesNamesList = () => {
  const renders = useRenderCount()
  const roles = useAll('role')

  return (
    <section>
      <h3>
        Roles Names ({roles.length}) <Renders count={renders} />
      </h3>
      <ul>
        {roles.map((role) => (
          <div key={role.value}>{role.title}</div>
        ))}
      </ul>
    </section>
  )
}

interface RoleItemProps {
  value: string
}

const RoleItem = ({ value }: RoleItemProps) => {
  const renders = useRenderCount()
  const role = useEntity('role', value)
  const { update, remove } = useMutations('role')

  if (!role) return null

  const updateTitle = () => {
    update(value, (draft) => {
      const [title] = role.title.split(' ')
      draft.title = `${title} (${generateCode(4)})`
    })
  }

  const removeRole = async () => {
    await remove(value)
  }

  return (
    <li>
      {role.title} <Renders count={renders} /> <button onClick={updateTitle}>Edit</button>
      <button onClick={removeRole}>Remove</button>
    </li>
  )
}

export const RolesTab = () => {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <RolesList />
      <RolesNamesList />
    </div>
  )
}
