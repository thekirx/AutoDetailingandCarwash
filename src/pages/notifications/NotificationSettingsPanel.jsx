import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  Loader2,
  Monitor,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Smartphone,
  TabletSmartphone,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import PushToggle from '@/components/PushToggle'
import { getAccessTokenFresh } from '@/lib/authToken'
import { formatBusybeeBalance } from '@/lib/busybeeHealth'
import {
  BOOKING_STATUS_CONFIG_META,
  STATUS_SMS_SCOPES,
  createDefaultNotificationConfig,
  normalizeNotificationConfig,
} from '@/lib/notificationConfig'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

function ToggleSwitch({ id, checked, disabled, label, onChange }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'pointer-events-none block size-5 rounded-full bg-background shadow-sm transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

function SettingRow({ id, title, description, checked, disabled, badge, onChange, children }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/70 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={id} className="cursor-pointer text-sm font-semibold text-foreground">
            {title}
          </Label>
          {badge}
        </div>
        {description ? <p className="text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
        {children}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 self-end sm:self-center">
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {checked ? 'Active' : 'Paused'}
        </span>
        <ToggleSwitch id={id} checked={checked} disabled={disabled} label={title} onChange={onChange} />
      </div>
    </div>
  )
}

function formatManilaTime(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const EVENT_STATUS_STYLES = {
  sent: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  disabled: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  skipped: 'border-border bg-muted text-muted-foreground',
  opted_out: 'border-border bg-muted text-muted-foreground',
  failed: 'border-destructive/40 bg-destructive/10 text-destructive',
}

export default function NotificationSettingsPanel({
  smsHealth: parentSmsHealth = null,
  onSyncExternal = null,
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [canEdit, setCanEdit] = useState(false)

  const [savedConfig, setSavedConfig] = useState(() => createDefaultNotificationConfig())
  const [draft, setDraft] = useState(() => createDefaultNotificationConfig())
  const [providerHealth, setProviderHealth] = useState(parentSmsHealth)
  const [pushStats, setPushStats] = useState(null)
  const [automationSummary, setAutomationSummary] = useState(null)
  const [recentEvents, setRecentEvents] = useState([])

  const [testPhone, setTestPhone] = useState('')
  const [sendingSmsTest, setSendingSmsTest] = useState(false)
  const [pushTestScope, setPushTestScope] = useState('self')
  const [activeNotifTest, setActiveNotifTest] = useState('')
  const [lastNotifResult, setLastNotifResult] = useState(null)
  const [runningJob, setRunningJob] = useState(null)

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(savedConfig),
    [draft, savedConfig],
  )

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/notification-config', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not load notification configuration.')
      const normalized = normalizeNotificationConfig(data.config)
      setSavedConfig(normalized)
      setDraft(normalized)
      setCanEdit(Boolean(data.can_edit))
      setProviderHealth(data.provider_health || parentSmsHealth || null)
      setPushStats(data.push_stats || null)
      setAutomationSummary(data.automation_summary || null)
      setRecentEvents(Array.isArray(data.recent_sms_events) ? data.recent_sms_events : [])
      setTestPhone((prev) => prev || data.caller_phone || '')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [parentSmsHealth])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  async function saveChanges() {
    if (!canEdit) return
    setSaving(true)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/notification-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ config: draft }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save configuration.')
      const normalized = normalizeNotificationConfig(data.config)
      setSavedConfig(normalized)
      setDraft(normalized)
      toast.success('Notification settings updated.')
      if (onSyncExternal) await onSyncExternal()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function resetDefaults() {
    if (!canEdit) return
    setResetting(true)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/notification-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'reset_defaults' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Reset failed.')
      const normalized = normalizeNotificationConfig(data.config)
      setSavedConfig(normalized)
      setDraft(normalized)
      toast.success('Notification configuration restored to defaults.')
      if (onSyncExternal) await onSyncExternal()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setResetting(false)
    }
  }

  async function runStatusSmsVerification(e) {
    e.preventDefault()
    if (!canEdit) return
    setSendingSmsTest(true)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/notification-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: 'send_status_sms_test',
          phone: testPhone,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || data.sms?.providerResponse || 'Status SMS test failed.')
      if (data.provider_health) setProviderHealth(data.provider_health)
      toast.success('Status SMS verification test sent via BusyBee.')
      await loadConfig()
      if (onSyncExternal) await onSyncExternal()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSendingSmsTest(false)
    }
  }

  async function runVapidPushTest(platform = 'all') {
    if (!canEdit) return
    setActiveNotifTest(`vapid_${platform}`)
    setLastNotifResult(null)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/notification-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: 'test_vapid_push',
          platform,
          scope: pushTestScope,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data.error || 'VAPID push test failed.'
        setLastNotifResult({ ok: false, kind: 'vapid', platform, message: msg, data })
        throw new Error(msg)
      }
      const platformName =
        platform === 'ios'
          ? 'Mobile iOS'
          : platform === 'android'
            ? 'Mobile Android'
            : platform === 'web'
              ? 'Web Browser'
              : 'All Platforms'
      if ((data.subscriptions || 0) === 0) {
        const hint =
          platform === 'ios'
            ? 'No iOS Home Screen subscription enrolled for this scope yet. Open Hakum in iPhone Safari → Share → Add to Home Screen → Alerts on.'
            : platform === 'android'
              ? 'No Android Chrome/PWA subscription enrolled for this scope yet. Open Hakum on Android Chrome → Alerts on.'
              : platform === 'web'
                ? 'No desktop browser subscription enrolled for this scope yet. Click Enable alerts in the header first.'
                : 'No push subscriptions enrolled for this scope yet. Enable alerts on this device first.'
        setLastNotifResult({ ok: false, kind: 'vapid', platform, message: hint, data })
        toast.info(hint)
      } else {
        const summary = `${platformName} VAPID test: ${data.sent || 0} sent · ${data.failed || 0} failed${data.pruned ? ` · ${data.pruned} expired pruned` : ''}`
        setLastNotifResult({
          ok: (data.sent || 0) > 0 && (data.failed || 0) === 0,
          kind: 'vapid',
          platform,
          message: summary,
          data,
        })
        if ((data.sent || 0) > 0) toast.success(summary)
        else toast.error(`${summary}${data.failures?.[0]?.message ? ` (${data.failures[0].message})` : ''}`)
        await loadConfig()
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActiveNotifTest('')
    }
  }

  async function runInAppNotificationTest() {
    if (!canEdit) return
    setActiveNotifTest('in_app')
    setLastNotifResult(null)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/notification-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'test_in_app' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'In-app notification test failed.')
      const msg = 'In-App notification inserted — check the foreground toast, chime, and top-right Bell badge.'
      setLastNotifResult({ ok: true, kind: 'in_app', message: msg, data })
      toast.success('In-App notification triggered via Realtime.')
    } catch (err) {
      setLastNotifResult({ ok: false, kind: 'in_app', message: err.message })
      toast.error(err.message)
    } finally {
      setActiveNotifTest('')
    }
  }

  async function triggerJob(jobKey, endpoint) {
    setRunningJob(jobKey)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: '{}',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Automation run failed.')
      if (data.skipped || data.customers?.skipped) {
        const reason = data.reason || data.customers?.reason
        toast.info(
          reason === 'quiet_hours'
            ? 'Skipped — Manila Quiet Hours are currently active.'
            : 'Skipped — automation toggle is paused in settings.',
        )
        return
      }
      if (jobKey === 'booking') {
        toast.success(
          `Booking check done · ${data.sent || 0} detailing reminder${data.sent === 1 ? '' : 's'}, ${data.rateVisit?.sent || 0} review nudge${data.rateVisit?.sent === 1 ? '' : 's'}`,
        )
      } else if (jobKey === 'maintenance') {
        toast.success(
          `Paint maintenance check done · ${data.due || 0} due, ${data.sent || 0} push sent`,
        )
      } else if (jobKey === 'birthday') {
        const count = Number(data.customers?.scanned ?? data.scanned ?? 0) + Number(data.staff?.scanned ?? 0)
        toast.success(`Birthday check done · ${count} match${count === 1 ? '' : 'es'} today`)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setRunningJob(null)
    }
  }

  function setField(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function setScope(scopeKey, value) {
    setDraft((prev) => ({
      ...prev,
      sms_scopes: { ...prev.sms_scopes, [scopeKey]: value },
    }))
  }

  function setStatusSms(statusKey, value) {
    setDraft((prev) => ({
      ...prev,
      sms_statuses: { ...prev.sms_statuses, [statusKey]: value },
    }))
  }

  function setAllStatuses(value) {
    setDraft((prev) => {
      const next = { ...prev.sms_statuses }
      for (const meta of BOOKING_STATUS_CONFIG_META) next[meta.status] = value
      return { ...prev, sms_statuses: next }
    })
  }

  const effectiveHealth = providerHealth || parentSmsHealth
  const balanceText = formatBusybeeBalance(effectiveHealth)
  const enabledStatusesCount = BOOKING_STATUS_CONFIG_META.filter(
    (item) => draft.sms_statuses[item.status] !== false,
  ).length

  if (loading && !pushStats) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin text-primary" aria-hidden />
        Loading notification settings &amp; diagnostics…
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Top Action Bar for Save / Discard / Refresh */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold tracking-tight text-foreground">
              Owner Notification Controls
            </h2>
            {canEdit ? (
              isDirty ? (
                <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  Unsaved changes
                </Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  Synced
                </Badge>
              )
            ) : (
              <Badge variant="secondary">Read-only (Super Admin required to edit)</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Manage global SMS &amp; Push delivery, Detailing / Services / Packages status rules, quiet hours, and cron health.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 cursor-pointer"
            disabled={loading || saving}
            onClick={loadConfig}
          >
            <RefreshCw className={cn('mr-1.5 size-3.5', loading && 'animate-spin')} aria-hidden />
            Refresh
          </Button>
          {canEdit ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 cursor-pointer"
                disabled={resetting || saving}
                onClick={resetDefaults}
              >
                <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
                {resetting ? 'Resetting…' : 'Reset defaults'}
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-h-10 cursor-pointer font-semibold"
                disabled={!isDirty || saving}
                onClick={saveChanges}
              >
                <Save className="mr-1.5 size-3.5" aria-hidden />
                {saving ? 'Saving…' : 'Save settings'}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* Main Two-Column Grid */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)] lg:items-start">
        {/* Left Column: Policy & Channel Switches */}
        <div className="space-y-5">
          {/* Card 1: Master Channel Controls */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <ShieldCheck className="size-4 text-primary" aria-hidden />
                Global Channel Delivery
              </CardTitle>
              <CardDescription className="text-xs">
                Master gates across BusyBee SMS and Web Push. Disabling Push leaves In-App Inbox messages active.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <SettingRow
                id="cfg-sms-master"
                title="Customer Booking Status SMS (BusyBee)"
                description="Sends live BusyBee BrandTxt updates for Detailing, Services & Packages booking and floor queue changes."
                checked={draft.sms_enabled}
                disabled={!canEdit}
                badge={
                  <Badge variant={draft.sms_enabled ? 'default' : 'secondary'} className="text-[11px]">
                    {draft.sms_enabled ? 'SMS Enabled' : 'SMS Paused'}
                  </Badge>
                }
                onChange={(v) => setField('sms_enabled', v)}
              >
                <div className="mt-2 flex flex-wrap items-center gap-2 pt-1">
                  <Label htmlFor="cfg-sender-id" className="text-xs font-medium text-muted-foreground">
                    Sender ID
                  </Label>
                  <Input
                    id="cfg-sender-id"
                    value={draft.sms_sender_id}
                    disabled={!canEdit}
                    maxLength={11}
                    onChange={(e) => setField('sms_sender_id', e.target.value.toUpperCase())}
                    className="h-8 w-32 font-mono text-xs uppercase"
                  />
                  <span className="text-[11px] text-muted-foreground">3–11 chars (registered BrandTxt ID)</span>
                </div>
              </SettingRow>

              <SettingRow
                id="cfg-push-master"
                title="Web Push Delivery (Staff & Customers)"
                description="Dispatches real-time browser and PWA notifications across branch floor, ops leads, and customer accounts."
                checked={draft.push_notifications_enabled}
                disabled={!canEdit}
                onChange={(v) => setField('push_notifications_enabled', v)}
              />
            </CardContent>
          </Card>

          {/* Card 2: Status SMS Scope & Booking Stage Matrix */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <Smartphone className="size-4 text-primary" aria-hidden />
                    Status SMS Policy &amp; Stage Triggers
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Select which service lines and lifecycle stages emit BusyBee SMS. Merch, coffee, accessories &amp; vouchers are always blocked from SMS.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="tabular-nums text-xs">
                  {enabledStatusesCount}/{BOOKING_STATUS_CONFIG_META.length} stages active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              <div className="divide-y divide-border/70 border-y border-border/70">
                {STATUS_SMS_SCOPES.map((scope) => (
                  <SettingRow
                    key={scope.id}
                    id={`cfg-scope-${scope.id}`}
                    title={scope.label}
                    description={scope.description}
                    checked={draft.sms_scopes[scope.id] !== false}
                    disabled={!canEdit || !draft.sms_enabled}
                    onChange={(v) => setScope(scope.id, v)}
                  />
                ))}
              </div>

              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    Per-status SMS triggers (Push + Inbox stay active even if SMS is off)
                  </span>
                  {canEdit ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="cursor-pointer text-xs font-medium text-primary hover:underline disabled:opacity-50"
                        disabled={!draft.sms_enabled}
                        onClick={() => setAllStatuses(true)}
                      >
                        Enable all
                      </button>
                      <span className="text-muted-foreground">/</span>
                      <button
                        type="button"
                        className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
                        disabled={!draft.sms_enabled}
                        onClick={() => {
                          for (const item of BOOKING_STATUS_CONFIG_META) {
                            setStatusSms(
                              item.status,
                              ['confirmed', 'for_payment', 'completed', 'cancelled'].includes(item.status),
                            )
                          }
                        }}
                      >
                        Essential only
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {BOOKING_STATUS_CONFIG_META.map((item) => {
                    const checked = draft.sms_statuses[item.status] !== false
                    return (
                      <div
                        key={item.status}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <Label
                            htmlFor={`cfg-status-${item.status}`}
                            className="block cursor-pointer truncate text-xs font-semibold text-foreground"
                          >
                            {item.label}
                          </Label>
                          <p className="truncate text-[11px] text-muted-foreground">{item.stage}</p>
                        </div>
                        <ToggleSwitch
                          id={`cfg-status-${item.status}`}
                          checked={checked}
                          disabled={!canEdit || !draft.sms_enabled}
                          label={`${item.label} SMS trigger`}
                          onChange={(v) => setStatusSms(item.status, v)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Scheduled Push Automations & Manila Quiet Hours */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Clock className="size-4 text-primary" aria-hidden />
                Automated Push Programs &amp; Quiet Hours
              </CardTitle>
              <CardDescription className="text-xs">
                Control background cron notifications and Manila time quiet windows. Scheduled jobs defer during quiet hours; live checkout/payment alerts send immediately.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <SettingRow
                id="cfg-booking-reminders"
                title="Detailing 7 / 3 / 1-Day Advance Reminders"
                description="Notifies customers via Web Push + Inbox before scheduled ceramic coating, tint, or PPF appointments."
                checked={draft.booking_reminders_enabled}
                disabled={!canEdit}
                onChange={(v) => setField('booking_reminders_enabled', v)}
              />
              <SettingRow
                id="cfg-maint-reminders"
                title="6-Month Paint Maintenance Reminders"
                description="Enrolls Ceramic & PPF plates on a recurring 6-month cycle using your custom Reminders rules."
                checked={draft.maintenance_reminders_enabled}
                disabled={!canEdit}
                badge={
                  automationSummary ? (
                    <Badge variant="secondary" className="tabular-nums text-[11px]">
                      {automationSummary.active_reminder_rules} active rules
                    </Badge>
                  ) : null
                }
                onChange={(v) => setField('maintenance_reminders_enabled', v)}
              />
              <SettingRow
                id="cfg-birthdays"
                title="Daily Birthday Perks & Greetings"
                description="Issues 7-day birthday freebies and greetings to matched customers and active staff."
                checked={draft.birthday_greetings_enabled}
                disabled={!canEdit}
                onChange={(v) => setField('birthday_greetings_enabled', v)}
              />
              <SettingRow
                id="cfg-rate-visit"
                title="Post-Visit Review Prompt (+15 min)"
                description="Schedules visit rating reminders inside the 6-hour post-completion window."
                checked={draft.rate_visit_enabled}
                disabled={!canEdit}
                onChange={(v) => setField('rate_visit_enabled', v)}
              />
              <SettingRow
                id="cfg-quiet-hours"
                title="Manila Quiet Hours (UTC+8)"
                description="Pauses background reminder and birthday crons overnight while keeping bay status alerts live."
                checked={draft.quiet_hours_enabled}
                disabled={!canEdit}
                onChange={(v) => setField('quiet_hours_enabled', v)}
              >
                <div className="mt-2 flex flex-wrap items-center gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="cfg-quiet-start" className="text-xs text-muted-foreground">
                      From
                    </Label>
                    <Input
                      id="cfg-quiet-start"
                      type="time"
                      value={draft.quiet_hours_start}
                      disabled={!canEdit || !draft.quiet_hours_enabled}
                      onChange={(e) => setField('quiet_hours_start', e.target.value)}
                      className="h-8 w-28 tabular-nums text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="cfg-quiet-end" className="text-xs text-muted-foreground">
                      Until
                    </Label>
                    <Input
                      id="cfg-quiet-end"
                      type="time"
                      value={draft.quiet_hours_end}
                      disabled={!canEdit || !draft.quiet_hours_enabled}
                      onChange={(e) => setField('quiet_hours_end', e.target.value)}
                      className="h-8 w-28 tabular-nums text-xs"
                    />
                  </div>
                </div>
              </SettingRow>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Diagnostics, Verification & Ledger */}
        <div className="space-y-5">
          {/* Card 4: BusyBee Wallet & Status SMS Health Verification */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Wallet className="size-4 text-primary" aria-hidden />
                BusyBee Gateway &amp; Verification
              </CardTitle>
              <CardDescription className="text-xs">
                {canEdit
                  ? 'Live BrandTxt balance and single-click Status SMS health check for Super Admin.'
                  : 'Gateway status overview (Super Admin credentials and test controls are restricted).'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline justify-between border-b border-border/70 pb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Available SMS Balance</p>
                  <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                    {canEdit ? balanceText || (effectiveHealth?.configured ? 'Checking…' : 'Not configured') : 'Protected'}
                  </p>
                </div>
                <Badge variant={effectiveHealth?.configured ? 'default' : 'secondary'}>
                  Sender: {draft.sms_sender_id}
                </Badge>
              </div>

              {canEdit ? (
                <form onSubmit={runStatusSmsVerification} className="space-y-2.5">
                  <Label htmlFor="cfg-test-phone" className="text-xs font-semibold">
                    Send Status SMS Verification Test (20s cooldown)
                  </Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="cfg-test-phone"
                      type="tel"
                      placeholder="09171234567"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      className="min-h-10 flex-1 tabular-nums text-sm"
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      className="min-h-10 cursor-pointer font-semibold"
                      disabled={sendingSmsTest || !testPhone.trim()}
                    >
                      <Send className="mr-1.5 size-3.5 text-primary" aria-hidden />
                      {sendingSmsTest ? 'Sending…' : 'Test Status SMS'}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Dispatches a standard Status SMS health confirmation to verify live BrandTxt routing and deducts 1 credit.
                  </p>
                </form>
              ) : null}
            </CardContent>
          </Card>

          {/* Card 5: Web Push (VAPID), In-App & Platform Verification */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <BellRing className="size-4 text-primary" aria-hidden />
                    Push (VAPID), In-App &amp; Platform Tests
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {pushStats?.total_subscriptions ?? 0} total active devices ({pushStats?.staff_subscriptions ?? 0} staff ·{' '}
                    {pushStats?.customer_subscriptions ?? 0} customer)
                  </CardDescription>
                </div>
                <PushToggle audience="ops" compact surface="light" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              {(() => {
                const vapid = pushStats?.vapid || {}
                const clientVapidPrefix = String(import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim().slice(0, 10)
                const clientMatched =
                  Boolean(clientVapidPrefix) &&
                  (!vapid.serverPublicKeyPrefix || clientVapidPrefix === vapid.serverPublicKeyPrefix)
                const counts =
                  pushTestScope === 'staff'
                    ? pushStats?.staff_platforms || { web: 0, android: 0, ios: 0 }
                    : pushStats?.caller_platforms || { web: 0, android: 0, ios: 0 }

                return (
                  <>
                    <div className="flex flex-wrap items-center gap-2 border-b border-border/70 pb-3 text-xs">
                      <Badge
                        variant={pushStats?.vapid_configured ? 'outline' : 'destructive'}
                        className={
                          pushStats?.vapid_configured
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : ''
                        }
                      >
                        {pushStats?.vapid_configured ? 'VAPID Server Ready' : 'VAPID Missing / Invalid'}
                      </Badge>
                      <Badge
                        variant={clientMatched ? 'outline' : 'destructive'}
                        className={
                          clientMatched
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : ''
                        }
                      >
                        {clientMatched
                          ? `Client Key (${clientVapidPrefix}…)`
                          : clientVapidPrefix
                            ? 'Client/Server Key Mismatch'
                            : 'Missing VITE_VAPID_PUBLIC_KEY'}
                      </Badge>
                      <Badge variant="secondary" className="tabular-nums">
                        Web {pushStats?.by_platform?.web ?? 0} · Android {pushStats?.by_platform?.android ?? 0} · iOS{' '}
                        {pushStats?.by_platform?.ios ?? 0}
                      </Badge>
                      {vapid.error ? <p className="w-full text-destructive">{vapid.error}</p> : null}
                    </div>

                    {canEdit ? (
                      <div className="space-y-3 border-b border-border/70 pb-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            Run live delivery verification
                          </span>
                          <div
                            className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-[11px]"
                            role="group"
                            aria-label="Push test scope"
                          >
                            <button
                              type="button"
                              className={cn(
                                'cursor-pointer rounded-md px-2.5 py-1 font-semibold transition',
                                pushTestScope === 'self'
                                  ? 'bg-background text-foreground shadow-xs'
                                  : 'text-muted-foreground hover:text-foreground',
                              )}
                              onClick={() => setPushTestScope('self')}
                            >
                              My Owner devices
                            </button>
                            <button
                              type="button"
                              className={cn(
                                'cursor-pointer rounded-md px-2.5 py-1 font-semibold transition',
                                pushTestScope === 'staff'
                                  ? 'bg-background text-foreground shadow-xs'
                                  : 'text-muted-foreground hover:text-foreground',
                              )}
                              onClick={() => setPushTestScope('staff')}
                            >
                              Enrolled staff
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-10 cursor-pointer justify-start text-xs font-semibold"
                            disabled={Boolean(activeNotifTest)}
                            onClick={runInAppNotificationTest}
                          >
                            <Bell className="mr-2 size-3.5 text-primary" aria-hidden />
                            {activeNotifTest === 'in_app' ? 'Triggering…' : 'Test In-App Alert & Bell'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-10 cursor-pointer justify-between text-xs font-semibold"
                            disabled={Boolean(activeNotifTest)}
                            onClick={() => runVapidPushTest('web')}
                          >
                            <span className="flex items-center">
                              <Monitor className="mr-2 size-3.5 text-primary" aria-hidden />
                              {activeNotifTest === 'vapid_web' ? 'Sending…' : 'Test Web Browser'}
                            </span>
                            <Badge variant="secondary" className="ml-1 tabular-nums text-[10px]">
                              {counts.web}
                            </Badge>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-10 cursor-pointer justify-between text-xs font-semibold"
                            disabled={Boolean(activeNotifTest)}
                            onClick={() => runVapidPushTest('android')}
                          >
                            <span className="flex items-center">
                              <Smartphone className="mr-2 size-3.5 text-primary" aria-hidden />
                              {activeNotifTest === 'vapid_android' ? 'Sending…' : 'Test Mobile Android'}
                            </span>
                            <Badge variant="secondary" className="ml-1 tabular-nums text-[10px]">
                              {counts.android}
                            </Badge>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-10 cursor-pointer justify-between text-xs font-semibold"
                            disabled={Boolean(activeNotifTest)}
                            onClick={() => runVapidPushTest('ios')}
                          >
                            <span className="flex items-center">
                              <TabletSmartphone className="mr-2 size-3.5 text-primary" aria-hidden />
                              {activeNotifTest === 'vapid_ios' ? 'Sending…' : 'Test Mobile iOS'}
                            </span>
                            <Badge variant="secondary" className="ml-1 tabular-nums text-[10px]">
                              {counts.ios}
                            </Badge>
                          </Button>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="min-h-10 w-full cursor-pointer text-xs font-semibold"
                          disabled={Boolean(activeNotifTest)}
                          onClick={() => runVapidPushTest('all')}
                        >
                          <Send className="mr-1.5 size-3.5 text-primary" aria-hidden />
                          {activeNotifTest === 'vapid_all'
                            ? 'Dispatching VAPID across all platforms…'
                            : 'Test All Platforms (Web + Android + iOS)'}
                        </Button>

                        {lastNotifResult ? (
                          <div
                            role="status"
                            className={cn(
                              'rounded-lg border px-3 py-2 text-xs',
                              lastNotifResult.ok
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                                : 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300',
                            )}
                          >
                            <p className="font-medium">{lastNotifResult.message}</p>
                            {lastNotifResult.data?.failures?.length ? (
                              <ul className="mt-1 list-disc pl-4 text-[11px]">
                                {lastNotifResult.data.failures.map((f, idx) => (
                                  <li key={idx}>
                                    {f.platform} ({f.host}) · HTTP {f.statusCode || 'ERR'}: {f.message}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            iOS Web Push works only when opened from Safari → Share → Add to Home Screen (iOS 16.4+). In-App alerts trigger real-time bell counts, sound chime, and banner toasts across Web, Android, and iOS.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </>
                )
              })()}

              <div className="divide-y divide-border/70">
                {(pushStats?.by_role || []).map((row) => {
                  const pct = row.active_users > 0 ? Math.round((row.subscribed_users / row.active_users) * 100) : 0
                  return (
                    <div key={row.role} className="flex items-center justify-between gap-3 py-2 text-xs">
                      <span className="font-medium text-foreground">{row.label}</span>
                      <div className="flex items-center gap-2.5 tabular-nums">
                        <span className="text-muted-foreground">
                          {row.subscribed_users}/{row.active_users} enrolled ({row.subscriptions} dev)
                        </span>
                        <Badge
                          variant={row.subscribed_users > 0 ? 'outline' : 'secondary'}
                          className="w-12 justify-center tabular-nums text-[11px]"
                        >
                          {pct}%
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Card 6: Automation Runners & Recent SMS Ledger */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <CheckCircle2 className="size-4 text-primary" aria-hidden />
                Manual Automation Checks &amp; SMS Log
              </CardTitle>
              <CardDescription className="text-xs">
                Run due schedules immediately or audit recent BusyBee deliveries (last 4 digits masked).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                {[
                  { key: 'booking', label: 'Booking & Rate Reminders', endpoint: '/api/notifications?operation=booking-reminders' },
                  { key: 'maintenance', label: 'Paint Maintenance Due', endpoint: '/api/notifications?operation=maintenance-reminders' },
                  { key: 'birthday', label: 'Birthday Greetings', endpoint: '/api/notifications?operation=birthday-greetings' },
                ].map((job) => (
                  <div
                    key={job.key}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2"
                  >
                    <span className="text-xs font-semibold text-foreground">{job.label}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 cursor-pointer text-xs"
                      disabled={runningJob !== null}
                      onClick={() => triggerJob(job.key, job.endpoint)}
                    >
                      <Play className="mr-1 size-3 text-primary" aria-hidden />
                      {runningJob === job.key ? 'Running…' : 'Run now'}
                    </Button>
                  </div>
                ))}
              </div>

              {canEdit ? (
                <div className="space-y-2 border-t border-border/70 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Recent Status SMS Events</span>
                    <span className="tabular-nums text-[11px] text-muted-foreground">
                      Latest {recentEvents.length}
                    </span>
                  </div>
                  {!recentEvents.length ? (
                    <p className="text-xs text-muted-foreground">No SMS events recorded yet.</p>
                  ) : (
                    <div className="divide-y divide-border/70">
                      {recentEvents.slice(0, 8).map((ev) => (
                        <div key={ev.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {ev.event_type || 'status_sms'}{' '}
                              <span className="font-mono text-muted-foreground">{ev.phone_masked}</span>
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {formatManilaTime(ev.sent_at || ev.created_at)}
                              {ev.provider_response ? ` · ${ev.provider_response}` : ''}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              'shrink-0 text-[11px] capitalize',
                              EVENT_STATUS_STYLES[ev.status] || 'border-border text-foreground',
                            )}
                          >
                            {ev.status || 'unknown'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
