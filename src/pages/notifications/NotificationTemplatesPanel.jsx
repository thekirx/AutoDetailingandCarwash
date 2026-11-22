import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Cake,
  Link2,
  ListFilter,
  MessageSquare,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Smartphone,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { getAccessTokenFresh } from '@/lib/authToken'
import {
  BUSYBEE_PUSH_BODY_MAX,
  BUSYBEE_PUSH_TITLE_MAX,
  BUSYBEE_SMS_MULTIPART_MAX,
  analyzeBusybeeSms,
  insertMessageToken,
  validateNotificationCopy,
} from '@/lib/notificationCopy'
import { TEMPLATE_CATEGORIES } from '@/lib/notificationTemplates.js'
import NotificationSimulatorPreview from '@/components/notifications/NotificationSimulatorPreview'
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
import { cn } from '@/lib/utils'

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
          className="min-h-8 cursor-pointer rounded-lg border border-border bg-muted/50 px-2 text-xs font-semibold text-foreground transition hover:border-primary/50 hover:bg-primary/10 active:scale-95"
          onClick={() => insert(token)}
        >
          {token}
        </button>
      ))}
    </div>
  )
}

const EMPTY_CUSTOM_TEMPLATE = {
  key: '',
  label: '',
  description: '',
  category: 'custom',
  channel: 'push',
  title: '',
  body: '',
  sms_body: '',
  enabled: true,
  allow_multipart: false,
}

export default function NotificationTemplatesPanel() {
  const [templates, setTemplates] = useState([])
  const [canEdit, setCanEdit] = useState(true)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [channelFilter, setChannelFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [draft, setDraft] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTemplate, setNewTemplate] = useState(EMPTY_CUSTOM_TEMPLATE)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [deletingKey, setDeletingKey] = useState(null)
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
      if (categoryFilter !== 'all' && row.category !== categoryFilter) return false
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
  }, [templates, query, channelFilter, categoryFilter])

  const grouped = useMemo(() => {
    return TEMPLATE_CATEGORIES.map((cat) => ({
      ...cat,
      rows: filtered.filter((t) => (t.category || (t.is_custom ? 'custom' : '')) === cat.id),
    })).filter((g) => g.rows.length)
  }, [filtered])

  const totalCustomCount = useMemo(() => templates.filter((t) => t.is_custom).length, [templates])
  const totalCustomizedCount = useMemo(() => templates.filter((t) => t.has_override && !t.is_custom).length, [templates])

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
    return analyzeBusybeeSms(draft.sms_body || draft.body || '', {
      allowMultiPart: Boolean(draft.allow_multipart),
    })
  }, [draft])

  const createCheck = useMemo(() => {
    if (!createOpen) return { ok: true }
    return validateNotificationCopy({
      channel: newTemplate.channel,
      title: newTemplate.title || '',
      body: newTemplate.body || '',
      sms_body: newTemplate.sms_body || '',
      allowMultiPart: Boolean(newTemplate.allow_multipart),
      requireTitle: newTemplate.channel !== 'sms',
      requireBody: newTemplate.channel !== 'sms',
    })
  }, [createOpen, newTemplate])

  async function toggleTemplateEnabled(template) {
    if (!canEdit) return
    const nextEnabled = template.enabled === false
    setTemplates((prev) =>
      prev.map((t) => (t.key === template.key ? { ...t, enabled: nextEnabled } : t)),
    )
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/notification-templates', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          key: template.key,
          enabled: nextEnabled,
        }),
      })
      if (!res.ok) {
        throw new Error('Failed to toggle status')
      }
      toast.success(`${template.label}: ${nextEnabled ? 'Enabled' : 'Paused'}`)
    } catch (err) {
      toast.error(err.message)
      load()
    }
  }

  async function saveDraft(e) {
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
          label: draft.label,
          description: draft.description,
          category: draft.category,
          channel: draft.channel,
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
      toast.success('Template saved successfully')
      setDraft(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function createCustomTemplate(e) {
    e.preventDefault()
    if (!newTemplate.label.trim()) {
      toast.error('Template label is required.')
      return
    }
    if (!createCheck.ok) {
      toast.error(createCheck.error)
      return
    }
    setSaving(true)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/notification-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(newTemplate),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Creation failed')
      setTemplates(data.templates || [])
      toast.success('Custom notification template created')
      setCreateOpen(false)
      setNewTemplate(EMPTY_CUSTOM_TEMPLATE)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteTemplate(key) {
    if (!key) return
    setDeletingKey(key)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch(`/api/notification-templates?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setTemplates(data.templates || [])
      toast.success('Template deleted')
      if (draft?.key === key) setDraft(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeletingKey(null)
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
      toast.success(`Birthday run completed · ${data.scanned || 0} match${data.scanned === 1 ? '' : 'es'} today`)
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
    <div className="grid gap-5">
      {/* Top Header Card with Quick Stats & Actions */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl font-bold tracking-tight">System &amp; Custom Templates</CardTitle>
              <Badge variant="secondary" className="font-semibold text-xs">
                {templates.length} total
              </Badge>
              {totalCustomizedCount > 0 ? (
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-medium text-xs">
                  {totalCustomizedCount} customized
                </Badge>
              ) : null}
              {totalCustomCount > 0 ? (
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium text-xs">
                  {totalCustomCount} custom
                </Badge>
              ) : null}
            </div>
            <CardDescription className="text-xs sm:text-sm">
              Manage all automated shop alerts, service milestones, and custom promotional templates. Real-time preview simulator and BusyBee SMS calculations.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-10 cursor-pointer text-xs font-semibold"
              disabled={running}
              onClick={runBirthdays}
            >
              <Cake className="size-4 text-primary" aria-hidden />
              {running ? 'Running…' : 'Send today’s birthdays'}
            </Button>
            {canEdit ? (
              <Button
                type="button"
                className="min-h-10 cursor-pointer text-xs font-semibold"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-4" aria-hidden />
                New custom template
              </Button>
            ) : null}
          </div>
        </CardHeader>

        {/* Filter controls */}
        <CardContent className="space-y-3 pt-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                aria-label="Filter notification templates"
                className="min-h-10 pl-9 text-xs sm:text-sm"
                placeholder="Search template name, trigger event, route, or copy…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Channel filter">
              {filterChannels.map((c) => (
                <Button
                  key={c.id}
                  type="button"
                  size="sm"
                  variant={channelFilter === c.id ? 'default' : 'outline'}
                  className="min-h-9 text-xs cursor-pointer"
                  onClick={() => setChannelFilter(c.id)}
                >
                  {c.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Category filter pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground mr-1">
              <ListFilter className="size-3.5" aria-hidden />
              Category:
            </span>
            <Button
              type="button"
              size="sm"
              variant={categoryFilter === 'all' ? 'secondary' : 'ghost'}
              className="h-7 px-2.5 text-xs cursor-pointer"
              onClick={() => setCategoryFilter('all')}
            >
              All
            </Button>
            {TEMPLATE_CATEGORIES.map((cat) => (
              <Button
                key={cat.id}
                type="button"
                size="sm"
                variant={categoryFilter === cat.id ? 'secondary' : 'ghost'}
                className="h-7 px-2.5 text-xs cursor-pointer"
                onClick={() => setCategoryFilter(cat.id)}
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Templates List */}
      {loading ? (
        <Card className="border-border/80 shadow-none">
          <CardContent className="py-12 text-center text-sm text-muted-foreground animate-pulse">
            Loading notification templates…
          </CardContent>
        </Card>
      ) : grouped.length === 0 ? (
        <Card className="border-border/80 shadow-none">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No notification templates match your search or filter.
          </CardContent>
        </Card>
      ) : (
        grouped.map((group) => (
          <Card key={group.id} className="border-border/80 shadow-xs">
            <CardHeader className="py-3.5 px-4 bg-muted/20 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">{group.label}</CardTitle>
                  <CardDescription className="text-xs">{group.hint}</CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-medium tabular-nums">
                  {group.rows.length} template{group.rows.length === 1 ? '' : 's'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {group.rows.map((row) => {
                  const smsInfo =
                    row.channel !== 'push'
                      ? analyzeBusybeeSms(row.sms_body || row.body || '', {
                          allowMultiPart: Boolean(row.allow_multipart),
                        })
                      : null
                  return (
                    <li
                      key={row.key}
                      className={cn(
                        'flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between transition-colors hover:bg-muted/10',
                        row.enabled === false && 'opacity-65 bg-muted/5',
                      )}
                    >
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-foreground">{row.label}</p>
                          <Badge variant="outline" className="text-[11px] font-medium uppercase">
                            {row.channel === 'sms' ? 'SMS' : row.channel === 'push' ? 'Push' : 'Push + SMS'}
                          </Badge>
                          {row.is_custom ? (
                            <Badge className="bg-emerald-600 text-white text-[11px] font-medium">
                              Custom
                            </Badge>
                          ) : null}
                          {row.has_override && !row.is_custom ? (
                            <Badge variant="secondary" className="text-[11px] font-medium text-primary">
                              Customized
                            </Badge>
                          ) : null}
                          {row.enabled === false ? (
                            <Badge variant="destructive" className="text-[11px] font-medium">
                              Paused
                            </Badge>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          )}
                        </div>

                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
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
                          <p className="truncate text-sm font-medium text-foreground/90">
                            {row.title}
                          </p>
                        ) : null}

                        {row.body && row.channel !== 'sms' ? (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {row.body}
                          </p>
                        ) : null}

                        {smsInfo ? (
                          <p
                            className={`text-xs tabular-nums font-mono ${
                              smsInfo.ok ? 'text-muted-foreground' : 'text-destructive font-semibold'
                            }`}
                          >
                            BusyBee SMS: {smsInfo.length}/{smsInfo.maxChars} chars · {smsInfo.encoding} · {smsInfo.credits} credit{smsInfo.credits === 1 ? '' : 's'}
                            {smsInfo.warning ? ` · ${smsInfo.warning}` : ''}
                          </p>
                        ) : null}
                      </div>

                      {canEdit ? (
                        <div className="flex shrink-0 items-center gap-2 pt-1 sm:pt-0">
                          {/* Quick Enable/Disable Toggle */}
                          <Button
                            type="button"
                            size="sm"
                            variant={row.enabled !== false ? 'outline' : 'secondary'}
                            className="min-h-9 text-xs cursor-pointer"
                            title={row.enabled !== false ? 'Click to pause alert' : 'Click to activate alert'}
                            onClick={() => toggleTemplateEnabled(row)}
                          >
                            {row.enabled !== false ? 'Pause' : 'Activate'}
                          </Button>

                          {/* Edit Copy */}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-9 cursor-pointer"
                            aria-label={`Edit ${row.label}`}
                            onClick={() => setDraft({ ...row })}
                          >
                            <Pencil className="size-4" />
                          </Button>

                          {/* Delete custom template */}
                          {row.is_custom ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-9 cursor-pointer text-destructive hover:bg-destructive/10"
                              disabled={deletingKey === row.key}
                              aria-label={`Delete custom template ${row.label}`}
                              onClick={() => {
                                if (window.confirm(`Delete custom template "${row.label}"?`)) {
                                  deleteTemplate(row.key)
                                }
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        ))
      )}

      {/* ===================== EDIT TEMPLATE DIALOG WITH SIMULATOR ===================== */}
      <Dialog open={Boolean(draft)} onOpenChange={(open) => { if (!open) setDraft(null) }}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-4xl p-0">
          {draft ? (
            <div className="flex flex-col">
              <DialogHeader className="p-5 pb-3 border-b border-border/80">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <DialogTitle className="text-xl font-bold">{draft.label}</DialogTitle>
                    <DialogDescription className="space-y-0.5 mt-1">
                      <span className="block font-mono text-xs text-muted-foreground">{draft.key}</span>
                      <span className="flex flex-wrap items-center gap-x-2 text-xs">
                        <span>Trigger: <strong className="text-foreground">{draft.trigger_event}</strong></span>
                        <span>→ Route: <code className="rounded bg-muted px-1 py-0.5">{draft.trigger_route}</code></span>
                      </span>
                    </DialogDescription>
                  </div>
                  <Badge variant="outline" className="uppercase text-xs font-semibold">
                    {draft.channel}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 p-5">
                {/* Form Controls */}
                <form id="edit-template-form" onSubmit={saveDraft} className="grid gap-4">
                  {draft.is_custom ? (
                    <div className="grid gap-2">
                      <Label htmlFor="edit-custom-label">Template Label</Label>
                      <Input
                        id="edit-custom-label"
                        className="min-h-10"
                        value={draft.label || ''}
                        onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                        required
                      />
                    </div>
                  ) : null}

                  {draft.channel !== 'sms' ? (
                    <div className="grid gap-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <Label htmlFor="tpl-title">
                          <Smartphone className="mr-1 inline size-3.5" aria-hidden />
                          Push &amp; In-App Title
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
                        className="min-h-10"
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
                        <Label htmlFor="tpl-body">Push &amp; Inbox Body</Label>
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
                          BusyBee SMS Copy
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
                      <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
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
                        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                          {draftSmsAnalysis.warning}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={draft.enabled !== false}
                      onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                    />
                    Template active &amp; ready to send
                  </label>
                </form>

                {/* Right Column: Live Mobile Simulator */}
                <div className="flex flex-col items-center">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Rendered preview (Live customer simulator)</p>
                  <NotificationSimulatorPreview
                    channel={draft.channel}
                    title={draft.title || draft.default_title}
                    body={draft.body || draft.default_body}
                    sms_body={draft.sms_body || draft.default_sms_body}
                    allow_multipart={draft.allow_multipart}
                    triggerRoute={draft.trigger_route}
                  />
                </div>
              </div>

              <DialogFooter className="p-4 border-t border-border/80 flex flex-wrap items-center justify-between gap-2 bg-muted/15">
                <div>
                  {draft.is_custom ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-10 text-destructive hover:bg-destructive/10 cursor-pointer"
                      disabled={saving || Boolean(deletingKey)}
                      onClick={() => {
                        if (window.confirm(`Delete custom template "${draft.label}"?`)) {
                          deleteTemplate(draft.key)
                        }
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Delete custom template
                    </Button>
                  ) : draft.has_override ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-10 text-destructive hover:bg-destructive/10 cursor-pointer"
                      disabled={resetting || saving}
                      onClick={() => resetToDefault(draft.key)}
                    >
                      <RotateCcw className="size-4" aria-hidden />
                      {resetting ? 'Resetting…' : 'Reset to default'}
                    </Button>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" className="min-h-10 cursor-pointer" onClick={() => setDraft(null)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    form="edit-template-form"
                    className="min-h-10 cursor-pointer"
                    disabled={saving || resetting || !draftCheck.ok}
                  >
                    {saving ? 'Saving…' : 'Save template'}
                  </Button>
                </div>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ===================== CREATE CUSTOM TEMPLATE DIALOG ===================== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-4xl p-0">
          <div className="flex flex-col">
            <DialogHeader className="p-5 pb-3 border-b border-border/80">
              <DialogTitle className="text-xl font-bold">New Custom Notification Template</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Create a custom notification template for shop promotions, VIP campaigns, or custom branch alerts.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 p-5">
              <form id="create-template-form" onSubmit={createCustomTemplate} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="new-tpl-label">Template Label</Label>
                  <Input
                    id="new-tpl-label"
                    className="min-h-10"
                    placeholder="e.g. Rainy Season Special 20% Off"
                    required
                    value={newTemplate.label}
                    onChange={(e) => setNewTemplate({ ...newTemplate, label: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="new-tpl-category">Category</Label>
                    <Select
                      value={newTemplate.category}
                      onValueChange={(v) => setNewTemplate({ ...newTemplate, category: v })}
                    >
                      <SelectTrigger id="new-tpl-category" className="min-h-10 cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_CATEGORIES.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="new-tpl-channel">Channel</Label>
                    <Select
                      value="push"
                      disabled
                      onValueChange={() => setNewTemplate({ ...newTemplate, channel: 'push' })}
                    >
                      <SelectTrigger id="new-tpl-channel" className="min-h-10 cursor-not-allowed">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="push">Push + In-App only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {newTemplate.channel !== 'sms' ? (
                  <div className="grid gap-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <Label htmlFor="new-tpl-title">Push Title</Label>
                      <span className="text-xs text-muted-foreground">
                        {(newTemplate.title || '').length}/{BUSYBEE_PUSH_TITLE_MAX}
                      </span>
                    </div>
                    <Input
                      id="new-tpl-title"
                      className="min-h-10"
                      maxLength={BUSYBEE_PUSH_TITLE_MAX}
                      placeholder="e.g. Hakum Auto Care promo"
                      value={newTemplate.title}
                      onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })}
                    />
                    <TokenChips
                      inputId="new-tpl-title"
                      value={newTemplate.title}
                      onChange={(title) => setNewTemplate({ ...newTemplate, title })}
                    />
                  </div>
                ) : null}

                {newTemplate.channel !== 'sms' ? (
                  <div className="grid gap-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <Label htmlFor="new-tpl-body">Push &amp; In-App Body</Label>
                      <span className="text-xs text-muted-foreground">
                        {(newTemplate.body || '').length}/{BUSYBEE_PUSH_BODY_MAX}
                      </span>
                    </div>
                    <Textarea
                      id="new-tpl-body"
                      rows={3}
                      maxLength={BUSYBEE_PUSH_BODY_MAX}
                      placeholder="e.g. Hi {name}, enjoy 20% off your next visit at {branch}!"
                      value={newTemplate.body}
                      onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
                    />
                    <TokenChips
                      inputId="new-tpl-body"
                      value={newTemplate.body}
                      onChange={(body) => setNewTemplate({ ...newTemplate, body })}
                    />
                  </div>
                ) : null}

                {newTemplate.channel !== 'push' ? (
                  <div className="grid gap-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <Label htmlFor="new-tpl-sms">BusyBee SMS Copy</Label>
                    </div>
                    <Textarea
                      id="new-tpl-sms"
                      rows={3}
                      maxLength={BUSYBEE_SMS_MULTIPART_MAX + 40}
                      placeholder="e.g. Hakum: Hi {name}, get special discounts on {service} at {branch}!"
                      value={newTemplate.sms_body}
                      onChange={(e) => setNewTemplate({ ...newTemplate, sms_body: e.target.value })}
                    />
                    <TokenChips
                      inputId="new-tpl-sms"
                      value={newTemplate.sms_body}
                      onChange={(sms_body) => setNewTemplate({ ...newTemplate, sms_body })}
                    />
                    <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={Boolean(newTemplate.allow_multipart)}
                        onChange={(e) => setNewTemplate({ ...newTemplate, allow_multipart: e.target.checked })}
                      />
                      Allow multi-part SMS up to {BUSYBEE_SMS_MULTIPART_MAX} chars (2 credits per recipient)
                    </label>
                  </div>
                ) : null}

                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={newTemplate.enabled !== false}
                    onChange={(e) => setNewTemplate({ ...newTemplate, enabled: e.target.checked })}
                  />
                  Active and ready to use
                </label>
              </form>

              {/* Live simulator preview */}
              <div className="flex flex-col items-center">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Live Customer Preview</p>
                <NotificationSimulatorPreview
                  channel={newTemplate.channel}
                  title={newTemplate.title || 'Hakum Auto Care'}
                  body={newTemplate.body || 'Custom notification message copy…'}
                  sms_body={newTemplate.sms_body || newTemplate.body}
                  allow_multipart={newTemplate.allow_multipart}
                  triggerRoute="/account"
                />
              </div>
            </div>

            <DialogFooter className="p-4 border-t border-border/80 flex items-center justify-end gap-2 bg-muted/15">
              <Button type="button" variant="ghost" className="min-h-10 cursor-pointer" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="create-template-form"
                className="min-h-10 cursor-pointer"
                disabled={saving || !createCheck.ok}
              >
                {saving ? 'Creating…' : 'Create template'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
