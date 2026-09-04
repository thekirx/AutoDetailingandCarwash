import { CalendarPlus, Home, MoreHorizontal, Newspaper, Radio } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { getCustomerAccountTabs } from '@/lib/customerAccountNav'

const ICONS = {
  home: Home,
  book: CalendarPlus,
  queue: Radio,
  blog: Newspaper,
  more: MoreHorizontal,
}

/** Floating island dock on phones, inline tab row on desktop. Same five tabs everywhere. */
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
            className={({ isActive }) => `capp-dock-item${isActive ? ' capp-dock-item-primary' : ''}`}
          >
            <Icon className="capp-dock-icon" strokeWidth={1.75} aria-hidden />
            <span>{tab.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
