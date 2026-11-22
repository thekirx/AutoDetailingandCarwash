import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canWritePosSettings } from '@/auth/permissions'
import { supabase } from '@/lib/supabase'
import { normalizePosSettings, toPosSettingsRow } from '@/lib/posSettings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

function hasDuplicateValues(items) {
  const seen = new Set()
  for (const item of items) {
    const val = String(item.value || '').trim().toLowerCase()
    if (!val || !String(item.label || '').trim()) return { invalid: true, message: 'Each row needs both a key slug and display label.' }
    if (seen.has(val)) return { invalid: true, message: `Duplicate key "${val}" — keys must be unique.` }
    seen.add(val)
  }
  return { invalid: false }
}

/**
 * POS settings — payment methods, expense kinds, shift-close field labels.
 * Embedded on POS Settings tab; also used by /operations/settings/pos.
 */
export default function PosSettingsPanel({ embedded = false, hideHeader = false }) {
  const { profile } = useAuth()
  const canWrite = canWritePosSettings(profile)
  const [settings, setSettings] = useState(() => normalizePosSettings())
  const [fields, setFields] = useState([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [savingFieldKey, setSavingFieldKey] = useState('')
  const [fieldsReady, setFieldsReady] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [posRes, fieldRes] = await Promise.all([
        supabase.from('ops_pos_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('shift_close_field_config').select('*').order('sort_order'),
      ])
      if (posRes.error && !/ops_pos_settings|relation|does not exist/i.test(posRes.error.message)) {
        toast.error(posRes.error.message)
      } else if (posRes.data) setSettings(normalizePosSettings(posRes.data))
      if (fieldRes.error) toast.error(fieldRes.error.message)
      else setFields(fieldRes.data || [])
      setFieldsReady(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function savePosSettings(e) {
    e.preventDefault()
    if (!canWrite) return
    const checkMethods = hasDuplicateValues(settings.payment_methods)
    if (checkMethods.invalid) return toast.error(checkMethods.message)
    const checkKinds = hasDuplicateValues(settings.expense_kinds)
    if (checkKinds.invalid) return toast.error(checkKinds.message)

    setSaving(true)
    const row = toPosSettingsRow(settings)
    const { error } = await supabase.from('ops_pos_settings').upsert(row, { onConflict: 'id' })
    setSaving(false)
    if (error) toast.error(error.message)
    else toast.success('POS settings saved')
  }

  async function saveField(row) {
    if (!canWrite) return
    setSavingFieldKey(row.field_key)
    try {
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
    } finally {
      setSavingFieldKey('')
    }
  }

  function updateMethod(i, patch) {
    setSettings((prev) => {
      const payment_methods = prev.payment_methods.map((m, idx) => (idx === i ? { ...m, ...patch } : m))
      return { ...prev, payment_methods }
    })
  }

  function addMethod() {
    setSettings((prev) => ({
      ...prev,
      payment_methods: [...prev.payment_methods, { value: `method_${prev.payment_methods.length + 1}`, label: '' }],
    }))
  }

  function removeMethod(i) {
    setSettings((prev) => {
      if (prev.payment_methods.length <= 1) return prev
      return { ...prev, payment_methods: prev.payment_methods.filter((_, idx) => idx !== i) }
    })
  }

  function updateKind(i, patch) {
    setSettings((prev) => {
      const expense_kinds = prev.expense_kinds.map((k, idx) => (idx === i ? { ...k, ...patch } : k))
      return { ...prev, expense_kinds }
    })
  }

  function addKind() {
    setSettings((prev) => ({
      ...prev,
      expense_kinds: [...prev.expense_kinds, { value: `kind_${prev.expense_kinds.length + 1}`, label: '' }],
    }))
  }

  function removeKind(i) {
    setSettings((prev) => {
      if (prev.expense_kinds.length <= 1) return prev
      return { ...prev, expense_kinds: prev.expense_kinds.filter((_, idx) => idx !== i) }
    })
  }

  function resetToDefaults() {
    setSettings(normalizePosSettings())
    toast.info('Reset lists to Hakum defaults. Click Save POS lists to apply.')
  }

  return (
    <div className="flex flex-col gap-6">
      {!embedded && !hideHeader ? (
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
      ) : null}
      {embedded ? (
        <Card className="border-border/80 bg-muted/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Counter options</CardTitle>
            <CardDescription>
              These lists only control checkout payment labels and the Expenses kinds on this POS. They do not customize
              payroll, P&amp;L, or catalog pricing. Crew late-pay weights live under{' '}
              <Link to="/operations/attendance?tab=settings" className="font-medium text-primary underline-offset-2 hover:underline">
                Attendance → Settings
              </Link>
              . Pay rules:{' '}
              <Link to="/operations/settings/daily-sheet" className="font-medium text-primary underline-offset-2 hover:underline">
                Daily sheet rules
              </Link>
              .
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Payment methods and expense kinds</CardTitle>
            <CardDescription>Shown on checkout and the Expenses tab after you save.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="min-h-10 cursor-pointer" disabled={loading} onClick={load}>
              <RefreshCw className={`mr-1.5 size-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </Button>
            {canWrite ? (
              <Button type="button" variant="outline" size="sm" className="min-h-10 cursor-pointer" onClick={resetToDefaults}>
                <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
                Reset defaults
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePosSettings} className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <Label>Payment methods</Label>
                {canWrite ? (
                  <Button type="button" variant="outline" size="sm" className="min-h-9 cursor-pointer text-xs" onClick={addMethod}>
                    <Plus className="mr-1 size-3.5" aria-hidden />
                    Add payment method
                  </Button>
                ) : null}
              </div>
              {settings.payment_methods.map((m, i) => (
                <div key={`method-${i}`} className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <Input
                    value={m.value}
                    disabled={!canWrite}
                    onChange={(e) => updateMethod(i, { value: e.target.value.trim().toLowerCase() })}
                    placeholder="slug (e.g. gcash)"
                    className="min-h-11 font-mono text-sm"
                  />
                  <Input
                    value={m.label}
                    disabled={!canWrite}
                    onChange={(e) => updateMethod(i, { label: e.target.value })}
                    placeholder="Display label"
                    className="min-h-11"
                  />
                  {canWrite ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove payment method"
                      disabled={settings.payment_methods.length <= 1}
                      className="min-h-11 min-w-11 cursor-pointer text-muted-foreground hover:text-destructive"
                      onClick={() => removeMethod(i)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <Label>Expense kinds</Label>
                {canWrite ? (
                  <Button type="button" variant="outline" size="sm" className="min-h-9 cursor-pointer text-xs" onClick={addKind}>
                    <Plus className="mr-1 size-3.5" aria-hidden />
                    Add expense kind
                  </Button>
                ) : null}
              </div>
              {settings.expense_kinds.map((k, i) => (
                <div key={`kind-${i}`} className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <Input
                    value={k.value}
                    disabled={!canWrite}
                    onChange={(e) => updateKind(i, { value: e.target.value.trim().toLowerCase() })}
                    placeholder="slug (e.g. supplies)"
                    className="min-h-11 font-mono text-sm"
                  />
                  <Input
                    value={k.label}
                    disabled={!canWrite}
                    onChange={(e) => updateKind(i, { label: e.target.value })}
                    placeholder="Display label"
                    className="min-h-11"
                  />
                  {canWrite ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove expense kind"
                      disabled={settings.expense_kinds.length <= 1}
                      className="min-h-11 min-w-11 cursor-pointer text-muted-foreground hover:text-destructive"
                      onClick={() => removeKind(i)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            {canWrite ? (
              <Button type="submit" className="min-h-11 w-fit cursor-pointer" disabled={saving}>
                {saving ? 'Saving…' : 'Save POS lists'}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Only Super Admin (or ASA with Finance write) can edit lists.</p>
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
          {!fieldsReady ? (
            <p className="text-sm text-muted-foreground">Loading end-of-shift fields…</p>
          ) : !fields.length ? (
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
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11 w-fit cursor-pointer"
                    disabled={savingFieldKey === row.field_key}
                    onClick={() => saveField(row)}
                  >
                    {savingFieldKey === row.field_key ? 'Saving…' : 'Save field'}
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
