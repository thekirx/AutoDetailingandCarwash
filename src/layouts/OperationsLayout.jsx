import {
  BarChart3,
  Building2,
  ClipboardList,
  Contact,
  Crown,
  Gauge,
  Kanban,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Plus,
  ScrollText,
  ShoppingCart,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { getOperationsNav, isAdmin, ROLES } from '../auth/permissions'
import NotificationBell from '@/components/NotificationBell'
import PushToggle from '@/components/PushToggle'
import InstallGuide from '@/components/InstallGuide'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'

const iconMap = {
  Gauge,
  LayoutDashboard,
  ClipboardList,
  Users,
  BarChart3,
  ListChecks,
  ShoppingCart,
  Wallet,
  Contact,
  Sparkles,
  Package,
  MessageSquare,
  Kanban,
  LineChart,
  Crown,
  Building2,
  UserPlus,
  ScrollText,
}

/** Primary tablet dock for Team Lead — max 5, thumb-reach. */
const TL_DOCK = [
  { label: 'Floor', to: '/operations/dashboard', icon: Gauge },
  { label: 'Queue', to: '/operations/queue', icon: ClipboardList, end: true },
  { label: 'New', to: '/operations/queue/new', icon: Plus, primary: true },
  { label: 'Crew', to: '/operations/crew', icon: Users },
  { label: 'Bookings', to: '/operations/bookings', icon: Kanban },
]

const TL_MORE = [
  { label: 'KPI', to: '/operations/kpi', icon: BarChart3 },
  { label: 'My Tasks', to: '/operations/my-tasks', icon: ListChecks },
]

function formatRole(role) {
  if (role === 'team_lead') return 'Team Lead'
  if (role === 'BossMich') return 'Super Admin'
  if (role === 'admin') return 'Admin'
  if (role === 'staff') return 'Crew'
  return role || 'Ops'
}

function formatScope(profile) {
  if (profile?.role === 'BossMich') return 'All branches'
  return profile?.branch_slug || 'No branch'
}

function TeamLeadFloorShell({ profile, user, signOut }) {
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const branch = formatScope(profile)

  return (
    <div className="floor-shell dark flex h-svh max-h-svh w-full flex-col overflow-hidden bg-[#070b12] text-slate-100">
      <header className="floor-topbar z-30 flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#0a1220]/95 px-3 py-2 backdrop-blur-xl sm:px-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--color-brand-primary)] text-white" aria-hidden>
          <ClipboardList size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-black tracking-[0.14em]">HAKUM FLOOR</p>
            <span className="floor-live-pill" aria-live="polite">
              <span className="floor-live-dot" aria-hidden />
              LIVE
            </span>
          </div>
          <p className="truncate text-xs text-slate-400">
            {profile?.full_name || 'Team Lead'} · <span className="font-semibold text-blue-200 uppercase tracking-wide">{branch}</span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell light homeUrl="/operations/queue" homeLabel="Open floor" />
          <PushToggle compact variant="ops" className="floor-icon-btn" />
        </div>
        <button
          type="button"
          className="floor-icon-btn"
          aria-expanded={moreOpen}
          aria-controls="floor-more-panel"
          aria-label={moreOpen ? 'Close more menu' : 'Open more menu'}
          onClick={() => setMoreOpen((v) => !v)}
        >
          {moreOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <button type="button" className="floor-icon-btn" onClick={signOut} aria-label="Sign out">
          <LogOut size={18} />
        </button>
      </header>

      {moreOpen && (
        <div
          id="floor-more-panel"
          className="z-20 flex shrink-0 flex-wrap gap-2 border-b border-white/10 bg-[#0d1726] px-3 py-3 sm:px-4"
          role="navigation"
          aria-label="More floor tools"
        >
          {TL_MORE.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                `floor-chip ${isActive || location.pathname.startsWith(to) ? 'floor-chip-active' : ''}`
              }
            >
              <Icon size={16} aria-hidden />
              {label}
            </NavLink>
          ))}
          <div className="w-full sm:w-auto">
            <PushToggle variant="ops" className="w-full justify-center sm:w-auto" />
          </div>
          <div className="w-full basis-full">
            <InstallGuide variant="compact" audience="ops" />
          </div>
          <span className="ml-auto self-center text-[10px] tracking-[0.16em] text-slate-500 uppercase">
            Branch locked · {branch}
          </span>
        </div>
      )}

      <main className="floor-main min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 sm:px-4 sm:py-4">
        <Outlet />
      </main>

      <nav className="floor-dock z-30 shrink-0 border-t border-white/10 bg-[#0a1220]/98 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl" aria-label="Floor navigation">
        <ul className="mx-auto grid max-w-3xl grid-cols-5 gap-1 px-1 py-1.5 sm:gap-2 sm:px-2">
          {TL_DOCK.map(({ label, to, icon: Icon, primary, end }) => (
            <li key={to} className="flex justify-center">
              <NavLink
                to={to}
                end={Boolean(end)}
                className={({ isActive }) => {
                  const onQueueBoard = to === '/operations/queue' && location.pathname === '/operations/queue'
                  const active = primary ? location.pathname === to : end ? onQueueBoard : isActive || location.pathname.startsWith(to)
                  if (primary) {
                    return `floor-dock-fab ${active ? 'floor-dock-fab-active' : ''}`
                  }
                  return `floor-dock-item ${active ? 'floor-dock-item-active' : ''}`
                }}
              >
                <Icon size={primary ? 22 : 20} aria-hidden />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

function AdminOpsShell({ profile, user, signOut, navigation, adminShell }) {
  return (
    <SidebarProvider>
      <div className="dark flex min-h-svh w-full bg-background text-foreground">
        <Sidebar collapsible="icon" variant="inset">
          <SidebarHeader>
            <div className="flex items-center gap-3 px-2 py-1">
              <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                <ClipboardList size={18} />
              </div>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-black tracking-[0.14em]">HAKUM</p>
                <p className="truncate text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                  {adminShell ? 'Admin console' : 'Floor ops'}
                </p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarSeparator />
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>{adminShell ? 'Command' : 'Workspace'}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigation.map(({ label, to, icon }) => {
                    const Icon = iconMap[icon] || ClipboardList
                    return (
                      <SidebarMenuItem key={to}>
                        <SidebarMenuButton render={<NavLink to={to} end={to.endsWith('/console') || to.endsWith('/dashboard')} />}>
                          <Icon />
                          <span>{label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <div className="rounded-xl bg-sidebar-accent/50 px-3 py-3 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold">{profile?.full_name || 'Operations'}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatRole(profile?.role)} · {formatScope(profile)}
              </p>
              <p className="truncate text-xs text-muted-foreground">{profile?.email || user?.email}</p>
              <div className="mt-2">
                <PushToggle className="w-full justify-center" />
              </div>
              <div className="mt-2 group-data-[collapsible=icon]:hidden">
                <InstallGuide variant="compact" audience="ops" surface="light" />
              </div>
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut}>
                  <LogOut />
                  <span>Sign out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-xl">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">Hakum Auto Care</p>
              <p className="truncate text-sm text-muted-foreground">
                {adminShell ? 'Operations · cost · profit · stock' : `Branch · ${formatScope(profile)}`}
              </p>
            </div>
            <NotificationBell homeUrl="/operations/console" homeLabel="Open console" />
            <PushToggle compact />
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

export default function OperationsLayout() {
  const { profile, user, signOut } = useAuth()
  const navigation = useMemo(() => getOperationsNav(profile), [profile])
  const adminShell = isAdmin(profile)
  const isTeamLead = profile?.role === ROLES.TEAM_LEAD

  if (isTeamLead) {
    return <TeamLeadFloorShell profile={profile} user={user} signOut={signOut} />
  }

  return (
    <AdminOpsShell
      profile={profile}
      user={user}
      signOut={signOut}
      navigation={navigation}
      adminShell={adminShell}
    />
  )
}
