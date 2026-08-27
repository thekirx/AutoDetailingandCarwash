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
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

/**
 * POS settings — payment methods, expense kinds, shift-close field labels.
 * Embedded on POS Settings tab; also used by /operations/settings/pos.
 */
export default function PosSettingsPanel({ embedded = false }) {
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
    <div className="flex flex-col gap-6">
      {!embedded ? (
        <header className="border-b border-border pb-4">
          <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Settings</p>
          <h1 className="text-2xl font-semibold tracking-tight">POS settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Payment methods, POS expense kinds, and end-of-shift field labels. Checkout reads these lists live.
          </p>
          <Button type="button" variant="outline" className="mt-3 min-h-11" asChild>
            <Link to="/operations/settings">← Company settings</Link>
          </Button>
        </header>
      ) : (
        <Card className="border-border/80 bg-muted/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Customize this counter</CardTitle>
            <CardDescription>
              Payment methods appear at checkout. Expense kinds appear under Expenses. Crew late-pay weights live under{' '}
              <Link to="/operations/attendance?tab=settings" className="font-medium text-primary underline-offset-2 hover:underline">
                Attendance → Settings
              </Link>
              . Payroll rules:{' '}
              <Link to="/operations/settings/payroll" className="font-medium text-primary underline-offset-2 hover:underline">
                Payroll settings
              </Link>
              .
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Payment methods and expense kinds</CardTitle>
          <CardDescription>Shown on checkout and the Expenses tab after you save.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePosSettings} className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <Label>Payment methods</Label>
              {settings.payment_methods.map((m, i) => (
                <div key={`${m.value}-${i}`} className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={m.value}
                    disabled={!canWrite}
                    onChange={(e) => updateMethod(i, { value: e.target.value.trim().toLowerCase() })}
                    placeholder="value"
                    className="min-h-11"
                  />
                  <Input
                    value={m.label}
                    disabled={!canWrite}
                    onChange={(e) => updateMethod(i, { label: e.target.value })}
                    placeholder="Label"
                    className="min-h-11"
                  />
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex flex-col gap-3">
              <Label>Expense kinds</Label>
              {settings.expense_kinds.map((k, i) => (
                <div key={`${k.value}-${i}`} className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={k.value}
                    disabled={!canWrite}
                    onChange={(e) => updateKind(i, { value: e.target.value.trim().toLowerCase() })}
                    placeholder="value"
                    className="min-h-11"
                  />
                  <Input
                    value={k.label}
                    disabled={!canWrite}
                    onChange={(e) => updateKind(i, { label: e.target.value })}
                    placeholder="Label"
                    className="min-h-11"
                  />
                </div>
              ))}
            </div>
            {canWrite ? (
              <Button type="submit" className="min-h-11 w-fit" disabled={saving}>
                {saving ? 'Saving…' : 'Save POS lists'}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Only Super Admin can edit lists.</p>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>End-of-shift fields</CardTitle>
          <CardDescription>Labels and sort order for the shift-close wizard. Finance uses the same rows.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!fields.length ? (
            <p className="text-sm text-muted-foreground">No field config rows yet.</p>
          ) : (
            fields.map((row) => (
              <div key={row.field_key} className="flex flex-col gap-2 rounded-xl border border-border p-3">
                <p className="font-mono text-xs text-muted-foreground">{row.field_key}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={row.label || ''}
                      disabled={!canWrite}
                      className="min-h-11"
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((f) => (f.field_key === row.field_key ? { ...f, label: e.target.value } : f)),
                        )
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Sort</Label>
                    <Input
                      type="number"
                      value={row.sort_order ?? 0}
                      disabled={!canWrite}
                      className="min-h-11"
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((f) =>
                            f.field_key === row.field_key ? { ...f, sort_order: Number(e.target.value) || 0 } : f,
                          ),
                        )
                      }
                    />
                  </div>
                  <label className="flex min-h-11 items-center gap-2 text-sm">
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
                  <label className="flex min-h-11 items-center gap-2 text-sm">
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
                  <Button type="button" variant="secondary" className="min-h-11 w-fit" onClick={() => saveField(row)}>
                    Save field
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
