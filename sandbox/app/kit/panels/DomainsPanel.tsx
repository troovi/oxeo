import { useState } from 'react'
import { faArrowRight, faChevronRight } from '@companix/icons-solid'
import { Icon } from '@companix/uikit'
import { attr } from '@companix/utils-browser'
import { Panel } from '../components/Panel'
import { Popups } from '../popups'
import { DomainGroup } from '../types'

/**
 * Операции доменов по карте версии — плоским деревом: строка домена раскрывает его действия, строка
 * действия открывает окно с формой.
 */
export const DomainsPanel = ({ groups }: { groups: DomainGroup[] }) => {
  return (
    <Panel title="Domains Operations">
      <div className="panel-scroll domains">
        {groups.map((group) => (
          <DomainBlock key={`domain-${group.domain}`} group={group} />
        ))}
      </div>
    </Panel>
  )
}

const DomainBlock = ({ group }: { group: DomainGroup }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="domain" data-open={attr(isOpen)}>
      <button type="button" className="domain-head" onClick={() => setIsOpen(!isOpen)}>
        <Icon className="domain-chevron" icon={faChevronRight} size="xxxs" />
        <span className="domain-name">{group.domain}</span>
        <span className="domain-count">{group.actions.length}</span>
      </button>
      {isOpen && (
        <div className="domain-actions">
          {group.actions.map((action) => (
            <button
              key={`action-${group.domain}-${action.name}`}
              type="button"
              className="domain-action"
              onClick={() => Popups.Open.Operation({ domain: group.domain, action })}
            >
              <span className="domain-action-name">{action.name}</span>
              <Icon className="domain-action-icon" icon={faArrowRight} size="xxxs" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
