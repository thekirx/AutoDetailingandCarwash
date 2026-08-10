import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Bell, Megaphone, Pencil, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import {
  canAccessNotifications,
  canManageNotifications,
  canSendBroadcast,
} from '@/auth/permissions'
import { getAccessTokenFresh } from '@/lib/authToken'
import {
  BUSYBEE_SMS_SINGLE_MAX,
  MESSAGE_TOKENS,
  NOTIFICATION_SCOPES,
  busybeeSmsSegments,
  insertMessageToken,
  messageMaxForChannel,
  notificationScopeLabel,
  titleMaxForChannel,
} from '@/lib/notificationCopy'
import { PAINT_MAINTENANCE_SLUG } from '@/lib/paintMaintenance'
import { filterFloorDetailingServices } from '@/lib/serviceKinds'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { cn } from '@/lib/utils'

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

  if (!canAccessNotifications(profile)) {
    return <Navigate to="/operations/access-denied" replace />
  }

  const tabParam = params.get('tab')
  const tab =
    tabParam === 'broadcast' && canBroadcast
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
    <section className="notif-hub flex flex-col gap-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="border-b border-border pb-4">
        <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Operations</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <Bell className="size-6 shrink-0 text-primary" aria-hidden />
          Notifications
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Push and SMS for paint-maintenance reminders and customer broadcasts — scoped by network, branch, or service.
        </p>
      </header>

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
        className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/40 p-1"
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
      {tab === 'broadcast' && canBroadcast ? (
        <BroadcastPanel canManageKinds={canReminders} />
      ) : null}
    </section>
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
          className="min-h-9 cursor-pointer rounded-lg border border-border bg-muted/50 px-2.5 text-xs font-semibold text-foreground transition hover:border-primary/50 hover:bg-primary/10"
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
  const [draft, setDraft] = useState(EMPTY_REMINDER)

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
      const res = await fetch('/api/notification-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          scope: draft.scope,
          service_id: draft.service_id || null,
          branch_slug: draft.branch_slug || null,
          channel: draft.channel,
          frequency_months: Number(draft.frequency_months),
          enabled: draft.enabled,
          title: draft.title.trim(),
          message: draft.message.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Save failed')
        return
      }
      toast.success('Reminder saved')
      setDraft({ ...EMPTY_REMINDER, service_id: paintMaint?.id || '' })
      load()
    } finally {
      setSaving(false)
    }
  }

  async function removeSetting(id) {
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

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
      <Card className="border-border/80 shadow-none">
          <CardHeader className="space-y-1">
          <CardTitle className="text-lg">Reminder rule</CardTitle>
          <CardDescription>
            Scope: whole network, one branch, one service, or service × branch. Tap tokens to insert into title or
            message. Prefer <strong className="font-medium text-foreground">Paint Maintenance</strong> for Ceramic/PPF
            cycles. SMS uses each customer&apos;s mobile on file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveDraft} className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="ns-scope">Scope</Label>
              <Select value={draft.scope} onValueChange={setScope} items={NOTIFICATION_SCOPES.map((s) => ({ value: s.id, label: `${s.label} — ${s.hint}` }))}>
                <SelectTrigger id="ns-scope" className="min-h-11 cursor-pointer">
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
                <Label htmlFor="ns-service">Detailing service</Label>
                <Select
                  value={draft.service_id}
                  onValueChange={(v) => setDraft({ ...draft, service_id: v })}
                  items={detailingServices.map((s) => ({ value: s.id, label: s.name }))}
                >
                  <SelectTrigger id="ns-service" className="min-h-11 cursor-pointer">
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
                  <SelectTrigger id="ns-branch" className="min-h-11 cursor-pointer">
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
                value={draft.channel}
                onValueChange={(v) => setDraft({ ...draft, channel: v })}
                items={[
                  { value: 'push', label: 'Push' },
                  { value: 'sms', label: 'SMS (BusyBee)' },
                  { value: 'both', label: 'Push + SMS' },
                ]}
              >
                <SelectTrigger id="ns-channel" className="min-h-11 cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="push">Push</SelectItem>
                  <SelectItem value="sms">SMS (BusyBee)</SelectItem>
                  <SelectItem value="both">Push + SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ns-freq">Every (months)</Label>
              <Input
                id="ns-freq"
                type="number"
                min={1}
                max={24}
                className="min-h-11"
                value={draft.frequency_months}
                onChange={(e) => setDraft({ ...draft, frequency_months: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="ns-title">Title</Label>
                <span
                  className={`text-xs tabular-nums ${draft.title.length > titleMax ? 'text-destructive' : 'text-muted-foreground'}`}
                >
                  {draft.title.length}/{titleMax}
                </span>
              </div>
              <Input
                id="ns-title"
                className="min-h-11"
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
                  className={`text-xs tabular-nums ${draft.message.length > messageMax ? 'text-destructive' : 'text-muted-foreground'}`}
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

            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="ns-enabled"
                type="checkbox"
                className="size-4 cursor-pointer"
                checked={draft.enabled}
                onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              />
              <Label htmlFor="ns-enabled">Enabled</Label>
            </div>

            <div className="sm:col-span-2">
              <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={saving}>
                {saving ? 'Saving…' : 'Save reminder'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Active rules</CardTitle>
          <CardDescription>
            {loading ? 'Loading…' : `${settings.length} rule${settings.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settings.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">
              No rules yet. Default fallback is push every 6 months for the paint-maintenance program.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {settings.map((s) => {
                const svc =
                  detailingServices.find((x) => x.id === s.service_id) ||
                  services.find((x) => x.id === s.service_id)
                const br = branches.find((x) => x.slug === s.branch_slug)
                return (
                  <li key={s.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {notificationScopeLabel(s.scope)}
                        {svc ? ` · ${svc.name}` : ''}
                        {br ? ` · ${br.name}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(s.channel || 'push').toUpperCase()} · every {s.frequency_months} mo ·{' '}
                        {s.enabled ? 'On' : 'Off'}
                      </p>
                      {s.title ? <p className="mt-1 truncate text-sm">{s.title}</p> : null}
                      {s.message ? (
                        <p className="truncate text-xs text-muted-foreground">{s.message}</p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => removeSetting(s.id)}
                      aria-label="Remove reminder"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
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

function BroadcastPanel({ canManageKinds = false }) {
  const [branches, setBranches] = useState([])
  const [kinds, setKinds] = useState([])
  const [history, setHistory] = useState([])
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({
    kind: 'promo',
    channel: 'push',
    title: '',
    body: '',
    url: '/account',
    target_audience: 'all',
    branch_slug: '',
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
        { slug: 'we_missed', label: 'We missed you', is_active: true },
        { slug: 'reminder', label: 'Reminder', is_active: true },
        { slug: 'custom', label: 'Custom', is_active: true },
      ])
      return
    }
    setKinds(data.kinds || [])
  }, [canManageKinds])

  useEffect(() => {
    supabase.from('branches').select('slug, name').order('name').then(({ data }) => setBranches(data || []))
    loadHistory()
    loadKinds()
  }, [loadKinds])

  async function loadHistory() {
    const { data } = await supabase
      .from('notification_broadcasts')
      .select('id, kind, channel, title, body, target_audience, branch_slug, sent_count, failed_count, sent_at')
      .order('sent_at', { ascending: false })
      .limit(20)
    setHistory(data || [])
  }

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
    setForm((f) => ({
      ...f,
      kind: slug,
      title: row?.default_title || f.title,
      body: row?.default_body || f.body,
    }))
  }

  const titleMax = titleMaxForChannel(form.channel)
  const messageMax = messageMaxForChannel(form.channel)
  const smsCredits =
    form.channel === 'push' ? 0 : busybeeSmsSegments(`${form.title}\n${form.body}`.trim())

  async function send(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Title and message are required.')
      return
    }
    if (form.title.trim().length > titleMax) {
      toast.error(`Title must be ${titleMax} characters or fewer.`)
      return
    }
    if (form.body.trim().length > messageMax) {
      toast.error(`Message must be ${messageMax} characters or fewer (BusyBee limit).`)
      return
    }
    setSending(true)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/notification-broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          kind: form.kind,
          channel: form.channel,
          title: form.title.trim(),
          body: form.body.trim(),
          url: form.url || '/account',
          target_audience: form.target_audience,
          branch_slug: form.target_audience === 'branch' ? form.branch_slug : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Broadcast failed')
        return
      }
      toast.success(`Sent ${data.sent} · failed ${data.failed}`)
      setForm({ ...form, title: '', body: '' })
      loadHistory()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
        <Card className="border-border/80 shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">Compose broadcast</CardTitle>
            <CardDescription>
              Push and/or SMS — SMS goes to each customer&apos;s mobile on file. Tap tokens to insert.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={send} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bc-kind">Kind</Label>
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
                  <Label htmlFor="bc-channel">Channel</Label>
                  <Select
                    value={form.channel}
                    onValueChange={(v) => setForm({ ...form, channel: v })}
                    items={[
                      { value: 'push', label: 'Push' },
                      { value: 'sms', label: 'SMS (customer mobile)' },
                      { value: 'both', label: 'Push + SMS' },
                    ]}
                  >
                    <SelectTrigger id="bc-channel" className="min-h-11 cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="push">Push</SelectItem>
                      <SelectItem value="sms">SMS (customer mobile)</SelectItem>
                      <SelectItem value="both">Push + SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bc-audience">Audience</Label>
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
                {form.target_audience === 'branch' ? (
                  <div className="flex flex-col gap-2">
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
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor="bc-title">Title</Label>
                  <span
                    className={`text-xs tabular-nums ${form.title.length > titleMax ? 'text-destructive' : 'text-muted-foreground'}`}
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
                    className={`text-xs tabular-nums ${form.body.length > messageMax ? 'text-destructive' : 'text-muted-foreground'}`}
                  >
                    {form.body.length}/{messageMax}
                    {form.channel !== 'push' ? ` · BusyBee ${BUSYBEE_SMS_SINGLE_MAX} · ~${smsCredits} SMS` : ''}
                  </span>
                </div>
                <Textarea
                  id="bc-body"
                  required
                  rows={4}
                  value={form.body}
                  maxLength={messageMax}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                />
                <MessageTokenChips
                  inputId="bc-body"
                  value={form.body}
                  onChange={(body) => setForm({ ...form, body: body.slice(0, messageMax) })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bc-url">Tap URL</Label>
                <Input
                  id="bc-url"
                  className="min-h-11"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={sending} className="min-h-11 w-full sm:w-fit">
                {sending ? 'Sending…' : 'Send broadcast'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">Recent broadcasts</CardTitle>
            <CardDescription>Last 20 sends.</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No broadcasts yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {history.map((h) => (
                  <li key={h.id} className="py-3">
                    <p className="text-sm font-semibold">{h.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.kind} · {h.channel} · {h.target_audience}
                      {h.branch_slug ? ` · ${h.branch_slug}` : ''} · sent {h.sent_count} · failed{' '}
                      {h.failed_count}
                    </p>
                    {h.body ? <p className="mt-1 text-sm text-muted-foreground">{h.body}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

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
      <CardHeader>
        <CardTitle className="text-lg">Broadcast kinds</CardTitle>
        <CardDescription>Create, edit, or archive kinds used in the compose dropdown (SA / ASA).</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
              />
              Active
            </label>
            <Button type="submit" disabled={saving} className="min-h-11">
              {saving ? 'Saving…' : editing ? 'Update kind' : 'Add kind'}
            </Button>
            {editing ? (
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => setDraft(empty)}>
                Cancel edit
              </Button>
            ) : null}
          </div>
        </form>

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
                    onClick={() =>
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
                    }
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

