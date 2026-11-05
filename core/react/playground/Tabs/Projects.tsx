import { mock } from '@companix/xeo-devkit'
import { useAll, useEntity, useMutations } from '../dataSource'
import { Renders, useRenderCount } from '../use-render-count'

let projectCounter = 1002

const ProjectsList = () => {
  const renders = useRenderCount()
  const projects = useAll('project')
  const { create } = useMutations('project')

  const addProject = () => {
    const id = ++projectCounter
    create(
      mock.Project({
        projectId: id,
        clientId: id % 2 === 0 ? 102 : 101,
        curatorId: 2,
        managerId: id % 2 === 0 ? 2 : 1
      })
    )
  }

  return (
    <div style={{ flex: 1 }}>
      <h4>
        useAll (list) <Renders count={renders} />
      </h4>
      <p style={{ fontSize: 11, color: '#888', margin: '4px 0' }}>
        Accesses only projectId — no rerender on field updates.
      </p>
      <ul style={{ paddingLeft: 16 }}>
        {projects.map((p) => (
          <ProjectItem key={p.projectId} projectId={p.projectId} />
        ))}
      </ul>
      <button onClick={addProject}>+ Add Project</button>
    </div>
  )
}

interface ProjectItemProps {
  projectId: number
}

const ProjectItem = ({ projectId }: ProjectItemProps) => {
  const renders = useRenderCount()
  const project = useEntity('project', projectId)
  const { update, remove } = useMutations('project')

  if (!project) return null

  const rename = () =>
    update(projectId, (d) => {
      d.name = `Project ${Date.now() % 10000}`
    })
  const changePrice = () =>
    update(projectId, (d) => {
      d.price = Math.floor(10000 + Math.random() * 90000)
    })
  const swapManager = () =>
    update(projectId, (d) => {
      d.managerId = d.managerId === 1 ? 2 : 1
    })

  return (
    <li style={{ marginBottom: 6 }}>
      <b>#{project.projectId}</b> {project.name} — {project.price.toLocaleString()}₽{' '}
      <Renders count={renders} />
      <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
        <button onClick={rename}>Rename</button>
        <button onClick={changePrice}>Price</button>
        <button onClick={swapManager}>Swap mgr</button>
        <button onClick={() => remove(projectId)}>Remove</button>
      </div>
    </li>
  )
}

const ProjectCard = ({ projectId }: { projectId: number }) => {
  const renders = useRenderCount()
  const project = useEntity('project', projectId)
  const client = useEntity('client', project?.clientId)
  const manager = useEntity('worker', project?.managerId)

  if (!project) {
    return (
      <div style={{ border: '1px solid #eee', padding: 8, marginBottom: 6, color: '#aaa' }}>
        #{projectId} removed
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid #ccc', padding: 8, marginBottom: 6 }}>
      <div>
        <b>{project.name}</b> — {project.price.toLocaleString()}₽ <Renders count={renders} />
      </div>
      <div>Client: {client?.companyname ?? '—'}</div>
      <div>
        Manager: {manager?.name ?? '—'} {manager?.surname ?? ''}
      </div>
    </div>
  )
}

const ProjectCardsList = () => {
  const projects = useAll('project')

  return (
    <div style={{ flex: 1 }}>
      <h4>useEntity per card (cross-collection)</h4>
      <p style={{ fontSize: 11, color: '#888', margin: '4px 0' }}>
        Each card re-renders only for its own changed fields.
      </p>
      {projects.map((p) => (
        <ProjectCard key={p.projectId} projectId={p.projectId} />
      ))}
    </div>
  )
}

export const ProjectsSection = () => (
  <section>
    <h3>Projects</h3>
    <div style={{ display: 'flex', gap: 16 }}>
      <ProjectsList />
      <ProjectCardsList />
    </div>
  </section>
)
