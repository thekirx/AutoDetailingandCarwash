import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Bell, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canManageNotifications } from '@/auth/permissions'
import { getAccessTokenFresh } from '@/lib/authToken'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Super Admin / ASA — configure automated reminders per service.
 * Default: every 6 months, push channel. Override per service + branch.
 */
export default function NotificationSettingsPage() {
  const { profile } = useAuth()
  const [services, setServices] = useState([])
  const [branches, setBranches] = useState([])
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({
    service_id: '',
    branch_slug: '',
    channel: 'push',
    frequency_months: 6,
    enabled: true,
  })

  const load = useCallback(async () => {
    setLoading(true)
    const token = await getAccessTokenFresh()
    const [svcRes, brRes, setRes] = await Promise.all([
      supabase.from('services').select('id, name, pay_category').order('name'),
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

  async function saveDraft(e) {
    e.preventDefault()
    if (!draft.frequency_months || draft.frequency_months < 1) {
      toast.error('Frequency must be at least 1 month.')
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
          service_id: draft.service_id || null,
          branch_slug: draft.branch_slug || null,
          channel: draft.channel,
          frequency_months: Number(draft.frequency_months),
          enabled: draft.enabled,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Save failed')
        return
      }
      toast.success('Reminder saved')
      setDraft({ service_id: '', branch_slug: '', channel: 'push', frequency_months: 6, enabled: true })
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
        <p className="mt-1 text-sm text-muted-foreground">
          Automated SMS or push reminders sent to customers after a service completes. Defaults to every 6 months.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>New reminder rule</CardTitle>
          <CardDescription>Leave service or branch blank to apply as a default.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveDraft} className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ns-service">Service</Label>
              <Select value={draft.service_id} onValueChange={(v) => setDraft({ ...draft, service_id: v === '__all__' ? '' : v })}>
                <SelectTrigger id="ns-service" className="cursor-pointer"><SelectValue placeholder="All services" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All services (default)</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ns-branch">Branch</Label>
              <Select value={draft.branch_slug} onValueChange={(v) => setDraft({ ...draft, branch_slug: v === '__all__' ? '' : v })}>
                <SelectTrigger id="ns-branch" className="cursor-pointer"><SelectValue placeholder="All branches" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All branches</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ns-channel">Channel</Label>
              <Select value={draft.channel} onValueChange={(v) => setDraft({ ...draft, channel: v })}>
                <SelectTrigger id="ns-channel" className="cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="push">Push</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
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
            <p className="text-sm text-muted-foreground">No reminders configured. Default is push every 6 months.</p>
          ) : (
            <ul className="divide-y divide-border">
              {settings.map((s) => {
                const svc = services.find((x) => x.id === s.service_id)
                const br = branches.find((x) => x.slug === s.branch_slug)
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {svc?.name || 'All services'} · {br?.name || 'All branches'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.channel.toUpperCase()} · every {s.frequency_months} month{s.frequency_months === 1 ? '' : 's'} ·{' '}
                        {s.enabled ? 'On' : 'Off'}
                      </p>
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
