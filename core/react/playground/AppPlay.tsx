import { useState } from 'react'
import { RolesTab } from './Tabs/Roles'
import { FieldTrackingDemo } from './Tabs/Fields'
import { ProjectsSection } from './Tabs/Projects'
import { WorkersList } from './Tabs/Workers'
import { ShiftsSection } from './Tabs/Shifts'
import { Stats } from './Tabs/Stats'
import { EntitiesDemo } from './Tabs/Entities'
import { FieldAndCountDemo } from './Tabs/FieldAndCount'

export const AppPlay = () => {
  const [tab, setTab] = useState<
    'roles' | 'fields' | 'projects' | 'workers' | 'shifts' | 'stats' | 'entities' | 'field+count'
  >('field+count')

  return (
    <div style={{ fontFamily: 'system-ui', padding: 16, maxWidth: 720 }}>
      <h2>xeo-react playground</h2>

      <nav style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(
          [
            'roles',
            'fields',
            'projects',
            'workers',
            'shifts',
            'stats',
            'entities',
            'field+count'
          ] as const
        ).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ fontWeight: tab === t ? 700 : 400 }}>
            {t}
          </button>
        ))}
      </nav>
      {tab === 'roles' && <RolesTab />}
      {tab === 'fields' && <FieldTrackingDemo />}
      {tab === 'projects' && <ProjectsSection />}
      {tab === 'workers' && <WorkersList />}
      {tab === 'shifts' && <ShiftsSection />}
      {tab === 'stats' && <Stats />}
      {tab === 'entities' && <EntitiesDemo />}
      {tab === 'field+count' && <FieldAndCountDemo />}
    </div>
  )
}
