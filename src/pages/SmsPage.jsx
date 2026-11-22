import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AlertTriangle, MessageSquareWarning, Pencil, Plus, RefreshCw, Settings, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canSendCustomerSms, isAdmin, isSuperAdmin } from '@/auth/permissions'
import { getSmsNotificationsEnabled, setSmsNotificationsEnabled } from '@/lib/adminApi'
import { getAccessTokenFresh } from '@/lib/authToken'
import { busybeeProviderStatusLabel, formatBusybeeBalance } from '@/lib/busybeeHealth'
import {
  BUSYBEE_SMS_MULTIPART_MAX,
  BUSYBEE_SMS_SINGLE_MAX,
  analyzeBusybeeSms,
} from '@/lib/notificationCopy'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import OpsPageShell from '@/components/ops/OpsPageShell'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

const TYPES = ['booking_confirm', 'reminder', 'loyalty', 'birthday', 'promo', 'booking_remind']

const EMPTY_TEMPLATE_FORM = { id: '', name: '', template_type: 'booking_confirm', body: '', allow_multipart: false }

export default function SmsPage({ embedded = false }) {
  const { profile } = useAuth()
  const [templates, setTemplates] = useState([])
  const [canEditTemplates, setCanEditTemplates] = useState(false)
  const [events, setEvents] = useState([])
  const [smsEnabled, setSmsEnabled] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [providerHealth, setProviderHealth] = useState(null)
  const [form, setForm] = useState(EMPTY_TEMPLATE_FORM)
  const [tplOpen, setTplOpen] = useState(false)
  const [savingTpl, setSavingTpl] = useState(false)

  const providerLabel = useMemo(() => busybeeProviderStatusLabel(providerHealth), [providerHealth])
  const balanceText = useMemo(() => formatBusybeeBalance(providerHealth), [providerHealth])
  const formAnalysis = useMemo(
    () => analyzeBusybeeSms(form.body, { allowMultiPart: Boolean(form.allow_multipart) }),
    [form.body, form.allow_multipart],
  )

  const load = useCallback(async () => {
    const token = await getAccessTokenFresh().catch(() => null)
    const [tplRes, e, enabled, health] = await Promise.all([
      fetch('/api/notifications?operation=sms-templates', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(async (r) => ({ ok: r.ok, ...(await r.json().catch(() => ({}))) }))
        .catch((err) => ({ ok: false, error: err.message })),
      supabase
        .from('sms_events')
        .select('id, phone, event_type, status, provider, provider_response, created_at, sent_at')
        .order('created_at', { ascending: false })
        .limit(30),
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
    if (!tplRes.ok && tplRes.error) toast.error(tplRes.error)
    if (e.error) toast.error(e.error.message)
    setTemplates(tplRes.templates || [])
    setCanEditTemplates(Boolean(tplRes.can_edit))
    setEvents(e.data || [])
    setSmsEnabled(enabled)
    setProviderHealth(health)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!canSendCustomerSms(profile)) {
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
    if (!formAnalysis.ok) {
      toast.error(formAnalysis.error)
      return
    }
    const token = await getAccessTokenFresh()
    if (!token) {
      toast.error('Sign in required')
      return
    }
    setSavingTpl(true)
    try {
      const editing = Boolean(form.id)
      const res = await fetch('/api/notifications?operation=sms-templates', {
        method: editing ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...(editing ? { id: form.id } : {}),
          name: form.name.trim(),
          template_type: form.template_type,
          body: form.body.trim(),
          allow_multipart: Boolean(form.allow_multipart),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Could not save template')
        return
      }
      toast.success(editing ? 'Template updated' : 'Template saved')
      setForm(EMPTY_TEMPLATE_FORM)
      setTplOpen(false)
      load()
    } finally {
      setSavingTpl(false)
    }
  }

  async function deleteTemplate(id) {
    const token = await getAccessTokenFresh()
    const res = await fetch(`/api/notifications?operation=sms-templates&id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error || 'Delete failed')
      return
    }
    toast.success('Template deleted')
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
            When on, customers receive BusyBee SMS strictly for live booking &amp; queue status
            updates covering <strong>Detailing</strong>, <strong>Services</strong>, and{' '}
            <strong>Packages</strong> (received, confirmed, waiting, in bay, final check, payment
            ready, completed, cancelled, photos ready). BrandTxt IP whitelisting is no longer
            required on account <code>HAKUM</code>. Broadcasts, reminders, birthday perks, and staff
            alerts use Web Push &amp; In-App Inbox only.
          </p>
          <p className="text-sm">
            Shop gate:{' '}
            <strong className={smsEnabled ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-300'}>
              {smsEnabled ? 'Enabled' : 'Disabled'}
            </strong>
            {balanceText ? (
              <span className="ml-3 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                · BusyBee Balance: {balanceText}
              </span>
            ) : null}
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
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button type="button" variant="outline" className="min-h-11 cursor-pointer" onClick={load}>
            <RefreshCw className="mr-1.5 size-4" aria-hidden />
            Refresh
          </Button>
          {isSuperAdmin(profile) ? (
            <Button type="button" variant="outline" className="min-h-11" asChild>
              <Link to="/operations/notifications?tab=settings">
                <Settings className="mr-1.5 size-4" aria-hidden />
                Notification Settings
              </Link>
            </Button>
          ) : null}
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
    </div>
  )

  const body = (
    <div className="flex flex-col gap-6">
      {statusPanel}

      <Dialog open={tplOpen} onOpenChange={(open) => { setTplOpen(open); if (!open) setForm(EMPTY_TEMPLATE_FORM) }}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit SMS template' : 'New SMS template'}</DialogTitle>
            <DialogDescription>
              Validated against BusyBee limits ({BUSYBEE_SMS_SINGLE_MAX} chars single SMS · {BUSYBEE_SMS_MULTIPART_MAX} opt-in multi-part).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveTemplate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sms-tpl-name">Name</Label>
              <Input
                id="sms-tpl-name"
                required
                maxLength={80}
                className="min-h-11"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Type</Label>
              <Select value={form.template_type} onValueChange={(v) => setForm({ ...form, template_type: v })}>
                <SelectTrigger className="min-h-11 w-full">
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
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="sms-tpl-body">Body</Label>
                <span
                  className={`text-xs tabular-nums ${
                    formAnalysis.ok ? 'text-muted-foreground' : 'font-semibold text-destructive'
                  }`}
                >
                  {formAnalysis.length}/{formAnalysis.maxChars} · {formAnalysis.encoding} · {formAnalysis.credits} credit{formAnalysis.credits === 1 ? '' : 's'}
                </span>
              </div>
              <Textarea
                id="sms-tpl-body"
                required
                className="min-h-28"
                maxLength={BUSYBEE_SMS_MULTIPART_MAX + 40}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
              <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={Boolean(form.allow_multipart)}
                  onChange={(e) => setForm({ ...form, allow_multipart: e.target.checked })}
                />
                Allow multi-part SMS up to {BUSYBEE_SMS_MULTIPART_MAX} chars (2 credits)
              </label>
              {formAnalysis.error ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-destructive" role="alert">
                  <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                  {formAnalysis.error}
                </p>
              ) : formAnalysis.warning ? (
                <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                  {formAnalysis.warning}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => { setTplOpen(false); setForm(EMPTY_TEMPLATE_FORM) }}>
                Cancel
              </Button>
              <Button type="submit" className="min-h-11" disabled={savingTpl || !formAnalysis.ok}>
                {savingTpl ? 'Saving…' : form.id ? 'Update template' : 'Save template'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Manual &amp; promo SMS disabled</CardTitle>
          <CardDescription>
            BusyBee SMS credits are reserved strictly for automated customer status updates across
            Detailing, Services, and Packages. Use Notifications &rarr; Broadcast for customer Push
            &amp; In-App announcements.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
          <CardTitle className="text-lg">Reference SMS templates</CardTitle>
          {canEditTemplates ? (
            <Button type="button" className="min-h-11" onClick={() => { setForm(EMPTY_TEMPLATE_FORM); setTplOpen(true) }}>
              <Plus size={16} className="mr-1.5" aria-hidden />
              New template
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Body</TableHead>
                <TableHead className="w-40" />
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
                      <div className="flex items-center gap-1">
                        {canEditTemplates ? (
                          <>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-10"
                              aria-label={`Edit ${t.name}`}
                              onClick={() => {
                                setForm({
                                  id: t.id,
                                  name: t.name || '',
                                  template_type: t.template_type || 'booking_confirm',
                                  body: t.body || '',
                                  allow_multipart: Boolean(t.allow_multipart),
                                })
                                setTplOpen(true)
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-10 text-destructive"
                              aria-label={`Delete ${t.name}`}
                              onClick={() => deleteTemplate(t.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        ) : null}
                      </div>
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
        <p className="text-sm text-muted-foreground">Status SMS switch, BusyBee balance, and SMS delivery log.</p>
        {body}
      </section>
    )
  }

  return (
    <OpsPageShell
      eyebrow="Notifications"
      title="Status SMS &amp; log"
      icon={MessageSquareWarning}
      description="Shop kill switch, BusyBee balance health, and automated Detailing/Services/Packages status SMS log."
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
