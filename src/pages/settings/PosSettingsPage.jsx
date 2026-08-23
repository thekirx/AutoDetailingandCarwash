import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { isAdmin } from '@/auth/permissions'
import { supabase } from '@/lib/supabase'
import { normalizePosSettings, toPosSettingsRow } from '@/lib/posSettings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

/** Settings → POS: payment methods, expense kinds, shift-close field editor. */
export default function PosSettingsPage() {
  const { profile } = useAuth()
  const canWrite = isAdmin(profile)
  const [settings, setSettings] = useState(() => normalizePosSettings())
  const [fields, setFields] = useState([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [posRes, fieldRes] = await Promise.all([
      supabase.from('ops_pos_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('shift_close_field_config').select('*').order('sort_order'),
    ])
    if (posRes.error && !/ops_pos_settings|relation|does not exist/i.test(posRes.error.message)) {
      toast.error(posRes.error.message)
    } else if (posRes.data) setSettings(normalizePosSettings(posRes.data))
    if (fieldRes.error) toast.error(fieldRes.error.message)
    else setFields(fieldRes.data || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function savePosSettings(e) {
    e.preventDefault()
    if (!canWrite) return
    setSaving(true)
    const row = toPosSettingsRow(settings)
    const { error } = await supabase.from('ops_pos_settings').upsert(row, { onConflict: 'id' })
    setSaving(false)
    if (error) toast.error(error.message)
    else toast.success('POS settings saved')
  }

  async function saveField(row) {
    if (!canWrite) return
    const { error } = await supabase
      .from('shift_close_field_config')
      .update({
        label: row.label,
        allow_override: Boolean(row.allow_override),
        is_active: row.is_active !== false,
        sort_order: Number(row.sort_order) || 0,
      })
      .eq('field_key', row.field_key)
    if (error) toast.error(error.message)
    else {
      toast.success('Field updated')
      load()
    }
  }

  function updateMethod(i, patch) {
    setSettings((prev) => {
      const payment_methods = prev.payment_methods.map((m, idx) => (idx === i ? { ...m, ...patch } : m))
      return { ...prev, payment_methods }
    })
  }

  function updateKind(i, patch) {
    setSettings((prev) => {
      const expense_kinds = prev.expense_kinds.map((k, idx) => (idx === i ? { ...k, ...patch } : k))
      return { ...prev, expense_kinds }
    })
  }

  return (
    <section className="flex flex-col gap-6 pb-8">
      <header className="border-b border-border pb-4">
        <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Settings</p>
        <h1 className="text-2xl font-semibold tracking-tight">POS settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Payment methods, POS expense kinds, and end-of-shift field labels. Runtime reads these rows — not a second chrome copy.
        </p>
        <Button type="button" variant="outline" className="mt-3 min-h-11" asChild>
          <Link to="/operations/settings">← Company settings</Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Payment methods &amp; expense kinds</CardTitle>
          <CardDescription>Shown on POS checkout and Expenses tab.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePosSettings} className="space-y-6">
            <div className="space-y-3">
              <Label>Payment methods</Label>
              {settings.payment_methods.map((m, i) => (
                <div key={`${m.value}-${i}`} className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={m.value}
                    disabled={!canWrite}
                    onChange={(e) => updateMethod(i, { value: e.target.value.trim().toLowerCase() })}
                    placeholder="value"
                  />
                  <Input
                    value={m.label}
                    disabled={!canWrite}
                    onChange={(e) => updateMethod(i, { label: e.target.value })}
                    placeholder="Label"
                  />
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <Label>Expense kinds</Label>
              {settings.expense_kinds.map((k, i) => (
                <div key={`${k.value}-${i}`} className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={k.value}
                    disabled={!canWrite}
                    onChange={(e) => updateKind(i, { value: e.target.value.trim().toLowerCase() })}
                    placeholder="value"
                  />
                  <Input
                    value={k.label}
                    disabled={!canWrite}
                    onChange={(e) => updateKind(i, { label: e.target.value })}
                    placeholder="Label"
                  />
                </div>
              ))}
            </div>
            {canWrite ? (
              <Button type="submit" className="min-h-11" disabled={saving}>
                {saving ? 'Saving…' : 'Save POS lists'}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Only Super Admin can edit.</p>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>End-of-shift fields</CardTitle>
          <CardDescription>
            Labels, sort order, active flag, and BA override. Same table Finance uses for review.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!fields.length ? (
            <p className="text-sm text-muted-foreground">No field config rows yet.</p>
          ) : (
            fields.map((row) => (
              <div key={row.field_key} className="rounded-xl border border-border p-3 space-y-2">
                <p className="text-xs font-mono text-muted-foreground">{row.field_key}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={row.label || ''}
                      disabled={!canWrite}
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((f) => (f.field_key === row.field_key ? { ...f, label: e.target.value } : f)),
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Sort</Label>
                    <Input
                      type="number"
                      value={row.sort_order ?? 0}
                      disabled={!canWrite}
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((f) =>
                            f.field_key === row.field_key ? { ...f, sort_order: Number(e.target.value) || 0 } : f,
                          ),
                        )
                      }
                    />
                  </div>
                  <label className="flex items-end gap-2 text-sm pb-2">
                    <input
                      type="checkbox"
                      checked={row.allow_override === true}
                      disabled={!canWrite}
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((f) =>
                            f.field_key === row.field_key ? { ...f, allow_override: e.target.checked } : f,
                          ),
                        )
                      }
                    />
                    Allow BA override
                  </label>
                  <label className="flex items-end gap-2 text-sm pb-2">
                    <input
                      type="checkbox"
                      checked={row.is_active !== false}
                      disabled={!canWrite}
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((f) =>
                            f.field_key === row.field_key ? { ...f, is_active: e.target.checked } : f,
                          ),
                        )
                      }
                    />
                    Active
                  </label>
                </div>
                {canWrite ? (
                  <Button type="button" variant="secondary" className="min-h-11" onClick={() => saveField(row)}>
                    Save field
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  )
}
