import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  Car,
  CarFront,
  ChevronDown,
  ClipboardList,
  Clock,
  Columns3,
  Contact,
  Crown,
  Database,
  Gift,
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
  ShieldCheck,
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
  TicketPercent,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
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
import { internalRoleLabel } from '../auth/internalRoles'
import { resolvePostLoginPath } from '../auth/authRedirect'
import { opsNavIsActive, resolveOpsBreadcrumb } from '@/lib/opsNavigationRegistry'
import { getAccessTokenFresh } from '@/lib/authToken'
import { supabase } from '@/lib/supabase'
import NotificationBell from '@/components/NotificationBell'
import PushToggle from '@/components/PushToggle'
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import '../styles/ops-daylight.css'
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
  ArrowLeftRight,
  Gauge,
  LayoutDashboard,
  ClipboardList,
  Users,
  BarChart3,
  ListChecks,
  ShoppingCart,
  TicketPercent,
  Wallet,
  Contact,
  Sparkles,
  Package,
  MessageSquare,
  Kanban,
  LineChart,
  Crown,
  Building2,
  Car,
  UserPlus,
  ScrollText,
  Columns3,
  CarFront,
  Plus,
  Database,
  Gift,
  Inbox,
  Layers,
  Settings,
  ShieldCheck,
  Bell,
  History,
  Clock,
  Newspaper,
  Star,
  Banknote,
  Map,
}

/** Daylight display words for the floor app. Permissions still decide which items exist; this only renames them on screen.
    The admin board keeps the client's own names (Floor Board, Final Checking, Failed QA). */
const DAYLIGHT_LABELS = { Attendance: 'Time clock', New: 'New car' }
const daylightLabel = (label) => DAYLIGHT_LABELS[label] || label

function formatRole(role) {
  return internalRoleLabel(role)
}

function formatScope(profile, names = {}) {
  if (canSeeAllBranches(profile)) return 'All branches'
  const multi = Array.isArray(profile?.branch_slugs) ? profile.branch_slugs.filter(Boolean) : []
  const label = (slug) => names[slug] || slug
  if (multi.length > 1) return multi.map(label).join(', ')
  if (multi.length === 1) return label(multi[0])
  return profile?.branch_slug ? label(profile.branch_slug) : 'No branch'
}

function useBranchNames() {
  const [names, setNames] = useState({})
  useEffect(() => {
    supabase
      .from('branches')
      .select('slug, name')
      .then(({ data }) => setNames(Object.fromEntries((data || []).map((b) => [b.slug, b.name]))))
  }, [])
  return names
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

/** Light-rail lockup: square assets need a crop box + scale (same trick as public wordmark). */
function CommandRailBrand({ homeTo, caption }) {
  return (
    <div className="command-rail-brand">
      <NavLink to={homeTo} className="command-rail-brand-link" aria-label="Hakum Auto Care home">
        <span className="command-rail-logo group-data-[collapsible=icon]:hidden" aria-hidden>
          <img
            src="/branding/hakum-lw-ow.png"
            alt=""
            width={120}
            height={68}
            className="command-rail-logo-img"
            decoding="async"
          />
        </span>
        <span className="command-rail-mark hidden size-9 place-items-center overflow-hidden rounded-xl bg-primary group-data-[collapsible=icon]:grid">
          <img
            src="/branding/hakum-mark-ow.png"
            alt=""
            width={22}
            height={22}
            className="size-[22px] object-contain"
            decoding="async"
          />
        </span>
      </NavLink>
      {caption ? <p className="command-rail-kicker group-data-[collapsible=icon]:hidden">{caption}</p> : null}
    </div>
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
  const [cmdOpen, setCmdOpen] = useState(false)
  const branch = formatScope(profile, useBranchNames())
  // Approved Daylight design (12 Oct 2026) — every floor role, not just team leads.
  const daylight = true
  const dockLabel = (label) => (daylight ? daylightLabel(label) : label)

  const railNav = (
    <nav className="floor-rail-nav" aria-label="Primary navigation">
      <div className="floor-rail-search-wrap">
        <button
          type="button"
          className="floor-rail-search"
          aria-label="Open smart search"
          onClick={() => setCmdOpen(true)}
        >
          <Search size={18} aria-hidden />
          <span>Search…</span>
          <kbd>⌘K</kbd>
        </button>
      </div>
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
                <span>{dockLabel(label)}</span>
              </NavLink>
            </li>
          )
        })}
        {daylight && more?.length ? <li><button type="button" className="floor-rail-item" aria-label="Open more menu" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}><Menu size={22} aria-hidden /><span>More</span></button></li> : null}
      </ul>
      {daylight ? (
        <div className="floor-rail-footer mt-auto pt-3">
          <button type="button" className="floor-rail-item" onClick={signOut} aria-label="Sign out">
            <LogOut size={20} aria-hidden />
            <span>Sign out</span>
          </button>
        </div>
      ) : null}
    </nav>
  )

  return (
    <div className={`floor-app-stage ${daylight ? 'floor-daylight' : ''} ${shellClass}`.trim()}>
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
              {daylight ? (
                <div className="daylight-identity">
                  <p><span className="daylight-identity-name">{profile?.full_name || brand.fallbackName} · </span><span>{formatRole(profile?.role)}</span></p>
                  <span className="daylight-identity-branch">{branch}</span>
                </div>
              ) : <>
              <p className="truncate text-sm font-black tracking-[0.06em] sm:tracking-[0.14em]">{brand.title}</p>
              {/* The name gives way first so the branch is always readable. */}
              <p className="flex min-w-0 text-xs text-muted-foreground">
                <span className="truncate">{profile?.full_name || brand.fallbackName}</span>
                <span className="shrink-0 whitespace-pre">
                  {' · '}
                  <span className="font-semibold tracking-wide text-primary uppercase">{branch}</span>
                </span>
              </p>
              </>}

            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="floor-topbar-search hidden lg:inline-flex"
                aria-label="Open smart search"
                onClick={() => setCmdOpen(true)}
              >
                <Search size={15} aria-hidden />
                <span>Search</span>
                <kbd>⌘K</kbd>
              </button>
              <button
                type="button"
                className="floor-icon-btn lg:hidden"
                aria-label="Open smart search"
                onClick={() => setCmdOpen(true)}
              >
                <Search size={18} aria-hidden />
              </button>
              <PushToggle audience="ops" compact allowUnsupportedInCompact surface="light" />
              <NotificationBell variant="floor" homeUrl={homeUrl} homeLabel={homeLabel} />
              <button type="button" className="floor-icon-btn" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
                <Settings size={18} />
              </button>
              {more?.length && !daylight ? (
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
              {!daylight ? <button type="button" className="floor-icon-btn" onClick={signOut} aria-label="Sign out">
                <LogOut size={18} />
              </button> : null}
            </div>
          </header>

          <main className="floor-main ops-page-chrome min-h-0 flex-1 overflow-y-auto overscroll-y-contain pt-3 pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:pt-4 md:max-w-5xl md:self-stretch md:px-6 md:pb-6">
            <Outlet />
          </main>

          <nav
            className="floor-dock z-30 shrink-0 border-t border-border bg-background/98 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
            aria-label="Primary navigation"
          >
            <ul
              className="mx-auto grid max-w-3xl gap-1 px-1 py-1.5 sm:gap-2 sm:px-2"
              style={{ gridTemplateColumns: `repeat(${Math.max(dock.length + (daylight && more?.length ? 1 : 0), 1)}, minmax(0, 1fr))` }}
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
                      <span>{dockLabel(label)}</span>
                    </NavLink>
                  </li>
                )
              })}
              {daylight && more?.length ? <li className="flex justify-center"><button type="button" className="floor-dock-item" aria-label="Open more menu" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}><Menu size={20} aria-hidden /><span>More</span></button></li> : null}
            </ul>
          </nav>
        </div>

        <ResponsiveSheet open={moreOpen} onOpenChange={setMoreOpen} className={daylight ? 'daylight-more-sheet' : undefined} title="More tools" description={`Scope · ${branch}`}>
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
                  {dockLabel(label)}
                </NavLink>
              )
            })}
            {daylight ? <button type="button" className="floor-chip min-h-11" onClick={signOut}><LogOut size={16} aria-hidden />Sign out</button> : null}
          </div>
        </ResponsiveSheet>

        <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} />
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

function CommandNavList({ items }) {
  const location = useLocation()
  const { setOpenMobile } = useSidebar()
  const groups = groupOperationsNav(items)

  const routeParentKey = useMemo(() => {
    for (const item of items) {
      if (!Array.isArray(item.children) || !item.children.length) continue
      const hasActiveChild = item.children.some((child) => opsNavIsActive(location.pathname, location.search, child.to))
      const parentRouteMatch = opsNavIsActive(location.pathname, location.search, item.to)
      if (hasActiveChild || parentRouteMatch) return item.to
    }
    return null
  }, [items, location.pathname, location.search])

  const [accordionState, setAccordionState] = useState(() => ({
    routeKey: routeParentKey,
    openKey: routeParentKey,
  }))
  const openKey = accordionState.routeKey === routeParentKey ? accordionState.openKey : routeParentKey

  return groups.map((group) => (
    <SidebarGroup key={group.id} className="command-nav-group">
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {group.items.map(({ label: itemLabel, to, icon, children }) => {
            const Icon = iconMap[icon] || ClipboardList
            const hasChildren = Array.isArray(children) && children.length > 0
            const activeChild = hasChildren
              ? children.find((child) => opsNavIsActive(location.pathname, location.search, child.to))
              : null
            const parentRouteMatch = opsNavIsActive(location.pathname, location.search, to)
            const isActive = hasChildren ? parentRouteMatch && !activeChild : parentRouteMatch
            const isOpen = hasChildren && openKey === to

            if (!hasChildren) {
              return (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    className="command-nav-btn"
                    isActive={isActive}
                    tooltip={itemLabel}
                    render={
                      <Link
                        to={to}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => setOpenMobile(false)}
                      />
                    }
                  >
                    <Icon />
                    <span>{itemLabel}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            }

            return (
              <SidebarMenuItem key={to}>
                <div className="command-nav-parent-row">
                  <SidebarMenuButton
                    className="command-nav-btn flex-1 min-w-0"
                    isActive={isActive}
                    tooltip={itemLabel}
                    render={
                      <Link
                        to={to}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => {
                          setAccordionState({ routeKey: routeParentKey, openKey: to })
                          setOpenMobile(false)
                        }}
                      />
                    }
                  >
                    <Icon />
                    <span>{itemLabel}</span>
                  </SidebarMenuButton>
                  <button
                    type="button"
                    className="command-nav-chevron group-data-[collapsible=icon]:hidden"
                    data-open={String(isOpen)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${itemLabel}`}
                    onClick={() =>
                      setAccordionState({
                        routeKey: routeParentKey,
                        openKey: isOpen ? null : to,
                      })
                    }
                  >
                    <ChevronDown size={15} aria-hidden />
                  </button>
                </div>
                <div className="command-nav-accordion group-data-[collapsible=icon]:hidden" data-open={String(isOpen)}>
                  <div>
                    <SidebarMenuSub className="command-nav-sub">
                      {children.map((child) => {
                        const childActive = opsNavIsActive(location.pathname, location.search, child.to)
                        return (
                          <SidebarMenuSubItem key={child.to}>
                            <SidebarMenuSubButton
                              className="command-nav-sub-btn"
                              isActive={childActive}
                              render={
                                <Link
                                  to={child.to}
                                  aria-current={childActive ? 'page' : undefined}
                                  onClick={() => {
                                    setAccordionState({ routeKey: routeParentKey, openKey: to })
                                    setOpenMobile(false)
                                  }}
                                />
                              }
                            >
                              <span>{child.label}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )
                      })}
                    </SidebarMenuSub>
                  </div>
                </div>
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
  const scope = formatScope(profile, useBranchNames())
  const [cmdOpen, setCmdOpen] = useState(false)
  const label =
    profile?.role === ROLES.INVESTOR
      ? 'Investor'
      : isBranchAdmin(profile)
        ? 'Branch command'
        : adminShell
          ? 'Admin console'
          : 'Command'

  const crumb = useMemo(
    () => resolveOpsBreadcrumb(navigation, location.pathname, location.search, label),
    [navigation, location.pathname, location.search, label],
  )

  return (
    <SidebarProvider
      defaultOpen={typeof window === 'undefined' ? true : window.innerWidth >= 1024}
      className="command-shell command-daylight min-w-0 overflow-x-hidden bg-background text-foreground"
      style={{ '--sidebar-width': '15rem', '--sidebar-width-icon': '3.5rem' }}
    >
      <Sidebar collapsible="icon" variant="inset" className="command-rail">
        <SidebarHeader className="command-rail-header">
          <CommandRailBrand homeTo={resolvePostLoginPath(profile, null) || '/operations'} caption={label} />
          <SidebarMenu className="mt-2 group-data-[collapsible=icon]:mt-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                className="command-nav-btn command-rail-search"
                tooltip="Search everything (⌘K)"
                aria-label="Sidebar smart search"
                onClick={() => setCmdOpen(true)}
              >
                <Search aria-hidden />
                <span className="truncate">Search all…</span>
                <kbd className="command-rail-kbd group-data-[collapsible=icon]:hidden">⌘K</kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarSeparator className="command-rail-rule" />
        <SidebarContent className="command-rail-body">
          <CommandNavList items={navigation} />
        </SidebarContent>
        <SidebarFooter className="command-rail-footer">
          <div className="command-rail-who group-data-[collapsible=icon]:hidden">
            <p className="command-rail-who-name truncate">{profile?.full_name || 'Operations'}</p>
            <p className="command-rail-who-meta truncate">
              {formatRole(profile?.role)} · {scope}
            </p>
            <p className="command-rail-who-meta truncate">{profile?.email || user?.email}</p>
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
                ? `Branch · ${scope}`
                : adminShell
                  ? 'Operations · cost · profit · stock'
                  : `Scope · ${scope}`}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="hidden min-h-11 gap-2 lg:inline-flex"
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
            className="min-h-11 min-w-11 lg:hidden"
            onClick={() => setCmdOpen(true)}
            aria-label="Open command menu"
          >
            <Search className="size-4" />
          </Button>
          <PushToggle audience="ops" compact allowUnsupportedInCompact surface="light" className="inline-flex" />
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
        <main className="ops-page-chrome mx-auto min-w-0 w-full max-w-7xl flex-1 p-3 sm:p-5 lg:p-8">
          <Outlet />
        </main>
      </SidebarInset>
      <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} />
      <UserSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} profile={profile} audience="ops" />
      <OpsInstallPopup />
    </SidebarProvider>
  )
}

const AUTO_SWEEP_SESSION_KEY = 'hakum.autoSweepLastAt'
const AUTO_SWEEP_THROTTLE_MS = 10 * 60 * 1000

export default function OperationsLayout() {
  const { profile, user, signOut } = useAuth()
  const navigation = useMemo(() => getOperationsNav(profile), [profile])
  const adminShell = isAdmin(profile) && !isBranchAdmin(profile)
  const role = profile?.role

  useEffect(() => {
    if (!profile?.id || !profile?.is_active || role === 'customer') return
    try {
      const last = Number(globalThis.sessionStorage?.getItem(AUTO_SWEEP_SESSION_KEY) || 0)
      if (Number.isFinite(last) && Date.now() - last < AUTO_SWEEP_THROTTLE_MS) return
      globalThis.sessionStorage?.setItem(AUTO_SWEEP_SESSION_KEY, String(Date.now()))
    } catch {
      /* ignore storage blocks */
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const token = await getAccessTokenFresh()
        if (!token || cancelled) return
        await fetch('/api/notifications?operation=automation-sweep', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ mode: 'auto' }),
        })
      } catch {
        /* non-blocking background sweep */
      }
    }, 2500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [profile?.id, profile?.is_active, role])

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
