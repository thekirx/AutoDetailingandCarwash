import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  Copy,
  KeyRound,
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
  Terminal,
  Trash2,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import PushToggle from '@/components/PushToggle'
import { getAccessTokenFresh } from '@/lib/authToken'
import { formatBusybeeBalance } from '@/lib/busybeeHealth'
import {
  AUTOMATION_MODES,
  BOOKING_REMINDER_DAY_OPTIONS,
  BOOKING_STATUS_CONFIG_META,
  STATUS_SMS_SCOPES,
  buildPgCronSqlSnippet,
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
  const [automationState, setAutomationState] = useState(null)
  const [mintedWebhookToken, setMintedWebhookToken] = useState('')
  const [rotatingToken, setRotatingToken] = useState(false)
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
      setAutomationState(data.automation_state || null)
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
      } else if (jobKey === 'points_shop') {
        toast.success(
          `Points Shop expiry check done · ${data.expired || 0} expired, ${data.notified || 0} notified`,
        )
      } else if (jobKey === 'sweep') {
        const ran = Array.isArray(data.ran) ? data.ran.length : 0
        toast.success(
          ran
            ? `Due automation sweep finished · ran ${ran} job${ran === 1 ? '' : 's'}`
            : 'All scheduled automations are already up to date.',
        )
      }
      await loadConfig()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setRunningJob(null)
    }
  }

  async function manageWebhookToken(action) {
    if (!canEdit) return
    setRotatingToken(true)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/notification-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not update webhook scheduler token.')
      if (data.automation_state) setAutomationState(data.automation_state)
      if (action === 'rotate_automation_token' && data.token) {
        setMintedWebhookToken(data.token)
        toast.success('Webhook scheduler token generated. Copy it now — it is shown once.')
      } else {
        setMintedWebhookToken('')
        toast.success('Webhook scheduler token revoked.')
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setRotatingToken(false)
    }
  }

  function toggleReminderDay(day) {
    setDraft((prev) => {
      const current = Array.isArray(prev.booking_reminder_days) ? prev.booking_reminder_days : [7, 3, 1]
      const exists = current.includes(day)
      if (exists && current.length <= 1) return prev
      const next = exists ? current.filter((d) => d !== day) : [...current, day]
      next.sort((a, b) => b - a)
      return { ...prev, booking_reminder_days: next }
    })
  }

  function copyText(value, label) {
    if (!value) return
    navigator.clipboard?.writeText(value).then(
      () => toast.success(`${label} copied.`),
      () => toast.error('Copy failed — select and copy manually.'),
    )
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

          {/* Card 3: Scheduled Push Automations, Timing & Manila Quiet Hours */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Clock className="size-4 text-primary" aria-hidden />
                Automated Push Programs &amp; Cadence
              </CardTitle>
              <CardDescription className="text-xs">
                Configure how background automations run (Cron, Operations App Sweep, or Hybrid), edit reminder cadences, and set Manila quiet hours.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="space-y-2.5 rounded-lg border border-border/80 bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Automation Execution Engine</p>
                    <p className="text-[11px] text-muted-foreground">
                      Hybrid runs on scheduled cron (Vercel / Supabase pg_cron) plus automatic Operations sweeps.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="cfg-daily-hour" className="text-xs text-muted-foreground">
                      Daily Run (Manila)
                    </Label>
                    <select
                      id="cfg-daily-hour"
                      value={draft.daily_automation_hour_manila}
                      disabled={!canEdit}
                      onChange={(e) => setField('daily_automation_hour_manila', Number(e.target.value))}
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs tabular-nums text-foreground"
                    >
                      {Array.from({ length: 18 }, (_, i) => i + 5).map((h) => (
                        <option key={h} value={h}>
                          {String(h).padStart(2, '0')}:00
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-3">
                  {AUTOMATION_MODES.map((m) => {
                    const active = draft.automation_mode === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setField('automation_mode', m.id)}
                        className={cn(
                          'cursor-pointer rounded-lg border px-2.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60',
                          active
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border bg-background text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <p className="text-xs font-semibold text-foreground">{m.label}</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{m.description}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <SettingRow
                  id="cfg-booking-reminders"
                  title="Detailing Advance Reminders"
                  description="Notifies customers via Web Push + Inbox ahead of scheduled ceramic coating, tint, or PPF appointments."
                  checked={draft.booking_reminders_enabled}
                  disabled={!canEdit}
                  onChange={(v) => setField('booking_reminders_enabled', v)}
                >
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] text-muted-foreground">Lead days:</span>
                    {BOOKING_REMINDER_DAY_OPTIONS.map((day) => {
                      const selected = (draft.booking_reminder_days || []).includes(day)
                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={!canEdit || !draft.booking_reminders_enabled}
                          onClick={() => toggleReminderDay(day)}
                          className={cn(
                            'cursor-pointer rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums transition disabled:cursor-not-allowed disabled:opacity-50',
                            selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {day}d
                        </button>
                      )
                    })}
                  </div>
                </SettingRow>

                <SettingRow
                  id="cfg-maint-reminders"
                  title="Paint Maintenance Reminders"
                  description="Enrolls Ceramic & PPF vehicles on recurring cycles using your custom Reminders rules."
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
                >
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="cfg-maint-lead" className="text-[11px] text-muted-foreground">
                        Start lead (days)
                      </Label>
                      <Input
                        id="cfg-maint-lead"
                        type="number"
                        min={7}
                        max={60}
                        value={draft.maintenance_lead_days}
                        disabled={!canEdit || !draft.maintenance_reminders_enabled}
                        onChange={(e) => setField('maintenance_lead_days', Number(e.target.value))}
                        className="h-7 w-16 tabular-nums text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="cfg-maint-interval" className="text-[11px] text-muted-foreground">
                        Repeat (days)
                      </Label>
                      <Input
                        id="cfg-maint-interval"
                        type="number"
                        min={7}
                        max={90}
                        value={draft.maintenance_interval_days}
                        disabled={!canEdit || !draft.maintenance_reminders_enabled}
                        onChange={(e) => setField('maintenance_interval_days', Number(e.target.value))}
                        className="h-7 w-16 tabular-nums text-xs"
                      />
                    </div>
                  </div>
                </SettingRow>

                <SettingRow
                  id="cfg-birthdays"
                  title="Daily Birthday Perks & Greetings"
                  description="Issues 7-day birthday freebies and greetings to matched customers and active staff."
                  checked={draft.birthday_greetings_enabled}
                  disabled={!canEdit}
                  onChange={(v) => setField('birthday_greetings_enabled', v)}
                >
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 pt-0.5">
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-foreground">
                      <input
                        type="checkbox"
                        checked={draft.birthday_include_customers !== false}
                        disabled={!canEdit || !draft.birthday_greetings_enabled}
                        onChange={(e) => setField('birthday_include_customers', e.target.checked)}
                        className="size-3.5 accent-primary"
                      />
                      Customers (7-day voucher)
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-foreground">
                      <input
                        type="checkbox"
                        checked={draft.birthday_include_staff !== false}
                        disabled={!canEdit || !draft.birthday_greetings_enabled}
                        onChange={(e) => setField('birthday_include_staff', e.target.checked)}
                        className="size-3.5 accent-primary"
                      />
                      Active Staff (floor greeting)
                    </label>
                  </div>
                </SettingRow>

                <SettingRow
                  id="cfg-rate-visit"
                  title="Post-Visit Review Prompt"
                  description="Delivers Web Push + Inbox rating prompt after visit completion (runs every 15 min on sweep or pg_cron)."
                  checked={draft.rate_visit_enabled}
                  disabled={!canEdit}
                  onChange={(v) => setField('rate_visit_enabled', v)}
                >
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="cfg-rate-delay" className="text-[11px] text-muted-foreground">
                        Delay (min)
                      </Label>
                      <Input
                        id="cfg-rate-delay"
                        type="number"
                        min={5}
                        max={180}
                        value={draft.rate_visit_delay_minutes}
                        disabled={!canEdit || !draft.rate_visit_enabled}
                        onChange={(e) => setField('rate_visit_delay_minutes', Number(e.target.value))}
                        className="h-7 w-16 tabular-nums text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="cfg-rate-window" className="text-[11px] text-muted-foreground">
                        Window (hrs)
                      </Label>
                      <Input
                        id="cfg-rate-window"
                        type="number"
                        min={1}
                        max={24}
                        value={draft.rate_visit_window_hours}
                        disabled={!canEdit || !draft.rate_visit_enabled}
                        onChange={(e) => setField('rate_visit_window_hours', Number(e.target.value))}
                        className="h-7 w-16 tabular-nums text-xs"
                      />
                    </div>
                  </div>
                </SettingRow>

                <SettingRow
                  id="cfg-points-expiry"
                  title="Points Shop Pickup Expiry & Reminders"
                  description="Refunds expired 10-day merch claims and nudges customers before pickup expiry."
                  checked={draft.points_shop_expiry_enabled}
                  disabled={!canEdit}
                  onChange={(v) => setField('points_shop_expiry_enabled', v)}
                >
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 pt-0.5">
                    <Label htmlFor="cfg-points-notice" className="text-[11px] text-muted-foreground">
                      Reminder before expiry (days)
                    </Label>
                    <Input
                      id="cfg-points-notice"
                      type="number"
                      min={1}
                      max={5}
                      value={draft.points_shop_expiry_notice_days}
                      disabled={!canEdit || !draft.points_shop_expiry_enabled}
                      onChange={(e) => setField('points_shop_expiry_notice_days', Number(e.target.value))}
                      className="h-7 w-14 tabular-nums text-xs"
                    />
                  </div>
                </SettingRow>

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
              </div>
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

          {/* Card 6: Automation Scheduler, Telemetry & Recent SMS Ledger */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <CheckCircle2 className="size-4 text-primary" aria-hidden />
                Automation Scheduler &amp; SMS Log
              </CardTitle>
              <CardDescription className="text-xs">
                Inspect last run times, trigger any automation manually, or connect Supabase pg_cron 15-minute scheduling.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <Badge
                    variant="outline"
                    className={
                      automationState?.cron_secret_configured
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    }
                  >
                    {automationState?.cron_secret_configured ? 'CRON_SECRET Ready' : 'CRON_SECRET Unset'}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      automationState?.webhook_configured
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'border-border text-muted-foreground'
                    }
                  >
                    {automationState?.webhook_configured
                      ? `Webhook ••••${automationState.webhook_token_hint || '••••'}`
                      : 'No Webhook Token'}
                  </Badge>
                  <Badge variant="secondary" className="text-[11px]">
                    {draft.automation_mode === 'cron_only' ? 'App Sweep Off' : 'Coded Sweep Active'}
                  </Badge>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 cursor-pointer text-xs font-semibold"
                  disabled={runningJob !== null || !canEdit}
                  onClick={() => triggerJob('sweep', '/api/notifications?operation=automation-sweep')}
                >
                  <Play className="mr-1 size-3 text-primary" aria-hidden />
                  {runningJob === 'sweep' ? 'Sweeping…' : 'Run Due Sweep'}
                </Button>
              </div>

              <div className="grid gap-2">
                {[
                  {
                    key: 'booking',
                    stateKeys: ['booking_reminders', 'rate_visit'],
                    label: 'Booking & Post-Visit Review',
                    endpoint: '/api/notifications?operation=booking-reminders',
                  },
                  {
                    key: 'maintenance',
                    stateKeys: ['maintenance_reminders'],
                    label: 'Paint Maintenance Due',
                    endpoint: '/api/notifications?operation=maintenance-reminders',
                  },
                  {
                    key: 'birthday',
                    stateKeys: ['birthday_greetings'],
                    label: 'Birthday Greetings',
                    endpoint: '/api/notifications?operation=birthday-greetings',
                  },
                  {
                    key: 'points_shop',
                    stateKeys: ['points_shop_expiry'],
                    label: 'Points Shop Pickup Expiry',
                    endpoint: '/api/notifications?operation=points-shop-expiry',
                  },
                ].map((job) => {
                  const primaryState = automationState?.jobs?.[job.stateKeys[0]]
                  const reviewState = job.stateKeys[1] ? automationState?.jobs?.[job.stateKeys[1]] : null
                  return (
                    <div
                      key={job.key}
                      className="flex flex-col gap-2 rounded-lg border border-border/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground">{job.label}</span>
                          {primaryState?.last_trigger ? (
                            <Badge variant="outline" className="text-[10px]">
                              {primaryState.last_trigger}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {primaryState?.last_run_at
                            ? `Last: ${formatManilaTime(primaryState.last_run_at)}${primaryState.last_summary ? ` · ${primaryState.last_summary}` : ''}`
                            : 'No run recorded yet'}
                        </p>
                        {reviewState?.last_run_at ? (
                          <p className="truncate text-[11px] text-muted-foreground">
                            Review nudge: {formatManilaTime(reviewState.last_run_at)}
                            {reviewState.last_summary ? ` · ${reviewState.last_summary}` : ''}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0 cursor-pointer self-end text-xs sm:self-center"
                        disabled={runningJob !== null}
                        onClick={() => triggerJob(job.key, job.endpoint)}
                      >
                        <Play className="mr-1 size-3 text-primary" aria-hidden />
                        {runningJob === job.key ? 'Running…' : 'Run now'}
                      </Button>
                    </div>
                  )
                })}
              </div>

              {canEdit ? (
                <div className="space-y-3 border-t border-border/70 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Terminal className="size-3.5 text-primary" aria-hidden />
                        Supabase pg_cron &amp; Webhook Token
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Generate a hashed Bearer token so Supabase pg_cron or any scheduler can trigger 15-min sweeps without Vercel Pro.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 cursor-pointer text-xs"
                        disabled={rotatingToken}
                        onClick={() => manageWebhookToken('rotate_automation_token')}
                      >
                        <KeyRound className="mr-1 size-3 text-primary" aria-hidden />
                        {rotatingToken ? 'Working…' : automationState?.webhook_configured ? 'Rotate Token' : 'Generate Token'}
                      </Button>
                      {automationState?.webhook_configured ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 cursor-pointer text-xs text-destructive hover:text-destructive"
                          disabled={rotatingToken}
                          onClick={() => manageWebhookToken('revoke_automation_token')}
                          aria-label="Revoke automation webhook token"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {mintedWebhookToken ? (
                    <div className="space-y-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                          New Token (shown once — save now)
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 cursor-pointer text-[11px]"
                          onClick={() => copyText(mintedWebhookToken, 'Automation webhook token')}
                        >
                          <Copy className="mr-1 size-3" aria-hidden />
                          Copy Token
                        </Button>
                      </div>
                      <code className="block break-all rounded bg-background/80 px-2 py-1 font-mono text-[11px] text-foreground">
                        {mintedWebhookToken}
                      </code>
                    </div>
                  ) : null}

                  <details className="rounded-lg border border-border/70 bg-muted/20 p-2.5 text-xs">
                    <summary className="cursor-pointer font-medium text-foreground">
                      Copy Supabase pg_cron + pg_net 15-min SQL setup
                    </summary>
                    <div className="mt-2 space-y-2">
                      <pre className="max-h-48 overflow-auto rounded bg-background p-2 font-mono text-[10px] leading-relaxed text-foreground">
                        {buildPgCronSqlSnippet({
                          origin:
                            typeof window !== 'undefined' && window.location?.origin
                              ? window.location.origin
                              : 'https://www.hakumautocare.com',
                          tokenPlaceholder: mintedWebhookToken || '<YOUR_AUTOMATION_TOKEN>',
                        })}
                      </pre>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 cursor-pointer text-[11px]"
                        onClick={() =>
                          copyText(
                            buildPgCronSqlSnippet({
                              origin:
                                typeof window !== 'undefined' && window.location?.origin
                                  ? window.location.origin
                                  : 'https://www.hakumautocare.com',
                              tokenPlaceholder: mintedWebhookToken || '<YOUR_AUTOMATION_TOKEN>',
                            }),
                            'Supabase pg_cron SQL',
                          )
                        }
                      >
                        <Copy className="mr-1 size-3" aria-hidden />
                        Copy SQL Snippet
                      </Button>
                    </div>
                  </details>
                </div>
              ) : null}

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
