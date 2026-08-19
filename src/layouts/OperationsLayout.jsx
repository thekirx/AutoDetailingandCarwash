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
  getDetailerDock,
  getDetailerMore,
  getMarketingDock,
  getMarketingMore,
  getOperationsNav,
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
  redirectForRole,
  usesCommandShell,
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
  Inbox,
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
  if (role === 'admin') return 'Branch Admin'
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
 * FloorAppShell — mobile-app-first (TL, crew, sales, marketing, video, detailer).
 * Desktop: phone stage on bay.
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

  return (
    <div className={`floor-app-stage ${shellClass}`.trim()}>
      <div className="floor-shell floor-app-frame flex h-svh max-h-svh w-full flex-col overflow-hidden bg-background text-foreground">
        <header className="floor-topbar z-30 flex shrink-0 items-center gap-2 border-b border-border bg-background/95 backdrop-blur-xl sm:gap-3">
          <div
            className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--color-brand-primary)]"
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
            <button
              type="button"
              className="floor-icon-btn"
              aria-label="Settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={18} />
            </button>
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
                    `floor-chip ${isActive || location.pathname.startsWith(to.split('?')[0]) ? 'floor-chip-active' : ''}`
                  }
                >
                  <Icon size={16} aria-hidden />
                  {label}
                </NavLink>
              )
            })}
            <span className="ml-auto self-center text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              Scope · {branch}
            </span>
          </div>
        )}

        <main className="floor-main ops-page-chrome min-h-0 flex-1 overflow-y-auto overscroll-y-contain py-3 sm:py-4">
          <Outlet />
        </main>

        <UserSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} profile={profile} audience="ops" />
        <OpsInstallPopup />

        <nav
          className="floor-dock z-30 shrink-0 border-t border-border bg-background/98 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
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
  const more = useMemo(() => getVideoEditorMore(), [])
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
  const more = useMemo(() => getDetailerMore(), [])
  return (
    <FloorAppShell
      profile={profile}
      signOut={signOut}
      brand={{ title: 'Hakum Detailing', fallbackName: 'Detailer', icon: <BrandMark /> }}
      dock={dock}
      more={more}
      homeUrl="/operations/queue?family=detailing"
      homeLabel="Open detailing"
    />
  )
}

/** CommandShell — web-first sidebar for SA / ASA / Branch Admin / Investor. */
function CommandShell({ profile, user, signOut, navigation, adminShell }) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const label =
    profile?.role === ROLES.INVESTOR
      ? 'Investor'
      : isBranchAdmin(profile)
        ? 'Branch command'
        : adminShell
          ? 'Admin console'
          : 'Command'

  return (
    <SidebarProvider>
      <div className="command-shell flex min-h-svh w-full min-w-0 overflow-x-hidden bg-background text-foreground">
        <Sidebar collapsible="icon" variant="inset">
          <SidebarHeader>
            <div className="flex items-center gap-3 px-2 py-1">
              {/* Collapsed rail: mark only. Expanded: LW wordmark — never both (double H). */}
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
                <p className="mt-0.5 truncate text-[10px] tracking-[0.18em] text-muted-foreground uppercase">{label}</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarSeparator />
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Command</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigation.map(({ label: itemLabel, to, icon }) => {
                    const Icon = iconMap[icon] || ClipboardList
                    return (
                      <SidebarMenuItem key={to}>
                        <SidebarMenuButton
                          render={
                            <NavLink
                              to={to}
                              end={to.endsWith('/console') || to.endsWith('/dashboard')}
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

        <SidebarInset className="min-w-0 overflow-x-hidden">
          <header className="ops-inset-topbar sticky top-0 z-20 flex min-w-0 items-center gap-3 border-b border-border bg-background/90 backdrop-blur-xl">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">Hakum Auto Care</p>
              <p className="truncate text-sm text-muted-foreground">
                {isBranchAdmin(profile)
                  ? `Branch · ${formatScope(profile)}`
                  : adminShell
                    ? 'Operations · cost · profit · stock'
                    : `Scope · ${formatScope(profile)}`}
              </p>
            </div>
            <NotificationBell
              homeUrl={
                isBranchAdmin(profile)
                  ? '/operations/pos'
                  : adminShell
                    ? '/operations/console'
                    : redirectForRole(profile?.role)
              }
              homeLabel={isBranchAdmin(profile) ? 'Open POS' : adminShell ? 'Open console' : 'Home'}
            />
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
              aria-label="Settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={16} />
            </button>
          </header>
          <main className="ops-page-chrome min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
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
