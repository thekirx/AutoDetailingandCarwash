import { useCallback, useEffect, useMemo, useState } from 'react'
import { Cake, MessageSquare, Pencil, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { getAccessTokenFresh } from '@/lib/authToken'
import {
  BUSYBEE_PUSH_BODY_MAX,
  BUSYBEE_PUSH_TITLE_MAX,
  BUSYBEE_SMS_SINGLE_MAX,
  busybeeSmsSegments,
  insertMessageToken,
} from '@/lib/notificationCopy'
import { TEMPLATE_CATEGORIES } from '@/lib/notificationTemplates.js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

function TokenChips({ value, onChange, inputId }) {
  const tokens = ['{name}', '{plate}', '{service}', '{branch}', '{when}', '{appUrl}']
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
      {tokens.map((token) => (
        <button
          key={token}
          type="button"
          className="min-h-8 cursor-pointer rounded-lg border border-border bg-muted/50 px-2 text-xs font-semibold"
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
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
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
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const grouped = useMemo(() => {
    return TEMPLATE_CATEGORIES.map((cat) => ({
      ...cat,
      rows: templates.filter((t) => t.category === cat.id),
    })).filter((g) => g.rows.length)
  }, [templates])

  async function save(e) {
    e.preventDefault()
    if (!draft?.key) return
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

  return (
    <div className="grid gap-4">
      <Card className="border-border/80 shadow-none">
        <CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">All push and SMS copy</CardTitle>
            <CardDescription>
              Every system notification the shop sends. Edit the text, turn one off, or leave defaults.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" className="min-h-11 shrink-0" disabled={running} onClick={runBirthdays}>
            <Cake className="size-4" aria-hidden />
            {running ? 'Running…' : 'Send today’s birthdays'}
          </Button>
        </CardHeader>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading templates…</p>
      ) : (
        grouped.map((group) => (
          <Card key={group.id} className="border-border/80 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">{group.label}</CardTitle>
              <CardDescription>{group.hint}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {group.rows.map((row) => (
                  <li key={row.key} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {row.label}
                        {row.enabled === false ? (
                          <span className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-300">off</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.channel === 'sms' ? 'SMS' : row.channel === 'push' ? 'Push' : 'Push + SMS'}
                        {row.description ? ` · ${row.description}` : ''}
                      </p>
                      {row.title ? <p className="mt-1 truncate text-sm">{row.title}</p> : null}
                    </div>
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
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}

      {draft ? (
        <Card className="border-primary/30 shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">{draft.label}</CardTitle>
            <CardDescription>{draft.key}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="grid gap-4">
              {draft.channel !== 'sms' ? (
                <div className="grid gap-2">
                  <Label htmlFor="tpl-title">
                    <Smartphone className="mr-1 inline size-3.5" aria-hidden />
                    Push title
                  </Label>
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
                    onChange={(title) => setDraft({ ...draft, title })}
                  />
                  <p className="text-xs text-muted-foreground">{(draft.title || '').length}/{BUSYBEE_PUSH_TITLE_MAX}</p>
                </div>
              ) : null}

              {draft.channel !== 'sms' ? (
                <div className="grid gap-2">
                  <Label htmlFor="tpl-body">Push body</Label>
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
                    onChange={(body) => setDraft({ ...draft, body })}
                  />
                  <p className="text-xs text-muted-foreground">{(draft.body || '').length}/{BUSYBEE_PUSH_BODY_MAX}</p>
                </div>
              ) : null}

              {draft.channel !== 'push' ? (
                <div className="grid gap-2">
                  <Label htmlFor="tpl-sms">
                    <MessageSquare className="mr-1 inline size-3.5" aria-hidden />
                    SMS
                  </Label>
                  <Textarea
                    id="tpl-sms"
                    rows={3}
                    maxLength={1000}
                    value={draft.sms_body || ''}
                    onChange={(e) => setDraft({ ...draft, sms_body: e.target.value })}
                  />
                  <TokenChips
                    inputId="tpl-sms"
                    value={draft.sms_body || ''}
                    onChange={(sms_body) => setDraft({ ...draft, sms_body })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {(draft.sms_body || '').length} chars · {busybeeSmsSegments(draft.sms_body)} SMS
                    {busybeeSmsSegments(draft.sms_body) > 1 ? ` (over ${BUSYBEE_SMS_SINGLE_MAX})` : ''}
                  </p>
                </div>
              ) : null}

              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.enabled !== false}
                  onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                />
                Send this notification
              </label>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" className="min-h-11" disabled={saving}>
                  {saving ? 'Saving…' : 'Save template'}
                </Button>
                <Button type="button" variant="ghost" className="min-h-11" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
