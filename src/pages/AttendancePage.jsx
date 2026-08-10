import { useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Clock3, ShieldCheck, Users } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import { CrewAttendancePanel, CrewSettingsPanel } from '@/pages/crew/CrewAttendancePanels'

/**
 * Dedicated Attendance system:
 * - Branch Admin / Crew / Team Lead → geofenced time in / out
 * - Branch Admin / SA / ASA → override register
 * - SA → network geofence + shifts (same for all branches) + role allow-list
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
    if (showSettings) list.push({ id: 'settings', label: 'Settings', icon: ShieldCheck })
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
    <section className="flex flex-col gap-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="border-b border-border pb-4">
        <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Operations</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <Clock3 className="size-6 shrink-0 text-primary" aria-hidden />
          Attendance
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {showClock
            ? 'Time in inside the branch geofence, then time out at end of shift. Crew cannot be assigned until present or late.'
            : 'Override attendance and set network geofence + shifts (same for every branch).'}
        </p>
      </header>

      {tabs.length > 1 ? (
        <div
          role="tablist"
          aria-label="Attendance sections"
          className={cn(
            'grid gap-1 rounded-xl border border-border bg-muted/40 p-1',
            tabs.length === 2 ? 'grid-cols-2' : 'grid-cols-3',
          )}
        >
          {tabs.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition',
                  tab === t.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setTab(t.id)}
              >
                <Icon className="size-4" aria-hidden />
                {t.label}
              </button>
            )
          })}
        </div>
      ) : null}

      {tab === 'clock' && showClock ? (
        <CrewAttendancePanel
          profile={profile}
          canManage={canManageCrew(profile)}
          showClock
          showRegister={false}
        />
      ) : null}

      {tab === 'register' && canRegisterTab ? (
        <CrewAttendancePanel
          profile={profile}
          canManage={canManageCrew(profile)}
          showClock={false}
          showRegister
        />
      ) : null}

      {tab === 'settings' && showSettings ? <CrewSettingsPanel profile={profile} /> : null}
    </section>
  )
}
