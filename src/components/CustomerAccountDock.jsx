import { CalendarDays, Home, Newspaper, Radio } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { getCustomerAccountTabs } from '@/lib/customerAccountNav'

const ICONS = {
  home: Home,
  blog: Newspaper,
  events: CalendarDays,
  queue: Radio,
}

/** Floating island dock. Same four tabs on every customer app screen. */
export default function CustomerAccountDock() {
  const tabs = getCustomerAccountTabs()

  return (
    <nav className="account-dock capp-dock" aria-label="Account">
      {tabs.map((tab) => {
        const Icon = ICONS[tab.id]
        return (
          <NavLink
            key={tab.id}
            to={tab.to}
            end={Boolean(tab.end)}
            className={({ isActive }) =>
              `account-dock-item${isActive ? ' account-dock-item-primary' : ''}`
            }
          >
            <Icon className="account-dock-icon" strokeWidth={1.75} aria-hidden />
            <span>{tab.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
