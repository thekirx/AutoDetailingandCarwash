import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  Copy,
  ListFilter,
  ListTree,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import {
  ROLES,
  canAccessNotifications,
  canManageNotifications,
  canSendBroadcast,
  isSuperAdmin,
} from '@/auth/permissions'
import { getSmsNotificationsEnabled } from '@/lib/adminApi'
import { getAccessTokenFresh } from '@/lib/authToken'
import { busybeeProviderStatusLabel, formatBusybeeBalance } from '@/lib/busybeeHealth'
import {
  BUSYBEE_SMS_MULTIPART_MAX,
  BUSYBEE_SMS_SINGLE_MAX,
  MESSAGE_TOKENS,
  NOTIFICATION_SCOPES,
  analyzeBusybeeSms,
  busybeeSmsSegments,
  insertMessageToken,
  messageMaxForChannel,
  notificationScopeLabel,
  titleMaxForChannel,
  validateNotificationCopy,
} from '@/lib/notificationCopy'
import NotificationSimulatorPreview from '@/components/notifications/NotificationSimulatorPreview'
import { PAINT_MAINTENANCE_SLUG } from '@/lib/paintMaintenance'
import { filterFloorDetailingServices } from '@/lib/serviceKinds'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { cn } from '@/lib/utils'
import NotificationTemplatesPanel from '@/pages/notifications/NotificationTemplatesPanel'

const EMPTY_REMINDER = {
  scope: 'whole',
  service_id: '',
  branch_slug: '',
  channel: 'push',
  frequency_months: 6,
  enabled: true,
  title: 'Hakum Auto Care: Time for paint maintenance',
  message:
    'Hi {name}, {plate} is due for paint maintenance. Book your next visit at hakumautocare.com/book.',
}

/**
 * SA / ASA (reminders + broadcast) and Marketing (broadcast) — dedicated Notifications hub.
 * Mobile-first segmented tabs; web two-column rhythm on large screens.
 */
export default function NotificationsPage() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const canReminders = canManageNotifications(profile)
  const canBroadcast = canSendBroadcast(profile)
  const showSuperAdminBalance = isSuperAdmin(profile)
  const [smsHealth, setSmsHealth] = useState(null)
  const [smsGateOn, setSmsGateOn] = useState(null)
  const [loadingSmsHealth, setLoadingSmsHealth] = useState(false)

  const loadSuperAdminSmsBalance = useCallback(async () => {
    if (!showSuperAdminBalance) return
    setLoadingSmsHealth(true)
    try {
      const token = await getAccessTokenFresh().catch(() => null)
      const [health, gate] = await Promise.all([
        fetch('/api/busybee', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
          .then(async (r) => ({ http: r.status, ...(await r.json().catch(() => ({}))) }))
          .catch((err) => ({ ok: false, error: err.message })),
        getSmsNotificationsEnabled().catch(() => null),
      ])
      setSmsHealth(health)
      if (typeof gate === 'boolean') setSmsGateOn(gate)
    } finally {
      setLoadingSmsHealth(false)
    }
  }, [showSuperAdminBalance])

  useEffect(() => {
    loadSuperAdminSmsBalance()
  }, [loadSuperAdminSmsBalance])

  if (!canAccessNotifications(profile)) {
    return <Navigate to="/operations/access-denied" replace />
  }

  const smsBalanceText = formatBusybeeBalance(smsHealth)
  const smsProviderStatus = busybeeProviderStatusLabel(smsHealth)

  const tabParam = params.get('tab')
  const tab =
    tabParam === 'templates' && canReminders
      ? 'templates'
      : tabParam === 'broadcast' && canBroadcast
        ? 'broadcast'
        : tabParam === 'reminders' && canReminders
          ? 'reminders'
          : canReminders
            ? 'reminders'
            : 'broadcast'

  function setTab(next) {
    setParams(next === 'reminders' ? {} : { tab: next }, { replace: true })
  }

  return (
    <OpsPageShell
      className="hakum-notifications notif-hub"
      eyebrow="Operations"
      title="Notifications"
      icon={Bell}
      description="All shop push and status SMS copy, paint-maintenance reminders, and push broadcasts. Super Admin can monitor BusyBee SMS balance and edit every template."
    >
      {showSuperAdminBalance ? (
        <aside
          className="rounded-2xl border border-border bg-card px-4 py-3.5 text-sm shadow-xs"
          aria-label="BusyBee SMS Balance"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Wallet className="size-4 text-primary" aria-hidden />
                  BusyBee BrandTxt SMS Balance:
                </span>
                <span className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {loadingSmsHealth && !smsHealth
                    ? 'Checking…'
                    : smsBalanceText || smsProviderStatus?.text || 'Unavailable'}
                </span>
                {smsGateOn !== null ? (
                  <Badge variant={smsGateOn ? 'default' : 'secondary'}>
                    Status SMS {smsGateOn ? 'ON' : 'OFF'}
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Customer BusyBee SMS is restricted strictly to Detailing, Services &amp; Packages booking status updates. All other alerts deliver via Web Push &amp; In-App Inbox.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-9 cursor-pointer"
                disabled={loadingSmsHealth}
                onClick={loadSuperAdminSmsBalance}
              >
                <RefreshCw className={cn('mr-1.5 size-3.5', loadingSmsHealth && 'animate-spin')} aria-hidden />
                Refresh
              </Button>
              <Button asChild size="sm" variant="secondary" className="min-h-9">
                <Link to="/operations/crm?tab=sms">Status SMS &amp; Log</Link>
              </Button>
            </div>
          </div>
        </aside>
      ) : null}
      {canReminders ? (
        <aside className="rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-3 text-sm leading-relaxed">
          <p className="flex items-start gap-2 font-medium text-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            Paint maintenance program
          </p>
          <p className="mt-1 text-muted-foreground">
            Ceramic Coating and PPF enroll one 6-month reminder per plate. Booking{' '}
            <span className="font-medium text-foreground">Paint Maintenance</span> for that car resets the clock —
            never a second active schedule.
          </p>
        </aside>
      ) : null}

      <div
        role="tablist"
        aria-label="Notification sections"
        className={cn(
          'grid gap-1 rounded-xl border border-border bg-muted/40 p-1',
          canReminders && canBroadcast ? 'grid-cols-3' : 'grid-cols-2',
        )}
      >
        {canReminders ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'reminders'}
            className={cn(
              'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition',
              tab === 'reminders'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setTab('reminders')}
          >
            <Bell className="size-4" aria-hidden />
            Reminders
          </button>
        ) : null}
        {canReminders ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'templates'}
            className={cn(
              'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition',
              tab === 'templates'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setTab('templates')}
          >
            <ListTree className="size-4" aria-hidden />
            Templates
          </button>
        ) : null}
        {canBroadcast ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'broadcast'}
            className={cn(
              'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition',
              canReminders ? '' : 'col-span-2',
              tab === 'broadcast'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setTab('broadcast')}
          >
            <Megaphone className="size-4" aria-hidden />
            Broadcast
          </button>
        ) : null}
      </div>

      {tab === 'reminders' && canReminders ? <ReminderRulesPanel /> : null}
      {tab === 'templates' && canReminders ? <NotificationTemplatesPanel /> : null}
      {tab === 'broadcast' && canBroadcast ? (
        <BroadcastPanel canManageKinds={canReminders} />
      ) : null}
    </OpsPageShell>
  )
}

/** Clickable {name}/{plate}/… chips — insert at caret to avoid typos. */
function MessageTokenChips({ value, onChange, inputId, className }) {
  function insert(token) {
    const el = typeof document !== 'undefined' ? document.getElementById(inputId) : null
    const caret = el && typeof el.selectionStart === 'number' ? el.selectionStart : null
    const { value: next, caret: nextCaret } = insertMessageToken(value, token, caret)
    onChange(next)
    requestAnimationFrame(() => {
      const field = document.getElementById(inputId)
      if (!field || typeof field.setSelectionRange !== 'function') return
      field.focus()
      field.setSelectionRange(nextCaret, nextCaret)
    })
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)} role="group" aria-label="Insert message tokens">
      {MESSAGE_TOKENS.map((row) => (
        <button
          key={row.token}
          type="button"
          title={row.hint}
          className="min-h-11 cursor-pointer rounded-lg border xl:min-h-9 border-border bg-muted/50 px-2.5 text-xs font-semibold text-foreground transition hover:border-primary/50 hover:bg-primary/10"
          onClick={() => insert(row.token)}
        >
          {row.token}
        </button>
      ))}
    </div>
  )
}

function ReminderRulesPanel() {
  const [services, setServices] = useState([])
  const [branches, setBranches] = useState([])
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({ ...EMPTY_REMINDER, id: '' })
  const [ruleOpen, setRuleOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [scopeFilter, setScopeFilter] = useState('all')
  const [togglingId, setTogglingId] = useState(null)

  const detailingServices = useMemo(() => filterFloorDetailingServices(services), [services])
  const paintMaint = detailingServices.find((s) => s.slug === PAINT_MAINTENANCE_SLUG)
  const titleMax = titleMaxForChannel(draft.channel)
  const messageMax = messageMaxForChannel(draft.channel)
  const needsService = draft.scope === 'per_service' || draft.scope === 'per_service_branch'
  const needsBranch = draft.scope === 'per_branch' || draft.scope === 'per_service_branch'
  const smsCredits =
    draft.channel === 'push' ? 0 : busybeeSmsSegments(`${draft.title}\n${draft.message}`.trim())

  const load = useCallback(async () => {
    setLoading(true)
    const token = await getAccessTokenFresh()
    const [svcRes, brRes, setRes] = await Promise.all([
      supabase.from('services').select('id, name, slug, pay_category').order('name'),
      supabase.from('branches').select('slug, name').order('name'),
      fetch('/api/notification-settings', { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
    ])
    setServices(svcRes.data || [])
    setBranches(brRes.data || [])
    try {
      const data = await setRes.json()
      setSettings(data.settings || [])
    } catch {
      setSettings([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (paintMaint && !draft.service_id && (draft.scope === 'per_service' || draft.scope === 'per_service_branch')) {
      setDraft((d) => ({ ...d, service_id: paintMaint.id }))
    }
  }, [paintMaint, draft.scope, draft.service_id])

  function setScope(scope) {
    setDraft((d) => ({
      ...d,
      scope,
      service_id: scope === 'whole' || scope === 'per_branch' ? '' : d.service_id || paintMaint?.id || '',
      branch_slug: scope === 'whole' || scope === 'per_service' ? '' : d.branch_slug,
    }))
  }

  function openCreate() {
    setDraft({
      ...EMPTY_REMINDER,
      id: '',
      service_id: paintMaint?.id || '',
    })
    setRuleOpen(true)
  }

  function openEdit(s) {
    setDraft({
      id: s.id,
      scope: s.scope || 'whole',
      service_id: s.service_id || '',
      branch_slug: s.branch_slug || '',
      channel: 'push',
      frequency_months: s.frequency_months || 6,
      enabled: s.enabled !== false,
      title: s.title || '',
      message: s.message || '',
    })
    setRuleOpen(true)
  }

  async function toggleReminderEnabled(s) {
    const next = !s.enabled
    setTogglingId(s.id)
    setSettings((prev) => prev.map((row) => (row.id === s.id ? { ...row, enabled: next } : row)))
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/notification-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id: s.id,
          enabled: next,
        }),
      })
      if (!res.ok) throw new Error('Toggle failed')
      toast.success(`Reminder rule ${next ? 'activated' : 'paused'}`)
    } catch (err) {
      toast.error(err.message)
      load()
    } finally {
      setTogglingId(null)
    }
  }

  async function saveDraft(e) {
    e.preventDefault()
    if (!draft.frequency_months || draft.frequency_months < 1) {
      toast.error('Frequency must be at least 1 month.')
      return
    }
    if (needsService && !draft.service_id) {
      toast.error('Pick a detailing service.')
      return
    }
    if (needsBranch && !draft.branch_slug) {
      toast.error('Pick a branch.')
      return
    }
    if (!draft.message.trim()) {
      toast.error('Write a custom reminder message.')
      return
    }
    if (draft.message.trim().length > messageMax) {
      toast.error(`Message must be ${messageMax} characters or fewer (BusyBee limit).`)
      return
    }
    if (draft.title.trim().length > titleMax) {
      toast.error(`Title must be ${titleMax} characters or fewer.`)
      return
    }

    setSaving(true)
    try {
      const token = await getAccessTokenFresh()
      const payload = {
        id: draft.id || undefined,
        scope: draft.scope,
        service_id: draft.service_id || null,
        branch_slug: draft.branch_slug || null,
        channel: draft.channel,
        frequency_months: Number(draft.frequency_months),
        enabled: draft.enabled,
        title: draft.title.trim(),
        message: draft.message.trim(),
      }
      const res = await fetch('/api/notification-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Save failed')
        return
      }
      toast.success(draft.id ? 'Reminder rule updated' : 'Reminder rule created')
      setDraft({ ...EMPTY_REMINDER, id: '', service_id: paintMaint?.id || '' })
      setRuleOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  async function removeSetting(id) {
    if (!window.confirm('Delete this reminder rule?')) return
    const token = await getAccessTokenFresh()
    const res = await fetch(`/api/notification-settings?id=${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) toast.error('Delete failed')
    else {
      toast.success('Reminder removed')
      load()
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return settings.filter((s) => {
      if (scopeFilter !== 'all' && s.scope !== scopeFilter) return false
      if (!q) return true
      const svc = services.find((x) => x.id === s.service_id)
      const br = branches.find((x) => x.slug === s.branch_slug)
      return (
        String(s.title || '').toLowerCase().includes(q) ||
        String(s.message || '').toLowerCase().includes(q) ||
        String(svc?.name || '').toLowerCase().includes(q) ||
        String(br?.name || '').toLowerCase().includes(q) ||
        String(s.scope || '').toLowerCase().includes(q)
      )
    })
  }, [settings, query, scopeFilter, services, branches])

  return (
    <div className="flex flex-col gap-5">
      {/* Edit / Create Rule Dialog with Live Phone Simulator */}
      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-4xl p-0">
          <div className="flex flex-col">
            <DialogHeader className="p-5 pb-3 border-b border-border/80">
              <DialogTitle className="text-xl font-bold">
                {draft.id ? 'Edit Reminder Rule' : 'New Reminder Rule'}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Targeted paint-maintenance reminders based on service, branch, or whole network.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 p-5">
              <form id="reminder-rule-form" onSubmit={saveDraft} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="ns-scope">Scope</Label>
                  <Select
                    value={draft.scope}
                    onValueChange={setScope}
                    items={NOTIFICATION_SCOPES.map((s) => ({ value: s.id, label: `${s.label} — ${s.hint}` }))}
                  >
                    <SelectTrigger id="ns-scope" className="min-h-10 w-full cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTIFICATION_SCOPES.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label} — {s.hint}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {needsService ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ns-service">Detailing Service</Label>
                    <Select
                      value={draft.service_id}
                      onValueChange={(v) => setDraft({ ...draft, service_id: v })}
                      items={detailingServices.map((s) => ({ value: s.id, label: s.name }))}
                    >
                      <SelectTrigger id="ns-service" className="min-h-10 w-full cursor-pointer">
                        <SelectValue placeholder="Pick service" />
                      </SelectTrigger>
                      <SelectContent>
                        {detailingServices.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                            {s.slug === PAINT_MAINTENANCE_SLUG ? ' · program' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {needsBranch ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ns-branch">Branch</Label>
                    <Select
                      value={draft.branch_slug}
                      onValueChange={(v) => setDraft({ ...draft, branch_slug: v })}
                      items={branches.map((b) => ({ value: b.slug, label: b.name }))}
                    >
                      <SelectTrigger id="ns-branch" className="min-h-10 w-full cursor-pointer">
                        <SelectValue placeholder="Pick branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.slug} value={b.slug}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <Label htmlFor="ns-channel">Channel</Label>
                  <Select
                    value="push"
                    disabled
                    onValueChange={() => setDraft({ ...draft, channel: 'push' })}
                    items={[{ value: 'push', label: 'Push + In-App Inbox' }]}
                  >
                    <SelectTrigger id="ns-channel" className="min-h-10 w-full cursor-not-allowed">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="push">Push + In-App Inbox</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="ns-freq">Frequency (every X months)</Label>
                  <Input
                    id="ns-freq"
                    type="number"
                    min={1}
                    max={24}
                    className="min-h-10"
                    value={draft.frequency_months}
                    onChange={(e) => setDraft({ ...draft, frequency_months: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <Label htmlFor="ns-title">Title</Label>
                    <span
                      className={`text-xs tabular-nums ${draft.title.length > titleMax ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}
                    >
                      {draft.title.length}/{titleMax}
                    </span>
                  </div>
                  <Input
                    id="ns-title"
                    className="min-h-10"
                    value={draft.title}
                    maxLength={titleMax}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    required
                  />
                  <MessageTokenChips
                    inputId="ns-title"
                    value={draft.title}
                    onChange={(title) => setDraft({ ...draft, title: title.slice(0, titleMax) })}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <Label htmlFor="ns-message">Message</Label>
                    <span
                      className={`text-xs tabular-nums ${draft.message.length > messageMax ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}
                    >
                      {draft.message.length}/{messageMax}
                      {draft.channel !== 'push' ? ` · ~${smsCredits} SMS` : ''}
                    </span>
                  </div>
                  <Textarea
                    id="ns-message"
                    rows={4}
                    value={draft.message}
                    maxLength={messageMax}
                    onChange={(e) => setDraft({ ...draft, message: e.target.value })}
                    required
                  />
                  <MessageTokenChips
                    inputId="ns-message"
                    value={draft.message}
                    onChange={(message) => setDraft({ ...draft, message: message.slice(0, messageMax) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {draft.channel === 'push'
                      ? 'Push body capped at 200 characters.'
                      : `BusyBee single SMS is ${BUSYBEE_SMS_SINGLE_MAX} characters · sent to the customer mobile.`}
                  </p>
                </div>

                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium sm:col-span-2">
                  <input
                    id="ns-enabled"
                    type="checkbox"
                    className="size-4 cursor-pointer"
                    checked={draft.enabled}
                    onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                  />
                  Rule active &amp; scheduled
                </label>
              </form>

              {/* Right column: Simulator Preview */}
              <div className="flex flex-col items-center">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Live Customer Preview</p>
                <NotificationSimulatorPreview
                  channel={draft.channel}
                  title={draft.title}
                  body={draft.message}
                  sms_body={draft.message}
                  triggerRoute="/book"
                />
              </div>
            </div>

            <DialogFooter className="p-4 border-t border-border/80 flex items-center justify-end gap-2 bg-muted/15">
              <Button type="button" variant="ghost" className="min-h-10 cursor-pointer" onClick={() => setRuleOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form="reminder-rule-form" className="min-h-10 cursor-pointer" disabled={saving}>
                {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Create reminder'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Rules Card */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl font-bold tracking-tight">Active Reminder Rules</CardTitle>
              <Badge variant="secondary" className="font-semibold text-xs">
                {settings.length} {settings.length === 1 ? 'rule' : 'rules'}
              </Badge>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              Recurring service maintenance alerts sent to vehicle owners. Edit copy, toggle channels, or change intervals.
            </CardDescription>
          </div>
          <Button type="button" className="min-h-10 cursor-pointer text-xs font-semibold" onClick={openCreate}>
            <Plus size={16} className="mr-1.5" aria-hidden />
            New reminder
          </Button>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          {/* Search & Scope Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                aria-label="Filter reminder rules"
                className="min-h-10 pl-9 text-xs sm:text-sm"
                placeholder="Search rule title, message, service, or branch…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground mr-1 flex items-center gap-1">
                <ListFilter className="size-3.5" aria-hidden />
                Scope:
              </span>
              <Button
                type="button"
                size="sm"
                variant={scopeFilter === 'all' ? 'secondary' : 'ghost'}
                className="h-8 px-2.5 text-xs cursor-pointer"
                onClick={() => setScopeFilter('all')}
              >
                All
              </Button>
              {NOTIFICATION_SCOPES.map((sc) => (
                <Button
                  key={sc.id}
                  type="button"
                  size="sm"
                  variant={scopeFilter === sc.id ? 'secondary' : 'ghost'}
                  className="h-8 px-2.5 text-xs cursor-pointer"
                  onClick={() => setScopeFilter(sc.id)}
                >
                  {sc.label}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground animate-pulse">Loading reminder rules…</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <p className="text-sm font-medium text-foreground">No reminder rules found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {query || scopeFilter !== 'all' ? 'Try adjusting your search or filter.' : 'Default fallback is push every 6 months for paint maintenance.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {filtered.map((s) => {
                const svc = detailingServices.find((x) => x.id === s.service_id) || services.find((x) => x.id === s.service_id)
                const br = branches.find((x) => x.slug === s.branch_slug)
                return (
                  <li
                    key={s.id}
                    className={cn(
                      'flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between transition-colors hover:bg-muted/10',
                      !s.enabled && 'opacity-65 bg-muted/5',
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="font-semibold text-xs">
                          {notificationScopeLabel(s.scope)}
                        </Badge>
                        {svc ? (
                          <Badge variant="secondary" className="font-medium text-xs">
                            {svc.name}
                          </Badge>
                        ) : null}
                        {br ? (
                          <Badge variant="outline" className="font-medium text-xs">
                            {br.name}
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className="uppercase text-[11px]">
                          {(s.channel || 'push')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Every {s.frequency_months} mo
                        </span>
                        {s.enabled ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <Badge variant="destructive" className="text-[11px] font-medium">
                            Paused
                          </Badge>
                        )}
                      </div>

                      {s.title ? <p className="text-sm font-bold text-foreground">{s.title}</p> : null}
                      {s.message ? (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{s.message}</p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2 pt-1 sm:pt-0">
                      {/* One-click toggle switch */}
                      <Button
                        type="button"
                        size="sm"
                        variant={s.enabled ? 'outline' : 'secondary'}
                        className="min-h-9 text-xs cursor-pointer"
                        disabled={togglingId === s.id}
                        onClick={() => toggleReminderEnabled(s)}
                      >
                        {s.enabled ? 'Pause' : 'Activate'}
                      </Button>

                      {/* Edit modal button */}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-9 cursor-pointer"
                        onClick={() => openEdit(s)}
                        aria-label="Edit reminder rule"
                      >
                        <Pencil className="size-4" />
                      </Button>

                      {/* Delete button */}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-9 cursor-pointer text-destructive hover:bg-destructive/10"
                        onClick={() => removeSetting(s.id)}
                        aria-label="Remove reminder rule"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const EMPLOYEE_ROLE_CHOICES = [
  { id: ROLES.TEAM_LEAD, label: 'Team Lead' },
  { id: ROLES.ADMIN, label: 'Branch Admin' },
  { id: ROLES.DETAILER, label: 'Detailer' },
  { id: ROLES.STAFF, label: 'Staff' },
  { id: ROLES.ASSISTANT_SUPER_ADMIN, label: 'Assistant Super Admin' },
  { id: ROLES.SALES, label: 'Sales' },
  { id: ROLES.MARKETING, label: 'Marketing' },
  { id: ROLES.VIDEO_EDITOR, label: 'Video Editor' },
  { id: ROLES.OPERATIONS_LEAD, label: 'Ops Lead' },
  { id: ROLES.SUPER_ADMIN, label: 'Super Admin' },
]

const AUDIENCE_GROUP_LABELS = Object.freeze({
  customers: 'Customers',
  employees: 'Employees (Inbox + Push)',
  both: 'Employees & Customers',
})

function BroadcastPanel({ canManageKinds = false }) {
  const canTargetEmployees = canManageKinds
  const [branches, setBranches] = useState([])
  const [kinds, setKinds] = useState([])
  const [history, setHistory] = useState([])
  const [sending, setSending] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [form, setForm] = useState({
    kind: 'promo',
    audience_group: 'customers',
    channel: 'push',
    title: '',
    body: '',
    url: '/account',
    staff_url: '/operations/dashboard',
    target_audience: 'all',
    employee_scope: 'all',
    employee_roles: [],
    branch_slug: '',
    allow_multipart: false,
  })

  const loadKinds = useCallback(async () => {
    const token = await getAccessTokenFresh()
    const qs = canManageKinds ? '?all=1' : ''
    const res = await fetch(`/api/notification-broadcast-kinds${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setKinds([
        { slug: 'promo', label: 'Promo', is_active: true },
        { slug: 'announcement', label: 'Shop announcement', is_active: true },
        { slug: 'ops_notice', label: 'Team notice', is_active: true },
        { slug: 'we_missed', label: 'We missed you', is_active: true },
        { slug: 'aftercare', label: 'Aftercare check-in', is_active: true },
        { slug: 'package_nudge', label: 'Package upsell', is_active: true },
        { slug: 'loyalty_nudge', label: 'Loyalty nudge', is_active: true },
        { slug: 'thank_you', label: 'Thank you', is_active: true },
        { slug: 'reminder', label: 'Service due', is_active: true },
        { slug: 'custom', label: 'Custom', is_active: true },
      ])
      return
    }
    setKinds(data.kinds || [])
  }, [canManageKinds])

  const loadHistory = useCallback(async () => {
    const token = await getAccessTokenFresh()
    const res = await fetch('/api/notification-broadcast', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      setHistory(data.broadcasts || [])
      return
    }
    const { data } = await supabase
      .from('notification_broadcasts')
      .select('id, kind, channel, title, body, url, target_audience, branch_slug, sent_count, failed_count, sent_at')
      .order('sent_at', { ascending: false })
      .limit(20)
    setHistory(data || [])
  }, [])

  useEffect(() => {
    supabase.from('branches').select('slug, name').order('name').then(({ data }) => setBranches(data || []))
    loadHistory()
    loadKinds()
  }, [loadHistory, loadKinds])

  const activeKinds = useMemo(
    () => (kinds.length ? kinds.filter((k) => k.is_active !== false) : kinds),
    [kinds],
  )
  const kindItems = activeKinds.map((k) => ({ value: k.slug, label: k.label }))

  useEffect(() => {
    if (!activeKinds.length) return
    if (!activeKinds.some((k) => k.slug === form.kind)) {
      setForm((f) => ({ ...f, kind: activeKinds[0].slug }))
    }
  }, [activeKinds, form.kind])

  function applyKindDefaults(slug) {
    const row = kinds.find((k) => k.slug === slug)
    const staffKind = slug === 'ops_notice'
    setForm((f) => ({
      ...f,
      kind: slug,
      audience_group: staffKind && canTargetEmployees && f.audience_group === 'customers' ? 'employees' : f.audience_group,
      channel: staffKind && canTargetEmployees ? 'push' : f.channel,
      title: row?.default_title || f.title,
      body: row?.default_body || f.body,
    }))
  }

  function setAudienceGroup(group) {
    setForm((f) => ({
      ...f,
      audience_group: group,
      channel: group === 'employees' ? 'push' : f.channel,
    }))
  }

  function toggleEmployeeRole(roleId) {
    setForm((f) => {
      const exists = f.employee_roles.includes(roleId)
      return {
        ...f,
        employee_roles: exists
          ? f.employee_roles.filter((r) => r !== roleId)
          : [...f.employee_roles, roleId],
      }
    })
  }

  const effectiveChannel = 'push'
  const includesCustomers = form.audience_group !== 'employees'
  const includesEmployees = form.audience_group !== 'customers'
  const usesCustomerSms = includesCustomers && effectiveChannel !== 'push'
  const titleMax = titleMaxForChannel(effectiveChannel)
  const messageMax = messageMaxForChannel(effectiveChannel, {
    allowMultiPart: usesCustomerSms && form.allow_multipart,
  })
  const smsAnalysis = useMemo(() => {
    if (!usesCustomerSms) return null
    return analyzeBusybeeSms(form.body, { allowMultiPart: form.allow_multipart })
  }, [usesCustomerSms, form.body, form.allow_multipart])
  const combinedSmsCredits =
    !usesCustomerSms ? 0 : busybeeSmsSegments(`${form.title}\n${form.body}`.trim())

  const copyValidation = validateNotificationCopy({
    channel: effectiveChannel,
    title: form.title,
    body: form.body,
    allowMultiPart: usesCustomerSms && form.allow_multipart,
    requireTitle: Boolean(form.title.trim()),
    requireBody: Boolean(form.body.trim()),
  })

  async function send(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Title and message are required.')
      return
    }
    if (!copyValidation.ok) {
      toast.error(copyValidation.error)
      return
    }
    if (form.target_audience === 'branch' && !form.branch_slug && includesCustomers) {
      toast.error('Pick a branch.')
      return
    }
    if (includesEmployees && form.employee_scope === 'branch' && !form.branch_slug) {
      toast.error('Pick a branch for employee targeting.')
      return
    }
    if (includesEmployees && form.employee_scope === 'roles' && !form.employee_roles.length) {
      toast.error('Select at least one employee role.')
      return
    }

    setSending(true)
    try {
      const token = await getAccessTokenFresh()
      const needsBranch =
        (includesCustomers && form.target_audience === 'branch') ||
        (includesEmployees && form.employee_scope === 'branch')
      const res = await fetch('/api/notification-broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          kind: form.kind,
          audience_group: form.audience_group,
          channel: effectiveChannel,
          title: form.title.trim(),
          body: form.body.trim(),
          url: includesCustomers ? form.url || '/account' : form.staff_url || '/operations/dashboard',
          staff_url: form.staff_url || '/operations/dashboard',
          target_audience: form.target_audience,
          employee_scope: form.employee_scope,
          employee_roles: form.employee_roles,
          branch_slug: needsBranch ? form.branch_slug : null,
          allow_multipart: Boolean(usesCustomerSms && form.allow_multipart),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Broadcast failed')
        return
      }
      toast.success(`Sent ${data.sent} · failed ${data.failed}${data.skipped ? ` · skipped ${data.skipped}` : ''}`)
      setForm((f) => ({ ...f, title: '', body: '' }))
      loadHistory()
    } finally {
      setSending(false)
    }
  }

  async function saveBroadcastEdit(e) {
    e.preventDefault()
    if (!editingRow?.id) return
    const check = validateNotificationCopy({
      channel: editingRow.channel || 'push',
      title: editingRow.title,
      body: editingRow.body,
      allowMultiPart: Boolean(editingRow.allow_multipart),
      requireTitle: true,
      requireBody: true,
    })
    if (!check.ok) {
      toast.error(check.error)
      return
    }
    setSavingEdit(true)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/notification-broadcast', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id: editingRow.id,
          kind: editingRow.kind,
          title: editingRow.title.trim(),
          body: editingRow.body.trim(),
          url: editingRow.url || '/account',
          allow_multipart: Boolean(editingRow.allow_multipart),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Update failed')
        return
      }
      toast.success('Broadcast record updated')
      setEditingRow(null)
      loadHistory()
    } finally {
      setSavingEdit(false)
    }
  }

  async function deleteBroadcast(id) {
    const token = await getAccessTokenFresh()
    const res = await fetch(`/api/notification-broadcast?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error || 'Delete failed')
      return
    }
    toast.success('Broadcast deleted')
    loadHistory()
  }

  const branchRequired =
    (includesCustomers && form.target_audience === 'branch') ||
    (includesEmployees && form.employee_scope === 'branch')

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
        <Card className="border-border/80 shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">Custom push &amp; announcement broadcast</CardTitle>
            <CardDescription>
              Target customers, employees, or both via In-App Inbox + Web Push only (BusyBee SMS is reserved strictly for Detailing, Services &amp; Packages booking status updates).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={send} className="grid gap-4">
              {canTargetEmployees ? (
                <div className="grid gap-2">
                  <Label>Target audience group</Label>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3" role="group" aria-label="Target audience group">
                    {[
                      { id: 'customers', label: 'Customers only' },
                      { id: 'employees', label: 'Employees only' },
                      { id: 'both', label: 'Employees & Customers' },
                    ].map((opt) => (
                      <Button
                        key={opt.id}
                        type="button"
                        variant={form.audience_group === opt.id ? 'default' : 'outline'}
                        className="min-h-11 justify-center text-xs sm:text-sm"
                        onClick={() => setAudienceGroup(opt.id)}
                      >
                        <Users className="size-4 shrink-0" aria-hidden />
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bc-kind">Purpose / kind</Label>
                  <Select
                    value={form.kind}
                    onValueChange={applyKindDefaults}
                    items={kindItems.length ? kindItems : [{ value: form.kind, label: form.kind }]}
                  >
                    <SelectTrigger id="bc-kind" className="min-h-11 cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(activeKinds.length ? activeKinds : [{ slug: form.kind, label: form.kind }]).map((k) => (
                        <SelectItem key={k.slug} value={k.slug}>
                          {k.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bc-channel">Delivery channel</Label>
                  <Select
                    value="push"
                    disabled
                    onValueChange={() => setForm({ ...form, channel: 'push' })}
                    items={[{ value: 'push', label: 'In-App Inbox + Web Push' }]}
                  >
                    <SelectTrigger id="bc-channel" className="min-h-10 w-full cursor-not-allowed">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="push">In-App Inbox + Web Push</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {includesCustomers ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="bc-audience">Customer segment</Label>
                    <Select
                      value={form.target_audience}
                      onValueChange={(v) => setForm({ ...form, target_audience: v })}
                      items={[
                        { value: 'all', label: 'All customers' },
                        { value: 'detailing', label: 'Detailing customers' },
                        { value: 'wash', label: 'Wash customers' },
                        { value: 'branch', label: 'One branch' },
                      ]}
                    >
                      <SelectTrigger id="bc-audience" className="min-h-11 cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All customers</SelectItem>
                        <SelectItem value="detailing">Detailing customers</SelectItem>
                        <SelectItem value="wash">Wash customers</SelectItem>
                        <SelectItem value="branch">One branch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {includesEmployees ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="bc-emp-scope">Employee scope</Label>
                    <Select
                      value={form.employee_scope}
                      onValueChange={(v) => setForm({ ...form, employee_scope: v })}
                      items={[
                        { value: 'all', label: 'All active staff' },
                        { value: 'roles', label: 'Selected roles' },
                        { value: 'branch', label: 'One branch' },
                      ]}
                    >
                      <SelectTrigger id="bc-emp-scope" className="min-h-11 cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All active staff</SelectItem>
                        <SelectItem value="roles">Selected roles</SelectItem>
                        <SelectItem value="branch">One branch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {branchRequired ? (
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor="bc-branch">Branch</Label>
                    <Select
                      value={form.branch_slug}
                      onValueChange={(v) => setForm({ ...form, branch_slug: v })}
                      items={branches.map((b) => ({ value: b.slug, label: b.name }))}
                    >
                      <SelectTrigger id="bc-branch" className="min-h-11 cursor-pointer">
                        <SelectValue placeholder="Pick branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.slug} value={b.slug}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>

              {includesEmployees && form.employee_scope === 'roles' ? (
                <div className="grid gap-2 rounded-xl border border-border bg-muted/20 p-3">
                  <Label>Employee roles</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {EMPLOYEE_ROLE_CHOICES.map((r) => {
                      const active = form.employee_roles.includes(r.id)
                      return (
                        <Button
                          key={r.id}
                          type="button"
                          size="sm"
                          variant={active ? 'default' : 'outline'}
                          className="min-h-9 text-xs"
                          onClick={() => toggleEmployeeRole(r.id)}
                        >
                          {r.label}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {includesEmployees ? (
                <p className="text-xs text-muted-foreground">
                  Staff announcements deliver strictly via <strong className="text-foreground">In-App Inbox + Web Push</strong> — BusyBee SMS is never sent to staff phones.
                </p>
              ) : null}

              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor="bc-title">Title</Label>
                  <span
                    className={`text-xs tabular-nums ${form.title.length > titleMax ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}
                  >
                    {form.title.length}/{titleMax}
                  </span>
                </div>
                <Input
                  id="bc-title"
                  className="min-h-11"
                  required
                  value={form.title}
                  maxLength={titleMax}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
                <MessageTokenChips
                  inputId="bc-title"
                  value={form.title}
                  onChange={(title) => setForm({ ...form, title: title.slice(0, titleMax) })}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor="bc-body">Message</Label>
                  <span
                    className={`text-xs tabular-nums ${form.body.length > messageMax ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}
                  >
                    {form.body.length}/{messageMax}
                    {smsAnalysis
                      ? ` · ${smsAnalysis.encoding} · ~${combinedSmsCredits} BusyBee SMS`
                      : ''}
                  </span>
                </div>
                <Textarea
                  id="bc-body"
                  required
                  rows={4}
                  value={form.body}
                  maxLength={usesCustomerSms ? BUSYBEE_SMS_MULTIPART_MAX : messageMax}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                />
                <MessageTokenChips
                  inputId="bc-body"
                  value={form.body}
                  onChange={(body) =>
                    setForm({
                      ...form,
                      body: body.slice(0, usesCustomerSms ? BUSYBEE_SMS_MULTIPART_MAX : messageMax),
                    })
                  }
                />
                {usesCustomerSms ? (
                  <>
                    <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={form.allow_multipart}
                        onChange={(e) => setForm({ ...form, allow_multipart: e.target.checked })}
                      />
                      Allow multi-part BusyBee SMS up to {BUSYBEE_SMS_MULTIPART_MAX} chars (2 credits per customer)
                    </label>
                    {smsAnalysis?.error ? (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-destructive" role="alert">
                        <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                        {smsAnalysis.error}
                      </p>
                    ) : smsAnalysis?.warning ? (
                      <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                        {smsAnalysis.warning}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {includesCustomers ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="bc-url">Customer tap URL</Label>
                    <Input
                      id="bc-url"
                      className="min-h-11"
                      value={form.url}
                      onChange={(e) => setForm({ ...form, url: e.target.value })}
                    />
                  </div>
                ) : null}
                {includesEmployees ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="bc-staff-url">Staff tap URL</Label>
                    <Input
                      id="bc-staff-url"
                      className="min-h-11"
                      value={form.staff_url}
                      onChange={(e) => setForm({ ...form, staff_url: e.target.value })}
                    />
                  </div>
                ) : null}
              </div>

              <Button type="submit" disabled={sending || !copyValidation.ok} className="min-h-11 w-full sm:w-fit cursor-pointer">
                {sending ? 'Sending…' : 'Send broadcast'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-5">
          {/* Live Mobile Simulator Preview */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="py-3.5 px-4 flex flex-row items-center justify-between border-b border-border/70">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Smartphone className="size-4 text-primary" aria-hidden />
                Live Customer Simulator
              </CardTitle>
              <Badge variant="outline" className="text-[11px] font-semibold uppercase">
                {effectiveChannel}
              </Badge>
            </CardHeader>
            <CardContent className="p-4 pt-3 flex flex-col items-center">
              <NotificationSimulatorPreview
                channel={effectiveChannel}
                title={form.title}
                body={form.body}
                sms_body={form.body}
                allow_multipart={form.allow_multipart}
                triggerRoute={includesCustomers ? form.url || '/account' : form.staff_url || '/operations/dashboard'}
              />
            </CardContent>
          </Card>

          {/* Recent Broadcasts History */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="py-3.5 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Broadcast History</CardTitle>
                  <CardDescription className="text-xs">Last 30 campaigns. Reuse copy, edit, or delete.</CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs tabular-nums font-semibold">
                  {history.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No broadcasts sent yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-start justify-between gap-2 p-3.5 hover:bg-muted/10 transition-colors">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-bold text-foreground">{h.title}</p>
                          {h.audience_group && h.audience_group !== 'customers' ? (
                            <Badge variant="secondary" className="text-[10px] font-medium">
                              {AUDIENCE_GROUP_LABELS[h.audience_group] || h.audience_group}
                            </Badge>
                          ) : null}
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {h.channel}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {h.kind} · {h.audience_group === 'employees' ? `staff ${h.employee_scope || 'all'}` : h.target_audience}
                          {h.branch_slug ? ` · ${h.branch_slug}` : ''} · sent <strong className="text-foreground">{h.sent_count}</strong> · failed {h.failed_count}
                        </p>
                        {h.body ? <p className="text-xs text-muted-foreground line-clamp-2">{h.body}</p> : null}
                      </div>
                      <div className="flex shrink-0 gap-1 pt-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8 cursor-pointer"
                          title="Reuse into composer"
                          aria-label={`Reuse ${h.title}`}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              kind: h.kind || f.kind,
                              audience_group: canTargetEmployees ? h.audience_group || 'customers' : 'customers',
                              channel: h.channel || 'push',
                              title: h.title || '',
                              body: h.body || '',
                              url: h.url || '/account',
                              branch_slug: h.branch_slug || '',
                              allow_multipart: Boolean(h.allow_multipart),
                            }))
                          }
                        >
                          <Copy className="size-3.5" />
                        </Button>
                        {canTargetEmployees ? (
                          <>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 cursor-pointer"
                              aria-label={`Edit ${h.title}`}
                              onClick={() => setEditingRow({ ...h })}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 cursor-pointer text-destructive hover:bg-destructive/10"
                              aria-label={`Delete ${h.title}`}
                              onClick={() => {
                                if (window.confirm(`Delete broadcast log "${h.title}"?`)) {
                                  deleteBroadcast(h.id)
                                }
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={Boolean(editingRow)} onOpenChange={(open) => { if (!open) setEditingRow(null) }}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          {editingRow ? (
            <>
              <DialogHeader>
                <DialogTitle>Edit broadcast record</DialogTitle>
                <DialogDescription>Updates the saved campaign title, copy, kind, or tap URL in history.</DialogDescription>
              </DialogHeader>
              <form onSubmit={saveBroadcastEdit} className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="edit-bc-title">Title</Label>
                  <Input
                    id="edit-bc-title"
                    className="min-h-11"
                    required
                    value={editingRow.title || ''}
                    onChange={(e) => setEditingRow({ ...editingRow, title: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-bc-body">Message</Label>
                  <Textarea
                    id="edit-bc-body"
                    required
                    rows={4}
                    value={editingRow.body || ''}
                    onChange={(e) => setEditingRow({ ...editingRow, body: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-bc-url">Tap URL</Label>
                  <Input
                    id="edit-bc-url"
                    className="min-h-11"
                    value={editingRow.url || ''}
                    onChange={(e) => setEditingRow({ ...editingRow, url: e.target.value })}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditingRow(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={savingEdit} className="min-h-11">
                    {savingEdit ? 'Saving…' : 'Save changes'}
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {canManageKinds ? <BroadcastKindsManager kinds={kinds} onChanged={loadKinds} /> : null}
    </div>
  )
}

function BroadcastKindsManager({ kinds, onChanged }) {
  const empty = {
    id: '',
    slug: '',
    label: '',
    description: '',
    default_title: '',
    default_body: '',
    display_order: 100,
    is_active: true,
  }
  const [draft, setDraft] = useState(empty)
  const [kindOpen, setKindOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const editing = Boolean(draft.id)

  async function save(e) {
    e.preventDefault()
    if (!draft.label.trim()) {
      toast.error('Label is required.')
      return
    }
    setSaving(true)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/notification-broadcast-kinds', {
        method: editing ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(
          editing
            ? {
                id: draft.id,
                label: draft.label.trim(),
                slug: draft.slug.trim() || undefined,
                description: draft.description,
                default_title: draft.default_title,
                default_body: draft.default_body,
                display_order: Number(draft.display_order) || 0,
                is_active: draft.is_active,
              }
            : {
                label: draft.label.trim(),
                slug: draft.slug.trim() || undefined,
                description: draft.description,
                default_title: draft.default_title,
                default_body: draft.default_body,
                display_order: Number(draft.display_order) || 100,
              },
        ),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Save failed')
        return
      }
      toast.success(editing ? 'Kind updated' : 'Kind created')
      setDraft(empty)
      setKindOpen(false)
      onChanged?.()
    } finally {
      setSaving(false)
    }
  }

  async function deactivate(id) {
    const token = await getAccessTokenFresh()
    const res = await fetch(`/api/notification-broadcast-kinds?id=${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Delete failed')
      return
    }
    toast.success('Kind archived')
    if (draft.id === id) setDraft(empty)
    onChanged?.()
  }

  return (
    <Card className="border-border/80 shadow-none">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <CardTitle className="text-lg">Broadcast kinds</CardTitle>
          <CardDescription>Create, edit, or archive kinds used in the compose dropdown (SA / ASA).</CardDescription>
        </div>
        <Button type="button" className="min-h-11" onClick={() => { setDraft(empty); setKindOpen(true) }}>
          <Plus size={16} className="mr-1.5" aria-hidden />
          Add kind
        </Button>
      </CardHeader>
      <CardContent>
        <Dialog open={kindOpen} onOpenChange={(open) => { setKindOpen(open); if (!open) setDraft(empty) }}>
          <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? `Edit ${draft.label || 'kind'}` : 'Add broadcast kind'}</DialogTitle>
              <DialogDescription>Shown in the compose dropdown. Defaults prefill the title and message.</DialogDescription>
            </DialogHeader>
        <form onSubmit={save} className="grid gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="kind-label">Label</Label>
            <Input
              id="kind-label"
              className="min-h-11"
              required
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="e.g. Weekend promo"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="kind-slug">Slug (optional)</Label>
            <Input
              id="kind-slug"
              className="min-h-11"
              value={draft.slug}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              placeholder="auto from label"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="kind-desc">Description</Label>
            <Input
              id="kind-desc"
              className="min-h-11"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="kind-title">Default title</Label>
            <Input
              id="kind-title"
              className="min-h-11"
              value={draft.default_title}
              onChange={(e) => setDraft({ ...draft, default_title: e.target.value })}
            />
            <MessageTokenChips
              inputId="kind-title"
              value={draft.default_title}
              onChange={(default_title) => setDraft({ ...draft, default_title })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="kind-body">Default message</Label>
            <Textarea
              id="kind-body"
              rows={3}
              value={draft.default_body}
              onChange={(e) => setDraft({ ...draft, default_body: e.target.value })}
            />
            <MessageTokenChips
              inputId="kind-body"
              value={draft.default_body}
              onChange={(default_body) => setDraft({ ...draft, default_body })}
            />
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
            />
            Active
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => { setKindOpen(false); setDraft(empty) }}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="min-h-11">
              {saving ? 'Saving…' : editing ? 'Update kind' : 'Add kind'}
            </Button>
          </DialogFooter>
        </form>
          </DialogContent>
        </Dialog>

        <ul className="divide-y divide-border rounded-xl border border-border">
          {kinds.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">No kinds yet.</li>
          ) : (
            kinds.map((k) => (
              <li key={k.id || k.slug} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {k.label}{' '}
                    <span className="font-normal text-muted-foreground">· {k.slug}</span>
                    {!k.is_active ? (
                      <span className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-300">archived</span>
                    ) : null}
                  </p>
                  {k.description ? <p className="mt-0.5 text-xs text-muted-foreground">{k.description}</p> : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-10 cursor-pointer"
                    aria-label={`Edit ${k.label}`}
                    onClick={() => {
                      setDraft({
                        id: k.id,
                        slug: k.slug || '',
                        label: k.label || '',
                        description: k.description || '',
                        default_title: k.default_title || '',
                        default_body: k.default_body || '',
                        display_order: k.display_order ?? 100,
                        is_active: k.is_active !== false,
                      })
                      setKindOpen(true)
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  {k.is_active !== false && k.id ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-10 cursor-pointer text-destructive"
                      aria-label={`Archive ${k.label}`}
                      onClick={() => deactivate(k.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  )
}

