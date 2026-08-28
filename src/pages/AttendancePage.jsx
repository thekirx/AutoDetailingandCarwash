import { useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, Clock3, Settings2, Users } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import {
  canAccessAttendance,
  canEditAttendanceRoles,
  canEditAttendanceSettings,
  canManageCrew,
  canOverrideAttendance,
  canUseAttendanceClock,
  ROLES,
} from '@/auth/permissions'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsTabList from '@/components/ops/OpsTabBar'
import { CrewAttendancePanel, CrewSettingsPanel } from '@/pages/crew/CrewAttendancePanels'

/**
 * Attendance hub — clock, register, settings (geofence, roles, pay weights).
 */
export default function AttendancePage() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const showClock = canUseAttendanceClock(profile)
  const showSettings = canEditAttendanceSettings(profile) || canEditAttendanceRoles(profile)
  const canRegisterTab =
    canOverrideAttendance(profile) ||
    profile?.role === ROLES.TEAM_LEAD ||
    profile?.role === ROLES.SUPER_ADMIN ||
    profile?.role === ROLES.ASSISTANT_SUPER_ADMIN

  const tabs = useMemo(() => {
    const list = []
    if (showClock) list.push({ id: 'clock', label: 'Time clock', icon: Clock3 })
    if (canRegisterTab) list.push({ id: 'register', label: 'Register', icon: Users })
    if (showSettings) list.push({ id: 'settings', label: 'Settings', icon: Settings2 })
    return list
  }, [showClock, canRegisterTab, showSettings])

  if (!canAccessAttendance(profile)) {
    return <Navigate to="/operations/access-denied" replace />
  }

  const tabParam = params.get('tab')
  const tab = tabs.some((t) => t.id === tabParam) ? tabParam : tabs[0]?.id || 'clock'

  function setTab(next) {
    setParams(next === tabs[0]?.id ? {} : { tab: next }, { replace: true })
  }

  return (
    <OpsPageShell
      className="hakum-attendance"
      eyebrow="Operations"
      title="Attendance"
      description={
        showClock
          ? 'Time in inside the branch geofence. Present or late crew can be assigned to floor jobs. Late arrivals still earn — at a lower wash-pool share set in Settings.'
          : 'Review branch attendance, override rows, and configure geofence, roles, and late-pay policy.'
      }
      meta={
        <>
          <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
          <span>Manila calendar day · geofence enforced per profile</span>
        </>
      }
    >
      {tabs.length > 1 ? (
        <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-5">
          <OpsTabList aria-label="Attendance sections" tabs={tabs} />

          {showClock ? (
            <TabsContent value="clock" className="mt-0 outline-none">
              <CrewAttendancePanel
                profile={profile}
                canManage={canManageCrew(profile)}
                showClock
                showRegister={false}
              />
            </TabsContent>
          ) : null}

          {canRegisterTab ? (
            <TabsContent value="register" className="mt-0 outline-none">
              <CrewAttendancePanel
                profile={profile}
                canManage={canManageCrew(profile)}
                showClock={false}
                showRegister
              />
            </TabsContent>
          ) : null}

          {showSettings ? (
            <TabsContent value="settings" className="mt-0 outline-none">
              <CrewSettingsPanel profile={profile} />
            </TabsContent>
          ) : null}
        </Tabs>
      ) : (
        <>
          {tab === 'clock' && showClock ? (
            <CrewAttendancePanel profile={profile} canManage={canManageCrew(profile)} showClock showRegister={false} />
          ) : null}
          {tab === 'register' && canRegisterTab ? (
            <CrewAttendancePanel profile={profile} canManage={canManageCrew(profile)} showClock={false} showRegister />
          ) : null}
          {tab === 'settings' && showSettings ? <CrewSettingsPanel profile={profile} /> : null}
        </>
      )}
    </OpsPageShell>
  )
}
