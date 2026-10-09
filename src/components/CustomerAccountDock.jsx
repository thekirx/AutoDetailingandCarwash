import { useSyncExternalStore } from 'react'
import { CalendarPlus, Gift, Home, Radio, UserRound } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { customerAccountTabId, getCustomerAccountTabs } from '@/lib/customerAccountNav'
import { ACTIVE_VISIT_EVENT, hasActiveVisit } from '@/lib/customerPortalClient'

const ICONS = {
  home: Home,
  queue: Radio,
  book: CalendarPlus,
  rewards: Gift,
  me: UserRound,
}

function subscribe(cb) {
  window.addEventListener(ACTIVE_VISIT_EVENT, cb)
  return () => window.removeEventListener(ACTIVE_VISIT_EVENT, cb)
}

/**
 * Floating island dock on phones, inline tab row on desktop. Same five tabs everywhere.
 * On phones a blue pill slides under the active tab; Queue carries a live dot while a car is on the floor.
 */
export default function CustomerAccountDock() {
  const tabs = getCustomerAccountTabs()
  const { pathname } = useLocation()
  const activeId = customerAccountTabId(pathname)
  const index = tabs.findIndex((t) => t.id === activeId)
  const live = useSyncExternalStore(subscribe, hasActiveVisit, () => false)

  return (
    <nav className="account-dock capp-dock" aria-label="Account">
      <span className="capp-dock-ind" aria-hidden style={{ '--i': Math.max(index, 0), opacity: index < 0 ? 0 : 1 }} />
      {tabs.map((tab) => {
        const Icon = ICONS[tab.id]
        const on = tab.id === activeId
        return (
          <NavLink
            key={tab.id}
            to={tab.to}
            end={Boolean(tab.end)}
            aria-current={on ? 'page' : undefined}
            className={`capp-dock-item${on ? ' capp-dock-item-primary' : ''}`}
          >
            <Icon className="capp-dock-icon" strokeWidth={on ? 2.2 : 1.75} aria-hidden />
            <span>{tab.label}</span>
            {tab.id === 'queue' && live ? <i className="capp-dock-live" aria-label="Your car is on the floor" /> : null}
          </NavLink>
        )
      })}
    </nav>
  )
}
