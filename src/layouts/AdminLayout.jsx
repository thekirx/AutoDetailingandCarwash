import { CalendarDays, ChartNoAxesCombined, Gauge, Menu, ListOrdered, Users, X, LogOut, CarFront, Settings } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import UserSettingsModal from '@/components/UserSettingsModal'

const navigation = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: Gauge },
  { label: 'Bookings', to: '/admin/bookings', icon: CalendarDays },
  { label: 'Queue', to: '/operations/queue', icon: ListOrdered },
  { label: 'Customers', to: '/admin/customers', icon: Users },
  { label: 'Reports', to: '/operations/reports', icon: ChartNoAxesCombined },
]

export default function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { profile, user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-card transition-transform lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><CarFront size={22} /></div>
            <div><p className="font-semibold tracking-wide">HAKUM</p><p className="text-[10px] tracking-[0.28em] text-muted-foreground">AUTO CARE</p></div>
          </div>
          <button className="text-muted-foreground lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X /></button>
        </div>

        <nav className="flex-1 space-y-1 px-4 py-6" aria-label="Staff navigation">
          {navigation.map(({ label, to, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${isActive ? 'bg-primary text-primary-foreground shadow-[0_8px_30px_rgba(5,38,153,.22)]' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <Icon size={19} />{label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          <div className="mb-3 px-3"><p className="truncate text-sm font-medium">{profile?.full_name || 'Staff Member'}</p><p className="truncate text-xs text-muted-foreground">{profile?.email || user?.email}</p></div>
          <button type="button" onClick={() => setSettingsOpen(true)} className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"><Settings size={18} />Settings</button>
          <button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-red-500/10 hover:text-red-300"><LogOut size={18} />Sign out</button>
        </div>
      </aside>

      {menuOpen && <button className="fixed inset-0 z-30 bg-black/70 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close navigation overlay" />}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-20 items-center gap-4 border-b border-border bg-background/90 px-5 backdrop-blur-xl sm:px-8">
          <button className="text-foreground lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu /></button>
          <div className="min-w-0 flex-1"><p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">Staff Operations</p><p className="text-sm text-muted-foreground">Hakum Auto Care Command Center</p></div>
          <button type="button" className="inline-flex size-10 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setSettingsOpen(true)} aria-label="Settings">
            <Settings size={18} />
          </button>
        </header>
        <main className="p-5 sm:p-8"><Outlet /></main>
      </div>
      <UserSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} profile={profile} audience="ops" />
    </div>
  )
}
