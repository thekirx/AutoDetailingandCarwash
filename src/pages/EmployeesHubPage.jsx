import { Suspense, lazy, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardList,
  Clock3,
  Settings2,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import {
  allowRoute,
  canAccessAttendance,
  canEditAttendanceRoles,
  canEditAttendanceSettings,
  canManageCrew,
  canManagePeople,
  canOverrideAttendance,
  canUseAttendanceClock,
  ROLES,
} from '@/auth/permissions'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsTabList from '@/components/ops/OpsTabBar'
import { CrewAttendancePanel, CrewSettingsPanel } from '@/pages/crew/CrewAttendancePanels'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { resolveOpsTab } from '@/lib/opsShell'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import '@/styles/employees-hub.css'

const PeopleManagePage = lazy(() => import('@/pages/PeopleManagePage'))

const EMPLOYEES_SHELL_TABS = Object.freeze([
  { id: 'clock', label: 'Time clock', icon: Clock3 },
  { id: 'attendance', label: 'Attendance', icon: UserCheck },
  { id: 'register', label: 'Register', icon: ClipboardList },
  { id: 'employees', label: 'Employee list', icon: Users },
  { id: 'access', label: 'RBAC & roles', icon: ShieldCheck },
  { id: 'settings', label: 'Settings', icon: Settings2 },
])

/**
 * Unified Employees & Attendance hub — consolidates live attendance, register/heatmap,
 * employee CRUD directory, RBAC delegation + temp Team Lead overrides, and time/pay settings.
 */
export default function EmployeesHubPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [createSignal, setCreateSignal] = useState(0)

  const showClock = canUseAttendanceClock(profile)
  const canPeople = allowRoute(profile, 'people') && canManagePeople(profile)
  const canRegisterTab =
    canOverrideAttendance(profile) ||
    profile?.role === ROLES.TEAM_LEAD ||
    profile?.role === ROLES.SUPER_ADMIN ||
    profile?.role === ROLES.ASSISTANT_SUPER_ADMIN
  const showSettings = canEditAttendanceSettings(profile) || canEditAttendanceRoles(profile)

  const visibleTabs = useMemo(
    () =>
      EMPLOYEES_SHELL_TABS.filter((t) => {
        if (t.id === 'clock') return showClock
        if (t.id === 'attendance' || t.id === 'register') return canRegisterTab
        if (t.id === 'employees' || t.id === 'access') return canPeople
        if (t.id === 'settings') return showSettings
        return false
      }),
    [showClock, canRegisterTab, canPeople, showSettings],
  )

  const canEnter = canManagePeople(profile) || canAccessAttendance(profile)
  if (!canEnter || !visibleTabs.length) {
    return <Navigate to="/operations/access-denied" replace />
  }

  const defaultTab = visibleTabs[0].id
  const tab = resolveOpsTab(searchParams.get('tab'), visibleTabs.map((t) => t.id), defaultTab)

  function setShellTab(next) {
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev)
      if (next === defaultTab) nextParams.delete('tab')
      else nextParams.set('tab', next)
      if (next !== 'employees') nextParams.delete('dtab')
      return nextParams
    }, { replace: true })
  }

  function openAddEmployeeModal() {
    if (tab !== 'employees' && tab !== 'access') {
      setShellTab('employees')
    }
    setCreateSignal((n) => n + 1)
  }

  const loadingPanel = <Skeleton className="h-64 rounded-2xl" />

  return (
    <OpsPageShell
      className="hakum-employees hakum-attendance"
      eyebrow="Human Resource"
      title="Employees & Attendance"
      icon={Users}
      description="Live floor attendance, period register, employee profiles, RBAC permissions, and shift/pay policies in one workspace."
      meta={
        <>
          <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
          <span>Manila time · branch-scoped clock & roster</span>
        </>
      }
      actions={
        canPeople ? (
          <Button type="button" className="min-h-11 gap-1.5" onClick={openAddEmployeeModal}>
            <UserPlus className="size-4" aria-hidden />
            Add employee
          </Button>
        ) : null
      }
    >
      <Tabs value={tab} onValueChange={setShellTab} className="flex flex-col gap-5">
        <OpsTabList tabs={visibleTabs} aria-label="Employees sections" />

        {showClock ? (
          <TabsContent value="clock" className="mt-0 outline-none">
            <CrewAttendancePanel
              profile={profile}
              canManage={canManageCrew(profile)}
              showClock
              showFloor={false}
              showRegister={false}
            />
          </TabsContent>
        ) : null}

        {canRegisterTab ? (
          <TabsContent value="attendance" className="mt-0 outline-none">
            <CrewAttendancePanel
              profile={profile}
              canManage={canManageCrew(profile)}
              showClock={false}
              showFloor
              showRegister={false}
              onOpenRegister={() => setShellTab('register')}
            />
          </TabsContent>
        ) : null}

        {canRegisterTab ? (
          <TabsContent value="register" className="mt-0 outline-none">
            <CrewAttendancePanel
              profile={profile}
              canManage={canManageCrew(profile)}
              showClock={false}
              showFloor={false}
              showRegister
            />
          </TabsContent>
        ) : null}

        {canPeople ? (
          <TabsContent value="employees" className="mt-0 outline-none">
            <Suspense fallback={loadingPanel}>
              <PeopleManagePage embedded view="directory" openCreateSignal={createSignal} />
            </Suspense>
          </TabsContent>
        ) : null}

        {canPeople ? (
          <TabsContent value="access" className="mt-0 outline-none">
            <Suspense fallback={loadingPanel}>
              <PeopleManagePage embedded view="access" openCreateSignal={createSignal} />
            </Suspense>
          </TabsContent>
        ) : null}

        {showSettings ? (
          <TabsContent value="settings" className="mt-0 outline-none">
            <CrewSettingsPanel profile={profile} />
          </TabsContent>
        ) : null}
      </Tabs>
    </OpsPageShell>
  )
}
