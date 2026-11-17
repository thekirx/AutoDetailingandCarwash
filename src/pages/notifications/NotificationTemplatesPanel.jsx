import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Cake,
  Link2,
  MessageSquare,
  Pencil,
  RotateCcw,
  Search,
  Smartphone,
} from 'lucide-react'
import { toast } from 'sonner'
import { getAccessTokenFresh } from '@/lib/authToken'
import {
  BUSYBEE_PUSH_BODY_MAX,
  BUSYBEE_PUSH_TITLE_MAX,
  BUSYBEE_SMS_MULTIPART_MAX,
  BUSYBEE_SMS_SINGLE_MAX,
  analyzeBusybeeSms,
  insertMessageToken,
  renderNotificationMessage,
  validateNotificationCopy,
} from '@/lib/notificationCopy'
import { TEMPLATE_CATEGORIES } from '@/lib/notificationTemplates.js'
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

const PREVIEW_SAMPLE_VARS = Object.freeze({
  name: 'Ana',
  plate: 'ABC-1234',
  service: 'Ceramic Coating',
  branch: 'Bacoor',
  when: ', Nov 20, 10:00 AM',
  code: 'BD8K2P',
  appUrl: 'hakumautocare.com',
})

function TokenChips({ value, onChange, inputId, tokens }) {
  const list = tokens?.length
    ? tokens.map((t) => (t.startsWith('{') ? t : `{${t}}`))
    : ['{name}', '{plate}', '{service}', '{branch}', '{when}', '{appUrl}']

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
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Insert tokens">
      {list.map((token) => (
        <button
          key={token}
          type="button"
          className="min-h-8 cursor-pointer rounded-lg border border-border bg-muted/50 px-2 text-xs font-semibold text-foreground transition hover:border-primary/50 hover:bg-primary/10"
          onClick={() => insert(token)}
        >
          {token}
        </button>
      ))}
    </div>
  )
}

export default function NotificationTemplatesPanel() {
  const [templates, setTemplates] = useState([])
  const [canEdit, setCanEdit] = useState(true)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [channelFilter, setChannelFilter] = useState('all')
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/notification-templates', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not load templates')
      setTemplates(data.templates || [])
      if (typeof data.can_edit === 'boolean') setCanEdit(data.can_edit)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return templates.filter((row) => {
      if (channelFilter !== 'all' && row.channel !== channelFilter) return false
      if (!q) return true
      return (
        String(row.label || '').toLowerCase().includes(q) ||
        String(row.key || '').toLowerCase().includes(q) ||
        String(row.trigger_event || '').toLowerCase().includes(q) ||
        String(row.trigger_route || '').toLowerCase().includes(q) ||
        String(row.body || '').toLowerCase().includes(q) ||
        String(row.sms_body || '').toLowerCase().includes(q)
      )
    })
  }, [templates, query, channelFilter])

  const grouped = useMemo(() => {
    return TEMPLATE_CATEGORIES.map((cat) => ({
      ...cat,
      rows: filtered.filter((t) => t.category === cat.id),
    })).filter((g) => g.rows.length)
  }, [filtered])

  const draftCheck = useMemo(() => {
    if (!draft) return { ok: true, smsAnalysis: null }
    return validateNotificationCopy({
      channel: draft.channel,
      title: draft.title || '',
      body: draft.body || '',
      sms_body: draft.sms_body || '',
      allowMultiPart: Boolean(draft.allow_multipart),
    })
  }, [draft])

  const draftSmsAnalysis = useMemo(() => {
    if (!draft || draft.channel === 'push') return null
    return analyzeBusybeeSms(draft.sms_body || '', {
      allowMultiPart: Boolean(draft.allow_multipart),
    })
  }, [draft])

  async function save(e) {
    e.preventDefault()
    if (!draft?.key) return
    if (!draftCheck.ok) {
      toast.error(draftCheck.error)
      return
    }
    setSaving(true)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/notification-templates', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          key: draft.key,
          title: draft.title,
          body: draft.body,
          sms_body: draft.sms_body,
          enabled: draft.enabled !== false,
          allow_multipart: Boolean(draft.allow_multipart),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setTemplates(data.templates || [])
      toast.success('Template saved')
      setDraft(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function resetToDefault(key) {
    if (!key) return
    setResetting(true)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch(`/api/notification-templates?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Reset failed')
      setTemplates(data.templates || [])
      toast.success('Restored built-in default copy')
      setDraft(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setResetting(false)
    }
  }

  async function runBirthdays() {
    setRunning(true)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/birthday-greetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: '{}',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Run failed')
      toast.success(`Birthday run done · ${data.scanned || 0} match${data.scanned === 1 ? '' : 'es'} today`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setRunning(false)
    }
  }

  const filterChannels = [
    { id: 'all', label: 'All channels' },
    { id: 'both', label: 'Push + SMS' },
    { id: 'sms', label: 'SMS only' },
    { id: 'push', label: 'Push only' },
  ]

  return (
    <div className="grid gap-4">
      <Card className="border-border/80 shadow-none">
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">System push &amp; SMS templates</CardTitle>
            <CardDescription>
              Every automated alert the shop sends, what triggers it, where a tap opens, and its BusyBee SMS segment limit ({BUSYBEE_SMS_SINGLE_MAX} chars default · up to {BUSYBEE_SMS_MULTIPART_MAX} opt-in).
            </CardDescription>
          </div>
          <Button type="button" variant="outline" className="min-h-11 shrink-0" disabled={running} onClick={runBirthdays}>
            <Cake className="size-4" aria-hidden />
            {running ? 'Running…' : 'Send today’s birthdays'}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Filter notification templates"
              className="min-h-11 pl-9"
              placeholder="Search template, trigger event, or route…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Channel filter">
            {filterChannels.map((c) => (
              <Button
                key={c.id}
                type="button"
                size="sm"
                variant={channelFilter === c.id ? 'default' : 'outline'}
                className="min-h-10"
                onClick={() => setChannelFilter(c.id)}
              >
                {c.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading templates…</p>
      ) : grouped.length === 0 ? (
        <Card className="border-border/80 shadow-none">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No templates match your filter.
          </CardContent>
        </Card>
      ) : (
        grouped.map((group) => (
          <Card key={group.id} className="border-border/80 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">{group.label}</CardTitle>
              <CardDescription>{group.hint}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {group.rows.map((row) => {
                  const smsInfo = row.channel !== 'push'
                    ? analyzeBusybeeSms(row.sms_body || '', { allowMultiPart: Boolean(row.allow_multipart) })
                    : null
                  return (
                    <li key={row.key} className="flex items-start justify-between gap-3 px-4 py-3.5">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{row.label}</p>
                          <Badge variant="outline" className="text-[11px] font-medium">
                            {row.channel === 'sms' ? 'SMS' : row.channel === 'push' ? 'Push' : 'Push + SMS'}
                          </Badge>
                          {row.has_override ? (
                            <Badge variant="secondary" className="text-[11px] font-medium">
                              Customized
                            </Badge>
                          ) : null}
                          {row.enabled === false ? (
                            <Badge variant="destructive" className="text-[11px] font-medium">
                              Off
                            </Badge>
                          ) : null}
                        </div>

                        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Link2 className="size-3 shrink-0 text-primary" aria-hidden />
                            <strong className="font-medium text-foreground">{row.trigger_event || row.description}</strong>
                          </span>
                          <span aria-hidden>→</span>
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                            {row.trigger_route || '/account'}
                          </code>
                          <span>· {row.recipient_summary}</span>
                        </p>

                        {row.title ? (
                          <p className="truncate text-sm text-foreground/90">{row.title}</p>
                        ) : null}
                        {smsInfo ? (
                          <p
                            className={`text-xs tabular-nums ${
                              smsInfo.ok ? 'text-muted-foreground' : 'text-destructive'
                            }`}
                          >
                            BusyBee SMS: {smsInfo.length}/{smsInfo.maxChars} chars · {smsInfo.encoding} · {smsInfo.credits} credit{smsInfo.credits === 1 ? '' : 's'}
                          </p>
                        ) : null}
                      </div>

                      {canEdit ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-10 shrink-0 cursor-pointer"
                          aria-label={`Edit ${row.label}`}
                          onClick={() => setDraft({ ...row })}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={Boolean(draft)} onOpenChange={(open) => { if (!open) setDraft(null) }}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          {draft ? (
            <>
              <DialogHeader>
                <DialogTitle>{draft.label}</DialogTitle>
                <DialogDescription className="space-y-1">
                  <span className="block font-mono text-xs">{draft.key}</span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                    <span>Trigger: <strong className="text-foreground">{draft.trigger_event}</strong></span>
                    <span>→ Tap route: <code className="rounded bg-muted px-1 py-0.5">{draft.trigger_route}</code></span>
                    <span>· {draft.recipient_summary}</span>
                  </span>
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={save} className="grid gap-4">
                {draft.channel !== 'sms' ? (
                  <div className="grid gap-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <Label htmlFor="tpl-title">
                        <Smartphone className="mr-1 inline size-3.5" aria-hidden />
                        Push title
                      </Label>
                      <span
                        className={`text-xs tabular-nums ${
                          (draft.title || '').trim().length > BUSYBEE_PUSH_TITLE_MAX
                            ? 'text-destructive font-semibold'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {(draft.title || '').length}/{BUSYBEE_PUSH_TITLE_MAX}
                      </span>
                    </div>
                    <Input
                      id="tpl-title"
                      className="min-h-11"
                      maxLength={BUSYBEE_PUSH_TITLE_MAX}
                      value={draft.title || ''}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    />
                    <TokenChips
                      inputId="tpl-title"
                      value={draft.title || ''}
                      tokens={draft.tokens}
                      onChange={(title) => setDraft({ ...draft, title })}
                    />
                  </div>
                ) : null}

                {draft.channel !== 'sms' ? (
                  <div className="grid gap-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <Label htmlFor="tpl-body">Push &amp; inbox body</Label>
                      <span
                        className={`text-xs tabular-nums ${
                          (draft.body || '').trim().length > BUSYBEE_PUSH_BODY_MAX
                            ? 'text-destructive font-semibold'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {(draft.body || '').length}/{BUSYBEE_PUSH_BODY_MAX}
                      </span>
                    </div>
                    <Textarea
                      id="tpl-body"
                      rows={3}
                      maxLength={BUSYBEE_PUSH_BODY_MAX}
                      value={draft.body || ''}
                      onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                    />
                    <TokenChips
                      inputId="tpl-body"
                      value={draft.body || ''}
                      tokens={draft.tokens}
                      onChange={(body) => setDraft({ ...draft, body })}
                    />
                  </div>
                ) : null}

                {draft.channel !== 'push' ? (
                  <div className="grid gap-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <Label htmlFor="tpl-sms">
                        <MessageSquare className="mr-1 inline size-3.5" aria-hidden />
                        BusyBee SMS body
                      </Label>
                      {draftSmsAnalysis ? (
                        <span
                          className={`text-xs tabular-nums ${
                            draftSmsAnalysis.ok
                              ? 'text-muted-foreground'
                              : 'font-semibold text-destructive'
                          }`}
                        >
                          {draftSmsAnalysis.length}/{draftSmsAnalysis.maxChars} · {draftSmsAnalysis.encoding} · {draftSmsAnalysis.credits} credit{draftSmsAnalysis.credits === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </div>
                    <Textarea
                      id="tpl-sms"
                      rows={3}
                      maxLength={BUSYBEE_SMS_MULTIPART_MAX + 40}
                      value={draft.sms_body || ''}
                      onChange={(e) => setDraft({ ...draft, sms_body: e.target.value })}
                    />
                    <TokenChips
                      inputId="tpl-sms"
                      value={draft.sms_body || ''}
                      tokens={draft.tokens}
                      onChange={(sms_body) => setDraft({ ...draft, sms_body })}
                    />
                    <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={Boolean(draft.allow_multipart)}
                        onChange={(e) => setDraft({ ...draft, allow_multipart: e.target.checked })}
                      />
                      Allow multi-part SMS up to {BUSYBEE_SMS_MULTIPART_MAX} chars (2 BusyBee credits per recipient)
                    </label>
                    {draftSmsAnalysis?.error ? (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-destructive" role="alert">
                        <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                        {draftSmsAnalysis.error}
                      </p>
                    ) : draftSmsAnalysis?.warning ? (
                      <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                        {draftSmsAnalysis.warning}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs">
                  <p className="font-semibold text-foreground">Rendered preview (sample)</p>
                  {draft.channel !== 'sms' ? (
                    <div className="mt-1.5 space-y-0.5 text-muted-foreground">
                      <p className="font-medium text-foreground">
                        {renderNotificationMessage(draft.title || draft.default_title || 'Notification', PREVIEW_SAMPLE_VARS)}
                      </p>
                      <p>
                        {renderNotificationMessage(draft.body || draft.default_body || '', PREVIEW_SAMPLE_VARS)}
                      </p>
                    </div>
                  ) : null}
                  {draft.channel !== 'push' && draft.sms_body ? (
                    <p className="mt-1.5 border-t border-border/70 pt-1.5 text-muted-foreground">
                      <strong className="text-foreground">SMS:</strong>{' '}
                      {renderNotificationMessage(draft.sms_body, PREVIEW_SAMPLE_VARS)}
                    </p>
                  ) : null}
                </div>

                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.enabled !== false}
                    onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                  />
                  Send this notification
                </label>

                <DialogFooter className="flex-wrap justify-between gap-2 sm:justify-between">
                  <div>
                    {draft.has_override ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 text-destructive"
                        disabled={resetting || saving}
                        onClick={() => resetToDefault(draft.key)}
                      >
                        <RotateCcw className="size-4" aria-hidden />
                        {resetting ? 'Resetting…' : 'Reset to default'}
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" className="min-h-11" onClick={() => setDraft(null)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="min-h-11" disabled={saving || resetting || !draftCheck.ok}>
                      {saving ? 'Saving…' : 'Save template'}
                    </Button>
                  </div>
                </DialogFooter>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
