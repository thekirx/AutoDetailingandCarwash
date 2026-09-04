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
  Inbox,
  Gauge,
  History,
  Kanban,
  Layers,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LogOut,
  Map,
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
  Banknote,
  Newspaper,
  Star,
  Search,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import {
  getDetailerDock,
  getDetailerMore,
  getMarketingDock,
  getMarketingMore,
  getOperationsNav,
  groupOperationsNav,
  getSalesDock,
  getSalesMore,
  getStaffDock,
  getStaffMore,
  getTeamLeadDock,
  getTeamLeadMore,
  getVideoEditorDock,
  getVideoEditorMore,
  isAdmin,
  isBranchAdmin,
  isSalesRole,
  ROLES,
  canSeeAllBranches,
  usesCommandShell,
} from '../auth/permissions'
import { resolvePostLoginPath } from '../auth/authRedirect'
import NotificationBell from '@/components/NotificationBell'
import UserSettingsModal from '@/components/UserSettingsModal'
import { OpsInstallPopup } from '@/components/InstallGuide'
import CommandMenu from '@/components/ops/CommandMenu'
import ResponsiveSheet from '@/components/ops/ResponsiveSheet'
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
  useSidebar,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
  Inbox,
  Layers,
  Settings,
  Bell,
  History,
  Clock,
  Newspaper,
  Star,
  Banknote,
  Map,
}

function formatRole(role) {
  if (role === 'team_lead') return 'Team Lead'
  if (role === 'BossMich') return 'Super Admin'
  if (role === 'assistant_super_admin') return 'Assistant Super Admin'
  if (role === 'admin') return 'Branch Admin'
  if (role === 'operations_lead') return 'Operations Lead'
  if (role === 'staff') return 'Crew'
  if (role === 'marketing') return 'Marketing'
  if (role === 'detailer') return 'Detailer'
  if (role === 'video_editor') return 'Video Editor'
  if (role === 'investor') return 'Investor'
  return role || 'Ops'
}

function formatScope(profile) {
  if (canSeeAllBranches(profile)) return 'All branches'
  const multi = Array.isArray(profile?.branch_slugs) ? profile.branch_slugs.filter(Boolean) : []
  if (multi.length > 1) return multi.join(', ')
  if (multi.length === 1) return multi[0]
  return profile?.branch_slug || 'No branch'
}

function BrandMark({ size = 28 }) {
  return (
    <img
      src="/branding/hakum-mark-ow.png"
      alt=""
      width={size}
      height={size}
      className="object-contain"
      style={{ width: size, height: size }}
      decoding="async"
    />
  )
}

/**
 * FloorAppShell — phone dock; tablet+ left rail + content (no stretched phone frame).
 */
function FloorAppShell({
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

  const railNav = (
    <nav className="floor-rail-nav" aria-label="Primary navigation">
      <ul className="floor-rail-list">
        {dock.map(({ label, to, icon, primary, end }) => {
          const Icon = iconMap[icon] || ClipboardList
          const pathOnly = to.split('?')[0]
          return (
            <li key={to}>
              <NavLink
                to={to}
                end={Boolean(end)}
                className={({ isActive }) => {
                  const onQueueBoard = pathOnly === '/operations/queue' && location.pathname === '/operations/queue'
                  const active = primary
                    ? location.pathname === pathOnly || location.pathname.startsWith(`${pathOnly}/`)
                    : end
                      ? onQueueBoard
                      : isActive || location.pathname.startsWith(pathOnly)
                  return `floor-rail-item ${primary ? 'floor-rail-item-primary' : ''} ${active ? 'is-active' : ''}`
                }}
              >
                <Icon size={22} aria-hidden />
                <span>{label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )

  return (
    <div className={`floor-app-stage ${shellClass}`.trim()}>
      <div className="floor-shell floor-app-frame flex h-svh max-h-svh w-full flex-col overflow-hidden bg-background text-foreground md:flex-row">
        <div className="floor-rail-aside hidden md:flex">{railNav}</div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="floor-topbar z-30 flex shrink-0 items-center gap-2 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl sm:gap-3">
            <div
              className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary"
              aria-hidden
            >
              {brand.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black tracking-[0.06em] sm:tracking-[0.14em]">{brand.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {profile?.full_name || brand.fallbackName} ·{' '}
                <span className="font-semibold tracking-wide text-primary uppercase">{branch}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <NotificationBell light homeUrl={homeUrl} homeLabel={homeLabel} />
              <button type="button" className="floor-icon-btn" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
                <Settings size={18} />
              </button>
              {more?.length ? (
                <button
                  type="button"
                  className="floor-icon-btn"
                  aria-expanded={moreOpen}
                  aria-label="Open more menu"
                  onClick={() => setMoreOpen(true)}
                >
                  <Menu size={20} />
                </button>
              ) : null}
              <button type="button" className="floor-icon-btn" onClick={signOut} aria-label="Sign out">
                <LogOut size={18} />
              </button>
            </div>
          </header>

          <main className="floor-main ops-page-chrome min-h-0 flex-1 overflow-y-auto overscroll-y-contain py-3 sm:py-4 md:max-w-5xl md:self-stretch md:px-4">
            <Outlet />
          </main>

          <nav
            className="floor-dock z-30 shrink-0 border-t border-border bg-background/98 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
            aria-label="Primary navigation"
          >
            <ul
              className="mx-auto grid max-w-3xl gap-1 px-1 py-1.5 sm:gap-2 sm:px-2"
              style={{ gridTemplateColumns: `repeat(${Math.max(dock.length, 1)}, minmax(0, 1fr))` }}
            >
              {dock.map(({ label, to, icon, primary, end }) => {
                const Icon = iconMap[icon] || ClipboardList
                const pathOnly = to.split('?')[0]
                return (
                  <li key={to} className="flex justify-center">
                    <NavLink
                      to={to}
                      end={Boolean(end)}
                      className={({ isActive }) => {
                        const onQueueBoard = pathOnly === '/operations/queue' && location.pathname === '/operations/queue'
                        const active = primary
                          ? location.pathname === pathOnly || location.pathname.startsWith(`${pathOnly}/`)
                          : end
                            ? onQueueBoard
                            : isActive || location.pathname.startsWith(pathOnly)
                        if (primary) return `floor-dock-fab ${active ? 'floor-dock-fab-active' : ''}`
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

        <ResponsiveSheet open={moreOpen} onOpenChange={setMoreOpen} title="More tools" description={`Scope · ${branch}`}>
          <div className="grid gap-2" role="navigation" aria-label="More tools">
            {more.map(({ label, to, icon }) => {
              const Icon = iconMap[icon] || ClipboardList
              return (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `floor-chip min-h-11 ${isActive || location.pathname.startsWith(to.split('?')[0]) ? 'floor-chip-active' : ''}`
                  }
                >
                  <Icon size={16} aria-hidden />
                  {label}
                </NavLink>
              )
            })}
          </div>
        </ResponsiveSheet>

        <UserSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} profile={profile} audience="ops" />
        <OpsInstallPopup />
      </div>
    </div>
  )
}

function TeamLeadFloorShell({ profile, signOut }) {
  const dock = useMemo(() => getTeamLeadDock(profile), [profile])
  const more = useMemo(() => getTeamLeadMore(profile), [profile])
  return (
    <FloorAppShell
      profile={profile}
      signOut={signOut}
      brand={{ title: 'Hakum Auto Care', fallbackName: 'Team Lead', icon: <BrandMark /> }}
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
    <FloorAppShell
      profile={profile}
      signOut={signOut}
      brand={{ title: 'Hakum Auto Care', fallbackName: 'Sales', icon: <BrandMark /> }}
      dock={dock}
      more={more}
      homeUrl="/operations/bookings"
      homeLabel="Open bookings"
    />
  )
}

function StaffFloorShell({ profile, signOut }) {
  const dock = useMemo(() => getStaffDock(profile), [profile])
  const more = useMemo(() => getStaffMore(profile), [profile])
  return (
    <FloorAppShell
      profile={profile}
      signOut={signOut}
      brand={{ title: 'Hakum Crew', fallbackName: 'Crew', icon: <BrandMark /> }}
      dock={dock}
      more={more}
      homeUrl="/operations/attendance"
      homeLabel="Open attendance"
    />
  )
}

function MarketingFloorShell({ profile, signOut }) {
  const dock = useMemo(() => getMarketingDock(profile), [profile])
  const more = useMemo(() => getMarketingMore(profile), [profile])
  return (
    <FloorAppShell
      profile={profile}
      signOut={signOut}
      brand={{ title: 'Hakum Marketing', fallbackName: 'Marketing', icon: <BrandMark /> }}
      dock={dock}
      more={more}
      homeUrl="/operations/crm"
      homeLabel="Open CRM"
    />
  )
}

function VideoEditorFloorShell({ profile, signOut }) {
  const dock = useMemo(() => getVideoEditorDock(profile), [profile])
  const more = useMemo(() => getVideoEditorMore(profile), [profile])
  return (
    <FloorAppShell
      profile={profile}
      signOut={signOut}
      brand={{ title: 'Hakum Studio', fallbackName: 'Video', icon: <BrandMark /> }}
      dock={dock}
      more={more}
      homeUrl="/operations/planning?tab=calendar"
      homeLabel="Open calendar"
    />
  )
}

function DetailerFloorShell({ profile, signOut }) {
  const dock = useMemo(() => getDetailerDock(profile), [profile])
  const more = useMemo(() => getDetailerMore(profile), [profile])
  return (
    <FloorAppShell
      profile={profile}
      signOut={signOut}
      brand={{ title: 'Hakum Detailing', fallbackName: 'Detailer', icon: <BrandMark /> }}
      dock={dock}
      more={more}
      homeUrl="/operations/bookings"
      homeLabel="Open detailing"
    />
  )
}

function commandNavIsActive(pathname, to) {
  const path = String(to || '').split('?')[0]
  if (!path) return false
  if (path.endsWith('/console') || path.endsWith('/dashboard')) return pathname === path
  return pathname === path || pathname.startsWith(`${path}/`)
}

function CommandNavList({ items }) {
  const location = useLocation()
  const { setOpenMobile } = useSidebar()
  const groups = groupOperationsNav(items)

  return groups.map((group) => (
    <SidebarGroup key={group.id} className="command-nav-group">
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map(({ label: itemLabel, to, icon }) => {
            const Icon = iconMap[icon] || ClipboardList
            const path = to.split('?')[0]
            const end = path.endsWith('/console') || path.endsWith('/dashboard')
            return (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton
                  className="command-nav-btn"
                  isActive={commandNavIsActive(location.pathname, to)}
                  tooltip={itemLabel}
                  render={
                    <NavLink
                      to={to}
                      end={end}
                      onClick={() => setOpenMobile(false)}
                    />
                  }
                >
                  <Icon />
                  <span>{itemLabel}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ))
}

/** CommandShell — web-first sidebar for SA / ASA / Branch Admin / Investor. */
function CommandShell({ profile, user, signOut, navigation, adminShell }) {
  const location = useLocation()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const label =
    profile?.role === ROLES.INVESTOR
      ? 'Investor'
      : isBranchAdmin(profile)
        ? 'Branch command'
        : adminShell
          ? 'Admin console'
          : 'Command'

  const crumb = useMemo(() => {
    const match = navigation.find((item) => commandNavIsActive(location.pathname, item.to))
    return match?.label || label
  }, [navigation, location.pathname, label])

  return (
    <SidebarProvider
      className="command-shell min-w-0 overflow-x-hidden bg-background text-foreground"
      style={{ '--sidebar-width': '15rem' }}
    >
      <Sidebar collapsible="icon" variant="inset" className="command-rail">
        <SidebarHeader className="command-rail-header">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="hidden size-9 place-items-center overflow-hidden rounded-xl bg-primary text-primary-foreground group-data-[collapsible=icon]:grid">
              <img
                src="/branding/hakum-mark-ow.png"
                alt=""
                width={22}
                height={22}
                className="size-[22px] object-contain"
                decoding="async"
              />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <img
                src="/branding/hakum-lw-blue.png"
                alt="Hakum"
                className="h-6 w-auto object-contain object-left"
                decoding="async"
              />
              <p className="command-rail-kicker">{label}</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarSeparator className="command-rail-rule" />
        <SidebarContent className="command-rail-body">
          <CommandNavList items={navigation} />
        </SidebarContent>
        <SidebarFooter className="command-rail-footer">
          <div className="command-rail-who group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold">{profile?.full_name || 'Operations'}</p>
            <p className="truncate text-xs text-muted-foreground">
              {formatRole(profile?.role)} · {formatScope(profile)}
            </p>
            <p className="truncate text-xs text-muted-foreground">{profile?.email || user?.email}</p>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="command-nav-btn" tooltip="Account" onClick={() => setSettingsOpen(true)}>
                <Settings />
                <span>Account</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton className="command-nav-btn" tooltip="Sign out" onClick={signOut}>
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 overflow-x-hidden">
        <header className="ops-inset-topbar sticky top-0 z-20 flex min-w-0 items-center gap-2 border-b border-border bg-background/90 backdrop-blur-xl sm:gap-3">
          <SidebarTrigger className="min-h-11 min-w-11" />
          <Separator orientation="vertical" className="hidden h-5 sm:block" />
          <div className="min-w-0 flex-1">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>Ops</span>
              <span aria-hidden>/</span>
              <span className="truncate font-medium text-foreground">{crumb}</span>
            </nav>
            <p className="truncate text-sm text-muted-foreground">
              {isBranchAdmin(profile)
                ? `Branch · ${formatScope(profile)}`
                : adminShell
                  ? 'Operations · cost · profit · stock'
                  : `Scope · ${formatScope(profile)}`}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="hidden min-h-11 gap-2 md:inline-flex"
            onClick={() => setCmdOpen(true)}
            aria-label="Open command menu"
          >
            <Search className="size-4" aria-hidden />
            <span className="text-muted-foreground">Search</span>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 md:hidden"
            onClick={() => setCmdOpen(true)}
            aria-label="Open command menu"
          >
            <Search className="size-4" />
          </Button>
          <NotificationBell
            homeUrl={isBranchAdmin(profile) ? '/operations/pos' : resolvePostLoginPath(profile, null)}
            homeLabel={isBranchAdmin(profile) ? 'Open POS' : 'Home'}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--shape-interactive)] border border-border bg-background text-muted-foreground hover:bg-muted"
              aria-label="Account menu"
            >
              <Settings size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span>{profile?.full_name || 'Account'}</span>
                  <span className="font-normal text-muted-foreground">{formatRole(profile?.role)}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>Settings</DropdownMenuItem>
              <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="ops-page-chrome mx-auto min-w-0 w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </SidebarInset>
      <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} />
      <UserSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} profile={profile} audience="ops" />
      <OpsInstallPopup />
    </SidebarProvider>
  )
}

export default function OperationsLayout() {
  const { profile, user, signOut } = useAuth()
  const navigation = useMemo(() => getOperationsNav(profile), [profile])
  const adminShell = isAdmin(profile) && !isBranchAdmin(profile)
  const role = profile?.role

  if (role === ROLES.TEAM_LEAD) {
    return <TeamLeadFloorShell profile={profile} signOut={signOut} />
  }
  if (isSalesRole(profile)) {
    return <SalesFloorShell profile={profile} signOut={signOut} />
  }
  if (role === ROLES.STAFF) {
    return <StaffFloorShell profile={profile} signOut={signOut} />
  }
  if (role === ROLES.MARKETING) {
    return <MarketingFloorShell profile={profile} signOut={signOut} />
  }
  if (role === ROLES.VIDEO_EDITOR) {
    return <VideoEditorFloorShell profile={profile} signOut={signOut} />
  }
  if (role === ROLES.DETAILER) {
    return <DetailerFloorShell profile={profile} signOut={signOut} />
  }

  if (usesCommandShell(profile) || isBranchAdmin(profile)) {
    return (
      <CommandShell
        profile={profile}
        user={user}
        signOut={signOut}
        navigation={navigation}
        adminShell={adminShell || isBranchAdmin(profile)}
      />
    )
  }

  return (
    <CommandShell
      profile={profile}
      user={user}
      signOut={signOut}
      navigation={navigation}
      adminShell={false}
    />
  )
}
