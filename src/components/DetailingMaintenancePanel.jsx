import { useCallback, useEffect, useMemo, useState } from 'react'
import { BellRing, CalendarClock, LoaderCircle, Save, Send, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { getAccessTokenFresh } from '@/lib/authToken'
import {
  DETAILING_SCHEDULE_TYPES,
  daysUntilDue,
  maintenanceUrgency,
  resolveFrequencyMonthsFromSettings,
} from '@/lib/paintMaintenance'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const URGENCY_LABEL = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  upcoming: 'Upcoming',
  none: '—',
}

/**
 * Bookings → Maintenance: per-type intervals + per-plate due dates + manual client reminders.
 * Status SMS/push still fire from the board when a detailing job advances.
 */
export default function DetailingMaintenancePanel({ branchFilter = 'all' }) {
  const [loading, setLoading] = useState(true)
  const [schedules, setSchedules] = useState([])
  const [canWrite, setCanWrite] = useState(false)
  const [canEditTypes, setCanEditTypes] = useState(false)
  const [typeMonths, setTypeMonths] = useState({})
  const [savingTypes, setSavingTypes] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [draftDue, setDraftDue] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getAccessTokenFresh()
      if (!token) {
        toast.error('Sign in required')
        return
      }
      const q = new URLSearchParams({ status: 'active' })
      if (branchFilter && branchFilter !== 'all') q.set('branch', branchFilter)
      const res = await fetch(`/api/maintenance-schedules?${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error || 'Unable to load maintenance schedules')
        return
      }
      setSchedules(body.schedules || [])
      setCanWrite(Boolean(body.canWrite))
      setCanEditTypes(Boolean(body.canEditTypes))

      const bySlug = new Map((body.services || []).map((s) => [String(s.slug || '').toLowerCase(), s]))
      const next = {}
      for (const t of DETAILING_SCHEDULE_TYPES) {
        const svc = bySlug.get(t.slug)
        next[t.slug] = resolveFrequencyMonthsFromSettings(
          body.settings || [],
          svc?.id,
          null,
          t.defaultMonths,
        )
      }
      setTypeMonths(next)

      const dues = {}
      for (const row of body.schedules || []) {
        dues[row.id] = String(row.next_due_at || '').slice(0, 10)
      }
      setDraftDue(dues)
    } finally {
      setLoading(false)
    }
  }, [branchFilter])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    if (filter === 'all') return schedules
    return schedules.filter((row) => maintenanceUrgency(row.next_due_at) === filter)
  }, [schedules, filter])

  const counts = useMemo(() => {
    const c = { all: schedules.length, overdue: 0, due_soon: 0, upcoming: 0 }
    for (const row of schedules) {
      const u = maintenanceUrgency(row.next_due_at)
      if (u in c) c[u] += 1
    }
    return c
  }, [schedules])

  async function saveTypeIntervals() {
    setSavingTypes(true)
    try {
      const token = await getAccessTokenFresh()
      if (!token) return toast.error('Sign in required')
      const res = await fetch('/api/maintenance-schedules', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          types: DETAILING_SCHEDULE_TYPES.map((t) => ({
            slug: t.slug,
            frequency_months: Number(typeMonths[t.slug]) || t.defaultMonths,
            channel: 'both',
          })),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error || 'Unable to save intervals')
        return
      }
      toast.success('Detailing reminder intervals saved')
      load()
    } finally {
      setSavingTypes(false)
    }
  }

  async function patchSchedule(id, payload) {
    setBusyId(id)
    try {
      const token = await getAccessTokenFresh()
      if (!token) return toast.error('Sign in required')
      const res = await fetch('/api/maintenance-schedules', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id, ...payload }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error || 'Unable to update schedule')
        return
      }
      toast.success('Schedule updated')
      load()
    } finally {
      setBusyId(null)
    }
  }

  async function sendReminder(id, force = false) {
    setBusyId(id)
    try {
      const token = await getAccessTokenFresh()
      if (!token) return toast.error('Sign in required')
      const res = await fetch('/api/maintenance-schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id, force }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error || 'Unable to send reminder')
        return
      }
      const sms = body.notify?.sms?.ok ? ' · SMS sent' : ''
      const push = body.notify?.push?.sent ? ' · Push sent' : ''
      toast.success(`Client notified${sms}${push}`)
      load()
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Loading maintenance schedules…
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <aside className="rounded-2xl border border-primary/20 bg-primary/[0.05] px-4 py-3 text-sm leading-relaxed">
        <p className="flex items-start gap-2 font-medium text-foreground">
          <Wrench className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          Paint maintenance program
        </p>
        <p className="mt-1 text-muted-foreground">
          Ceramic and PPF enroll one reminder per plate. Completing{' '}
          <span className="font-medium text-foreground">Paint Maintenance</span> resets the clock. Stage moves on the
          Board already SMS/push the client — use this tab for due dates and maintenance reminders.
        </p>
      </aside>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold tracking-wide text-foreground uppercase">Schedule by detailing type</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Months until the next maintenance reminder after enroll or reset.
            </p>
          </div>
          {canEditTypes ? (
            <Button
              type="button"
              size="sm"
              className="min-h-11 cursor-pointer gap-2"
              disabled={savingTypes}
              onClick={saveTypeIntervals}
            >
              {savingTypes ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
              Save intervals
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Super Admin sets type intervals.</p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {DETAILING_SCHEDULE_TYPES.map((t) => (
            <label
              key={t.slug}
              className="flex flex-col gap-2 rounded-xl border border-border bg-background px-3 py-3"
            >
              <span className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
                {t.shortLabel}
              </span>
              <span className="text-sm font-semibold text-foreground">{t.label}</span>
              <span className="text-[11px] text-muted-foreground">
                {t.role === 'enroll' ? 'Enrolls vehicle' : 'Resets clock on complete'}
              </span>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={24}
                  disabled={!canEditTypes}
                  className="min-h-11"
                  value={typeMonths[t.slug] ?? t.defaultMonths}
                  onChange={(e) =>
                    setTypeMonths((prev) => ({ ...prev, [t.slug]: e.target.value }))
                  }
                  aria-label={`${t.label} interval months`}
                />
                <span className="shrink-0 text-xs text-muted-foreground">mo</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold tracking-wide text-foreground uppercase">Vehicle schedules</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Adjust due dates, cancel, or send a maintenance reminder to the client.
            </p>
          </div>
          <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Filter by urgency">
            {[
              ['all', 'All'],
              ['overdue', 'Overdue'],
              ['due_soon', 'Due soon'],
              ['upcoming', 'Upcoming'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  'min-h-10 cursor-pointer rounded-full border px-3 text-xs font-semibold transition',
                  filter === id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
              >
                {label}{' '}
                <span className="tabular-nums opacity-70">{counts[id] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        {!visible.length ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            No active maintenance schedules{branchFilter !== 'all' ? ' for this branch' : ''}. Complete Ceramic or PPF
            to enroll a plate.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {visible.map((row) => {
              const urgency = maintenanceUrgency(row.next_due_at)
              const days = daysUntilDue(row.next_due_at)
              const busy = busyId === row.id
              return (
                <li
                  key={row.id}
                  className={cn(
                    'rounded-xl border border-border bg-background p-3 sm:p-4',
                    urgency === 'overdue' && 'border-destructive/40',
                    urgency === 'due_soon' && 'border-amber-500/40',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-foreground">
                        {row.plate_number || 'No plate'}
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          {row.customer_name || '—'}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.service_slug?.replace(/-/g, ' ') || 'detailing'} · {row.branch_slug || '—'} ·{' '}
                        {row.status}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'shrink-0',
                        urgency === 'overdue' && 'bg-destructive/15 text-destructive',
                        urgency === 'due_soon' && 'bg-amber-500/15 text-amber-900 dark:text-amber-100',
                      )}
                    >
                      {URGENCY_LABEL[urgency]}
                      {days != null ? ` · ${days < 0 ? `${Math.abs(days)}d late` : `${days}d`}` : ''}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <div className="min-w-[10rem] flex-1">
                      <Label htmlFor={`due-${row.id}`} className="text-[10px] font-bold tracking-wider uppercase">
                        Next due
                      </Label>
                      <Input
                        id={`due-${row.id}`}
                        type="date"
                        className="mt-1 min-h-11"
                        disabled={!canWrite || busy}
                        value={draftDue[row.id] || ''}
                        onChange={(e) => setDraftDue((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      />
                    </div>
                    {canWrite ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11 cursor-pointer gap-1.5"
                          disabled={busy || draftDue[row.id] === String(row.next_due_at || '').slice(0, 10)}
                          onClick={() => patchSchedule(row.id, { next_due_at: draftDue[row.id] })}
                        >
                          <CalendarClock className="size-4" aria-hidden />
                          Set date
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="min-h-11 cursor-pointer gap-1.5"
                          disabled={busy}
                          onClick={() => sendReminder(row.id, row.status !== 'scheduled')}
                        >
                          {busy ? (
                            <LoaderCircle className="size-4 animate-spin" aria-hidden />
                          ) : (
                            <BellRing className="size-4" aria-hidden />
                          )}
                          Notify client
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-11 cursor-pointer text-muted-foreground"
                          disabled={busy}
                          onClick={() => patchSchedule(row.id, { status: 'cancelled' })}
                        >
                          Cancel schedule
                        </Button>
                      </div>
                    ) : (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Send className="size-3.5" aria-hidden />
                        View only — ask Admin to adjust
                      </p>
                    )}
                  </div>
                  {row.last_notified_at ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Last notified {new Date(row.last_notified_at).toLocaleString()}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
