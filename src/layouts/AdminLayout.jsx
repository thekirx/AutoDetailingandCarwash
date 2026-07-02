import { CalendarDays, ChartNoAxesCombined, Gauge, Menu, ListOrdered, Users, X, LogOut, CarFront } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

const navigation = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: Gauge },
  { label: 'Bookings', to: '/admin/bookings', icon: CalendarDays },
  { label: 'Queue', to: '/admin/queue', icon: ListOrdered },
  { label: 'Customers', to: '/admin/customers', icon: Users },
  { label: 'Reports', to: '/admin/reports', icon: ChartNoAxesCombined },
]

export default function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { profile, user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-[#0b0f14] text-slate-100">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/8 bg-[#0e131a] transition-transform lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center justify-between border-b border-white/8 px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-lime-400 text-[#0b0f14]"><CarFront size={22} /></div>
            <div><p className="font-semibold tracking-wide">HAKUM</p><p className="text-[10px] tracking-[0.28em] text-slate-500">AUTO CARE</p></div>
          </div>
          <button className="text-slate-400 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X /></button>
        </div>

        <nav className="flex-1 space-y-1 px-4 py-6" aria-label="Staff navigation">
          {navigation.map(({ label, to, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${isActive ? 'bg-lime-400 text-[#0b0f14] shadow-[0_8px_30px_rgba(163,230,53,.12)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <Icon size={19} />{label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/8 p-4">
          <div className="mb-3 px-3"><p className="truncate text-sm font-medium">{profile?.full_name || 'Staff Member'}</p><p className="truncate text-xs text-slate-500">{profile?.email || user?.email}</p></div>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-red-500/10 hover:text-red-300"><LogOut size={18} />Sign out</button>
        </div>
      </aside>

      {menuOpen && <button className="fixed inset-0 z-30 bg-black/70 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close navigation overlay" />}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-20 items-center gap-4 border-b border-white/8 bg-[#0b0f14]/90 px-5 backdrop-blur-xl sm:px-8">
          <button className="text-slate-300 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu /></button>
          <div><p className="text-xs font-medium tracking-[0.2em] text-lime-400 uppercase">Staff Operations</p><p className="text-sm text-slate-500">Hakum Auto Care Command Center</p></div>
        </header>
        <main className="p-5 sm:p-8"><Outlet /></main>
      </div>
    </div>
  )
}
