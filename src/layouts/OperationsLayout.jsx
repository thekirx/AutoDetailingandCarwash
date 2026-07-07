import { BarChart3, ClipboardList, Gauge, ListChecks, LogOut, Menu, ShieldAlert, Users, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

const managerNav = [
  { label: 'Dashboard', to: '/operations/dashboard', icon: Gauge },
  { label: 'Queue', to: '/operations/queue', icon: ClipboardList },
  { label: 'Crew', to: '/operations/crew', icon: Users },
  { label: 'KPI', to: '/operations/kpi', icon: BarChart3 },
  { label: 'My Tasks', to: '/operations/my-tasks', icon: ListChecks },
]

const staffNav = [
  { label: 'My Tasks', to: '/operations/my-tasks', icon: ListChecks },
]

const branchLabels = {
  bacoor: 'Bacoor',
  batangas: 'Batangas',
}

function formatRole(role) {
  if (role === 'team_lead') return 'Team Lead'
  if (role === 'admin') return 'Admin'
  if (role === 'staff') return 'Staff'
  if (role === 'cashier') return 'Cashier'
  return 'Public'
}

function formatProfileScope(profile) {
  if (profile?.role === 'team_lead') return branchLabels[profile.branch_slug] || 'No branch assigned'
  if (profile?.role === 'admin') return 'All branches'
  return branchLabels[profile?.branch_slug] || 'Assigned tasks'
}

export default function OperationsLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { profile, user, canManageQueue, signOut } = useAuth()
  const navigation = canManageQueue ? managerNav : staffNav

  return (
    <div className="min-h-screen bg-[#070d18] text-slate-100">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/10 bg-[#08111f]/95 shadow-2xl shadow-black/30 backdrop-blur-xl transition-transform lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-blue-500 text-white"><ClipboardList size={22} /></div>
            <div><p className="font-black tracking-[0.16em]">HAKUM</p><p className="text-[10px] tracking-[0.24em] text-blue-200 uppercase">Queue Ops</p></div>
          </div>
          <button className="text-slate-400 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X /></button>
        </div>

        <nav className="flex-1 space-y-1 px-4 py-6" aria-label="Operations navigation">
          {navigation.map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setMenuOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${isActive ? 'bg-blue-500 text-white shadow-[0_12px_32px_rgba(37,99,235,.22)]' : 'text-slate-400 hover:bg-white/7 hover:text-white'}`}>
              <Icon size={19} />{label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 rounded-2xl bg-white/[0.04] px-3 py-3">
            <p className="truncate text-sm font-semibold">{profile?.full_name || 'Operations User'}</p>
            <p className="truncate text-xs text-slate-500">{formatRole(profile?.role)} · {formatProfileScope(profile)}</p>
            <p className="truncate text-xs text-slate-500">{profile?.email || user?.email}</p>
          </div>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-red-500/10 hover:text-red-300"><LogOut size={18} />Sign out</button>
        </div>
      </aside>

      {menuOpen && <button className="fixed inset-0 z-30 bg-black/70 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close navigation overlay" />}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-20 items-center gap-4 border-b border-white/10 bg-[#070d18]/90 px-5 backdrop-blur-xl sm:px-8">
          <button className="text-slate-300 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu /></button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold tracking-[0.2em] text-blue-300 uppercase">Hakum Auto Care</p>
            <p className="truncate text-sm text-slate-500">Queue command center</p>
          </div>
          {!canManageQueue && <div className="hidden items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100 sm:flex"><ShieldAlert size={15} />Assigned tasks only</div>}
        </header>
        <main className="p-5 sm:p-8"><Outlet /></main>
      </div>
    </div>
  )
}
