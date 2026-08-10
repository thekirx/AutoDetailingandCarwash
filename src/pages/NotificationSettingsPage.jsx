import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Bell, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canManageNotifications } from '@/auth/permissions'
import { getAccessTokenFresh } from '@/lib/authToken'
import {
  BUSYBEE_SMS_SINGLE_MAX,
  NOTIFICATION_SCOPES,
  busybeeSmsSegments,
  messageMaxForChannel,
  notificationScopeLabel,
  titleMaxForChannel,
} from '@/lib/notificationCopy'
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

const EMPTY_DRAFT = {
  scope: 'whole',
  service_id: '',
  branch_slug: '',
  channel: 'push',
  frequency_months: 6,
  enabled: true,
  title: 'Hakum Auto Care: Time for your maintenance',
  message:
    'Hi {name}, {plate} is due for {service} maintenance. Book your next visit at hakumautocare.com/book.',
}

/**
 * Super Admin / ASA — smart detailing reminders with custom BusyBee-safe copy.
 */
export default function NotificationSettingsPage() {
  const { profile } = useAuth()
  const [services, setServices] = useState([])
  const [branches, setBranches] = useState([])
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)

  const detailingServices = useMemo(() => filterFloorDetailingServices(services), [services])
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

  if (!canManageNotifications(profile)) return <Navigate to="/operations/access-denied" replace />

  function setScope(scope) {
    setDraft((d) => ({
      ...d,
      scope,
      service_id: scope === 'whole' || scope === 'per_branch' ? '' : d.service_id,
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
      setDraft(EMPTY_DRAFT)
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
    <section className="flex flex-col gap-6 pb-8">
      <header className="border-b border-border pb-4">
        <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Settings</p>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <Bell className="size-6" aria-hidden /> Reminder notifications
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Smart detailing reminders after Successful Release. Scope by whole network, branch, or service — with a custom BusyBee-safe message.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>New reminder rule</CardTitle>
          <CardDescription>
            Detailing services only. Tokens: {'{name}'} {'{plate}'} {'{service}'} {'{branch}'}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveDraft} className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="ns-scope">Scope</Label>
              <Select value={draft.scope} onValueChange={setScope}>
                <SelectTrigger id="ns-scope" className="cursor-pointer"><SelectValue /></SelectTrigger>
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
                <Select value={draft.service_id} onValueChange={(v) => setDraft({ ...draft, service_id: v })}>
                  <SelectTrigger id="ns-service" className="cursor-pointer"><SelectValue placeholder="Pick service" /></SelectTrigger>
                  <SelectContent>
                    {detailingServices.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {needsBranch ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="ns-branch">Branch</Label>
                <Select value={draft.branch_slug} onValueChange={(v) => setDraft({ ...draft, branch_slug: v })}>
                  <SelectTrigger id="ns-branch" className="cursor-pointer"><SelectValue placeholder="Pick branch" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="ns-channel">Channel</Label>
              <Select value={draft.channel} onValueChange={(v) => setDraft({ ...draft, channel: v })}>
                <SelectTrigger id="ns-channel" className="cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="push">Push</SelectItem>
                  <SelectItem value="sms">SMS (BusyBee)</SelectItem>
                  <SelectItem value="both">Push + SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ns-freq">Frequency (months)</Label>
              <Input
                id="ns-freq"
                type="number"
                min={1}
                max={24}
                value={draft.frequency_months}
                onChange={(e) => setDraft({ ...draft, frequency_months: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="ns-title">Title</Label>
                <span className={`text-xs tabular-nums ${draft.title.length > titleMax ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {draft.title.length}/{titleMax}
                </span>
              </div>
              <Input
                id="ns-title"
                value={draft.title}
                maxLength={titleMax}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                required
              />
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="ns-message">Custom message</Label>
                <span className={`text-xs tabular-nums ${draft.message.length > messageMax ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {draft.message.length}/{messageMax}
                  {draft.channel !== 'push' ? ` · BusyBee ${BUSYBEE_SMS_SINGLE_MAX} · ~${smsCredits} SMS` : ''}
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
              <p className="text-xs text-muted-foreground">
                {draft.channel === 'push'
                  ? 'Push body capped at 200 characters.'
                  : `BusyBee single SMS is ${BUSYBEE_SMS_SINGLE_MAX} characters. Longer copy bills extra segments.`}
              </p>
            </div>

            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="ns-enabled"
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              />
              <Label htmlFor="ns-enabled">Enabled</Label>
            </div>

            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save reminder'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active reminders</CardTitle>
          <CardDescription>{loading ? 'Loading…' : `${settings.length} rule${settings.length === 1 ? '' : 's'}`}</CardDescription>
        </CardHeader>
        <CardContent>
          {settings.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">No reminders configured yet. Default fallback is push every 6 months.</p>
          ) : (
            <ul className="divide-y divide-border">
              {settings.map((s) => {
                const svc = detailingServices.find((x) => x.id === s.service_id) || services.find((x) => x.id === s.service_id)
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
                        {(s.channel || 'push').toUpperCase()} · every {s.frequency_months} month{s.frequency_months === 1 ? '' : 's'} ·{' '}
                        {s.enabled ? 'On' : 'Off'}
                      </p>
                      {s.title ? <p className="mt-1 truncate text-sm">{s.title}</p> : null}
                      {s.message ? <p className="truncate text-xs text-muted-foreground">{s.message}</p> : null}
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeSetting(s.id)} aria-label="Remove reminder">
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
