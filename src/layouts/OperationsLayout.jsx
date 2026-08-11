import {
  BarChart3,
  Building2,
  CarFront,
  ClipboardList,
  Clock,
  Columns3,
  Contact,
  Crown,
  Database,
  Gauge,
  History,
  Kanban,
  Layers,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Plus,
  ScrollText,
  Settings,
  ShoppingCart,
  Sparkles,
  Bell,
  UserPlus,
  Users,
  Wallet,
  X,
  Newspaper,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import {
  getBranchAdminDock,
  getBranchAdminMore,
  getOperationsNav,
  getSalesDock,
  getSalesMore,
  getTeamLeadDock,
  getTeamLeadMore,
  isAdmin,
  isBranchAdmin,
  isSalesRole,
  ROLES,
  canSeeAllBranches,
  redirectForRole,
} from '../auth/permissions'
import NotificationBell from '@/components/NotificationBell'
import UserSettingsModal from '@/components/UserSettingsModal'
import { OpsInstallPopup } from '@/components/InstallGuide'
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
  Columns3,
  CarFront,
  Plus,
  Database,
  Layers,
  Settings,
  Bell,
  History,
  Clock,
  Newspaper,
}

function formatRole(role) {
  if (role === 'team_lead') return 'Team Lead'
  if (role === 'BossMich') return 'Super Admin'
  if (role === 'assistant_super_admin') return 'Assistant Super Admin'
  if (role === 'admin') return 'Admin'
  if (role === 'staff') return 'Crew'
  if (role === 'marketing') return 'Marketing'
  return role || 'Ops'
}

function formatScope(profile) {
  if (canSeeAllBranches(profile)) return 'All branches'
  const multi = Array.isArray(profile?.branch_slugs) ? profile.branch_slugs.filter(Boolean) : []
  if (multi.length > 1) return multi.join(', ')
  if (multi.length === 1) return multi[0]
  return profile?.branch_slug || 'No branch'
}

/** Shared thumb-dock shell for Team Lead + Branch Admin (phone / tablet first). */
function FloorOpsShell({
  profile,
  signOut,
  brand,
  dock,
  more,
  homeUrl,
  homeLabel,
  shellClass = '',
}) {
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const branch = formatScope(profile)

  return (
    <div className={`floor-shell flex h-svh max-h-svh w-full flex-col overflow-hidden bg-background text-foreground ${shellClass}`.trim()}>
      <header className="floor-topbar z-30 flex shrink-0 items-center gap-2 border-b border-border bg-background/95 backdrop-blur-xl sm:gap-3">
        <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--color-brand-primary)]" aria-hidden>
          {brand.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black tracking-[0.06em] sm:tracking-[0.14em]">{brand.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {profile?.full_name || brand.fallbackName} ·{' '}
            <span className="font-semibold text-primary uppercase tracking-wide">{branch}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <NotificationBell light homeUrl={homeUrl} homeLabel={homeLabel} />
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
          className="floor-more-panel z-20 flex shrink-0 flex-wrap gap-2 border-b border-border bg-muted/40 py-3"
          role="navigation"
          aria-label="More tools"
        >
          {more.map(({ label, to, icon }) => {
            const Icon = iconMap[icon] || ClipboardList
            return (
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
            )
          })}
          <button
            type="button"
            className="floor-chip"
            onClick={() => {
              setMoreOpen(false)
              setSettingsOpen(true)
            }}
          >
            <Settings size={16} aria-hidden />
            Settings
          </button>
          <span className="ml-auto self-center text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            Scope · {branch}
          </span>
        </div>
      )}

      <main className="floor-main min-h-0 flex-1 overflow-y-auto overscroll-y-contain py-3 sm:py-4">
        <Outlet />
      </main>

      <UserSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} profile={profile} audience="ops" />
      <OpsInstallPopup />

      <nav className="floor-dock z-30 shrink-0 border-t border-border bg-background/98 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl" aria-label="Primary navigation">
        <ul
          className="mx-auto grid max-w-3xl gap-1 px-1 py-1.5 sm:gap-2 sm:px-2"
          style={{ gridTemplateColumns: `repeat(${Math.max(dock.length, 1)}, minmax(0, 1fr))` }}
        >
          {dock.map(({ label, to, icon, primary, end }) => {
            const Icon = iconMap[icon] || ClipboardList
            return (
              <li key={to} className="flex justify-center">
                <NavLink
                  to={to}
                  end={Boolean(end)}
                  className={({ isActive }) => {
                    const onQueueBoard = to === '/operations/queue' && location.pathname === '/operations/queue'
                    const active = primary
                      ? location.pathname === to || location.pathname.startsWith(`${to}/`)
                      : end
                        ? onQueueBoard
                        : isActive || location.pathname.startsWith(to)
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
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

function TeamLeadFloorShell({ profile, signOut }) {
  const dock = useMemo(() => getTeamLeadDock(profile), [profile])
  const more = useMemo(() => getTeamLeadMore(profile), [profile])
  return (
    <FloorOpsShell
      profile={profile}
      signOut={signOut}
      brand={{
        title: 'Hakum Auto Care',
        fallbackName: 'Team Lead',
        icon: (
          <img
            src="/branding/hakum-mark-ow.png"
            alt=""
            width={28}
            height={28}
            className="size-7 object-contain"
            decoding="async"
          />
        ),
      }}
      dock={dock}
      more={more}
      homeUrl="/operations/queue"
      homeLabel="Open floor"
    />
  )
}

function SalesFloorShell({ profile, signOut }) {
  const dock = useMemo(() => getSalesDock(profile), [profile])
  const more = useMemo(() => getSalesMore(profile), [profile])
  return (
    <FloorOpsShell
      profile={profile}
      signOut={signOut}
      brand={{
        title: 'Hakum Auto Care',
        fallbackName: 'Sales',
        icon: (
          <img
            src="/branding/hakum-mark-ow.png"
            alt=""
            width={28}
            height={28}
            className="size-7 object-contain"
            decoding="async"
          />
        ),
      }}
      dock={dock}
      more={more}
      homeUrl="/operations/bookings"
      homeLabel="Open bookings"
    />
  )
}

function BranchAdminFloorShell({ profile, signOut }) {
  const dock = useMemo(() => getBranchAdminDock(profile), [profile])
  const more = useMemo(() => getBranchAdminMore(profile), [profile])
  return (
    <FloorOpsShell
      profile={profile}
      signOut={signOut}
      brand={{
        title: 'HAKUM BRANCH',
        fallbackName: 'Admin',
        icon: <ShoppingCart size={18} />,
      }}
      dock={dock}
      more={more}
      homeUrl="/operations/pos"
      homeLabel="Open POS"
      shellClass="floor-shell-branch"
    />
  )
}

function AdminOpsShell({ profile, user, signOut, navigation, adminShell }) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <SidebarProvider>
      <div className="flex min-h-svh w-full bg-background text-foreground">
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
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setSettingsOpen(true)}>
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
          <header className="ops-inset-topbar sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/90 backdrop-blur-xl">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">Hakum Auto Care</p>
              <p className="truncate text-sm text-muted-foreground">
                {adminShell ? 'Operations · cost · profit · stock' : `Branch · ${formatScope(profile)}`}
              </p>
            </div>
            <NotificationBell
              homeUrl={adminShell ? '/operations/console' : redirectForRole(profile?.role)}
              homeLabel={adminShell ? 'Open console' : 'Open my tasks'}
            />
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
      <UserSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} profile={profile} audience="ops" />
    </SidebarProvider>
  )
}

export default function OperationsLayout() {
  const { profile, user, signOut } = useAuth()
  const navigation = useMemo(() => getOperationsNav(profile), [profile])
  const adminShell = isAdmin(profile) && !isBranchAdmin(profile)
  const isTeamLead = profile?.role === ROLES.TEAM_LEAD

  if (isTeamLead) {
    return <TeamLeadFloorShell profile={profile} signOut={signOut} />
  }

  if (isSalesRole(profile)) {
    return <SalesFloorShell profile={profile} signOut={signOut} />
  }

  if (isBranchAdmin(profile)) {
    return <BranchAdminFloorShell profile={profile} signOut={signOut} />
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
