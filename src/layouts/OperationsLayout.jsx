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
  MessageSquare,
  ScrollText,
  ShoppingCart,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { useMemo } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { getOperationsNav, isAdmin } from '../auth/permissions'
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
  MessageSquare,
  Kanban,
  LineChart,
  Crown,
  Building2,
  UserPlus,
  ScrollText,
}

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

export default function OperationsLayout() {
  const { profile, user, signOut } = useAuth()
  const navigation = useMemo(() => getOperationsNav(profile), [profile])
  const adminShell = isAdmin(profile)

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
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">Hakum Auto Care</p>
              <p className="truncate text-sm text-muted-foreground">
                {adminShell ? 'Operations · cost · profit · stock' : `Branch · ${formatScope(profile)}`}
              </p>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
