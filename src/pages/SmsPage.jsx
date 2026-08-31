import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { MessageSquareWarning } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessMarketing, isAdmin } from '@/auth/permissions'
import { getSmsNotificationsEnabled, setSmsNotificationsEnabled } from '@/lib/adminApi'
import { getAccessTokenFresh } from '@/lib/authToken'
import { busybeeProviderStatusLabel } from '@/lib/busybeeHealth'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

const TYPES = ['promo', 'reminder', 'loyalty', 'birthday', 'booking_confirm', 'booking_remind']

export default function SmsPage({ embedded = false }) {
  const { profile } = useAuth()
  const [templates, setTemplates] = useState([])
  const [events, setEvents] = useState([])
  const [smsEnabled, setSmsEnabled] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [providerHealth, setProviderHealth] = useState(null)
  const [form, setForm] = useState({ name: '', template_type: 'promo', body: '' })
  const [send, setSend] = useState({ phone: '', body: '', template_type: 'promo', template_id: '' })

  const providerLabel = useMemo(() => busybeeProviderStatusLabel(providerHealth), [providerHealth])
  const sendBlocked = !smsEnabled

  const load = useCallback(async () => {
    const token = await getAccessTokenFresh().catch(() => null)
    const [t, e, enabled, health] = await Promise.all([
      supabase.from('sms_templates').select('*').order('created_at', { ascending: false }),
      supabase.from('sms_events').select('*').order('created_at', { ascending: false }).limit(30),
      getSmsNotificationsEnabled().catch((err) => {
        toast.error(err.message || 'Unable to load SMS toggle')
        return false
      }),
      fetch('/api/busybee', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(async (r) => ({ http: r.status, ...(await r.json().catch(() => ({}))) }))
        .catch((err) => ({ ok: false, error: err.message })),
    ])
    if (t.error) toast.error(t.error.message)
    if (e.error) toast.error(e.error.message)
    setTemplates(t.data || [])
    setEvents(e.data || [])
    setSmsEnabled(enabled)
    setProviderHealth(health)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!canAccessMarketing(profile)) {
    if (embedded) return <p className="text-sm text-muted-foreground">SMS requires CRM access.</p>
    return <Navigate to="/operations/access-denied" replace />
  }

  async function toggleSms() {
    if (!isAdmin(profile)) {
      toast.error('Only Admin / Super Admin can change this toggle.')
      return
    }
    setToggling(true)
    try {
      const next = !smsEnabled
      await setSmsNotificationsEnabled(next)
      setSmsEnabled(next)
      toast.success(next ? 'SMS automation on' : 'SMS automation off')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setToggling(false)
    }
  }

  async function saveTemplate(event) {
    event.preventDefault()
    const { error } = await supabase.from('sms_templates').insert({
      name: form.name.trim(),
      template_type: form.template_type,
      body: form.body.trim(),
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Template saved')
      setForm({ name: '', template_type: 'promo', body: '' })
      load()
    }
  }

  async function queueSms(event) {
    event.preventDefault()
    if (sendBlocked) {
      toast.error('Shop SMS is off — turn automation on before sending.')
      return
    }
    const token = await getAccessTokenFresh()
    if (!token) {
      toast.error('Sign in required')
      return
    }
    const res = await fetch('/api/busybee', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ phone: send.phone.trim(), message: send.body.trim() }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.ok) {
      toast.error(body.providerResponse || body.error || 'BusyBee send failed')
    } else {
      toast.success('SMS sent via BusyBee')
    }
    await supabase.from('sms_events').insert({
      phone: send.phone.trim(),
      message: send.body.trim(),
      event_type: send.template_type,
      status: body.ok ? 'sent' : 'failed',
      provider: 'busybee',
      provider_response: body.providerResponse || null,
      sent_at: body.ok ? new Date().toISOString() : null,
    })
    setSend({ phone: '', body: '', template_type: 'promo', template_id: '' })
    load()
  }

  const statusPanel = (
    <div
      className={cn(
        'rounded-2xl border px-4 py-4 sm:px-5',
        smsEnabled
          ? 'border-border bg-muted/20'
          : 'border-amber-500/35 bg-amber-500/[0.07]',
      )}
      role="status"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-2xl space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
            <MessageSquareWarning className="size-4 shrink-0 text-primary" aria-hidden />
            Status SMS automation
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            When on, customers get BusyBee SMS on booking received, queue status, payment ready, and
            completed. Keep this off until BrandTxt whitelists the live egress IP.
          </p>
          <p className="text-sm">
            Shop gate:{' '}
            <strong className={smsEnabled ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-300'}>
              {smsEnabled ? 'Enabled' : 'Disabled'}
            </strong>
            {!isAdmin(profile) ? (
              <span className="text-muted-foreground"> · Only Admin / Super Admin can change this.</span>
            ) : null}
          </p>
          {providerLabel ? (
            <p
              className={cn(
                'text-sm leading-relaxed',
                providerLabel.tone === 'ok' && 'text-emerald-700 dark:text-emerald-400',
                providerLabel.tone === 'warn' && 'text-amber-800 dark:text-amber-300',
                providerLabel.tone === 'error' && 'text-destructive',
              )}
            >
              Provider: {providerLabel.text}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          className="min-h-11 w-full shrink-0 sm:w-auto"
          variant={smsEnabled ? 'default' : 'outline'}
          disabled={toggling || !isAdmin(profile)}
          onClick={toggleSms}
        >
          {toggling ? 'Saving…' : smsEnabled ? 'Turn SMS off' : 'Turn SMS on'}
        </Button>
      </div>
    </div>
  )

  const body = (
    <div className="flex flex-col gap-6">
      {statusPanel}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">New template</CardTitle>
            <CardDescription>Saved copy for campaigns and queue sends.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveTemplate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="sms-tpl-name">Name</Label>
                <Input
                  id="sms-tpl-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Type</Label>
                <Select value={form.template_type} onValueChange={(v) => setForm({ ...form, template_type: v })}>
                  <SelectTrigger className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sms-tpl-body">Body</Label>
                <Textarea
                  id="sms-tpl-body"
                  required
                  className="min-h-28"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                />
              </div>
              <Button type="submit" className="min-h-11 w-full sm:w-auto">
                Save template
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'border-border/80 shadow-none',
            sendBlocked && 'opacity-90',
          )}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Send / queue SMS</CardTitle>
            <CardDescription>
              {sendBlocked
                ? 'Sending is locked while shop SMS automation is off.'
                : 'One-off BusyBee send (still uses live provider).'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={queueSms} className="flex flex-col gap-4">
              <fieldset disabled={sendBlocked} className="flex flex-col gap-4 disabled:opacity-60">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sms-send-phone">Phone</Label>
                  <Input
                    id="sms-send-phone"
                    required
                    inputMode="tel"
                    autoComplete="tel"
                    value={send.phone}
                    onChange={(e) => setSend({ ...send, phone: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Use template</Label>
                  <Select
                    value={send.template_id || '__none__'}
                    onValueChange={(v) => {
                      if (v === '__none__') {
                        setSend((s) => ({ ...s, template_id: '', body: s.body }))
                        return
                      }
                      const t = templates.find((row) => row.id === v)
                      if (!t) return
                      setSend((s) => ({
                        ...s,
                        template_id: t.id,
                        template_type: t.template_type || s.template_type,
                        body: t.body || '',
                      }))
                    }}
                  >
                    <SelectTrigger className="min-h-11">
                      <SelectValue placeholder="Optional template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None — write custom</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Type</Label>
                  <Select value={send.template_type} onValueChange={(v) => setSend({ ...send, template_type: v })}>
                    <SelectTrigger className="min-h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sms-send-body">Message</Label>
                  <Textarea
                    id="sms-send-body"
                    required
                    className="min-h-28"
                    value={send.body}
                    onChange={(e) => setSend({ ...send, body: e.target.value, template_id: '' })}
                  />
                </div>
              </fieldset>
              <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={sendBlocked}>
                {sendBlocked ? 'SMS off — send locked' : 'Queue SMS'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Templates</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Body</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length ? (
                templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.template_type}</TableCell>
                    <TableCell className="max-w-[14rem] truncate sm:max-w-md">{t.body}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-10"
                        disabled={sendBlocked}
                        onClick={() =>
                          setSend((s) => ({
                            ...s,
                            template_id: t.id,
                            template_type: t.template_type || 'promo',
                            body: t.body || '',
                          }))
                        }
                      >
                        Use
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No templates yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recent SMS events</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell className="whitespace-nowrap text-xs tabular-nums">
                    {ev.sent_at || ev.created_at
                      ? new Date(ev.sent_at || ev.created_at).toLocaleString()
                      : '—'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{ev.phone}</TableCell>
                  <TableCell>{ev.event_type}</TableCell>
                  <TableCell>{ev.status}</TableCell>
                  <TableCell className="max-w-[12rem] truncate text-xs sm:max-w-xs">{ev.message}</TableCell>
                </TableRow>
              ))}
              {!events.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No SMS events yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )

  if (embedded) {
    return (
      <section className="flex flex-col gap-4" aria-label="SMS">
        <p className="text-sm text-muted-foreground">Templates, BusyBee send, and SMS event log.</p>
        {body}
      </section>
    )
  }

  return (
    <OpsPageShell
      eyebrow="Marketing"
      title="SMS campaigns"
      icon={MessageSquareWarning}
      description="Shop kill switch, BusyBee health, templates, and send log — aligned with Notifications ops chrome."
      meta={
        <span className="tabular-nums">
          Gate {smsEnabled ? 'ON' : 'OFF'}
          {providerLabel ? ` · ${providerLabel.tone}` : ''}
        </span>
      }
    >
      {body}
    </OpsPageShell>
  )
}
