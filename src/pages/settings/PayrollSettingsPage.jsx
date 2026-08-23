import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessPayroll, isAdmin } from '@/auth/permissions'
import { Navigate } from 'react-router-dom'
import {
  DEFAULT_COMPENSATION_RULES,
  normalizeCompensationSettings,
  toCompensationSettingsRow,
} from '@/lib/compensation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

/** Settings → Payroll: attendance weights, pending policy, CA netting (same compensation_settings row). */
export default function PayrollSettingsPage() {
  const { profile } = useAuth()
  const canWrite = isAdmin(profile)
  const [rules, setRules] = useState(DEFAULT_COMPENSATION_RULES)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('compensation_settings').select('*').eq('id', 1).maybeSingle()
    if (error) toast.error(error.message)
    else setRules(normalizeCompensationSettings(data))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!canAccessPayroll(profile)) return <Navigate to="/operations/access-denied" replace />

  async function save(e) {
    e.preventDefault()
    if (!canWrite) return
    setSaving(true)
    const row = toCompensationSettingsRow(rules)
    const { error } = await supabase.from('compensation_settings').upsert(row, { onConflict: 'id' })
    setSaving(false)
    if (error) toast.error(error.message)
    else toast.success('Payroll settings saved')
  }

  return (
    <section className="flex flex-col gap-6 pb-8">
      <header className="border-b border-border pb-4">
        <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Settings</p>
        <h1 className="text-2xl font-semibold tracking-tight">Payroll settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Attendance weights, pending-floor policy, and cash-advance netting. Pool % and ceramic splits stay on Payroll →
          Rules.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="min-h-11" asChild>
            <Link to="/operations/settings">← Company settings</Link>
          </Button>
          <Button type="button" variant="secondary" className="min-h-11" asChild>
            <Link to="/operations/payroll?tab=rules">Open pool / ceramic rules</Link>
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Policy</CardTitle>
          <CardDescription>
            These columns live on compensation_settings — the same singleton floor pay and POS ceramic drafts read.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="present-w">Present attendance weight</Label>
              <Input
                id="present-w"
                type="number"
                step="0.1"
                min="0"
                value={rules.attendance_present_weight}
                disabled={!canWrite}
                onChange={(e) =>
                  setRules((r) => ({ ...r, attendance_present_weight: Number(e.target.value) }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="late-w">Late attendance weight</Label>
              <Input
                id="late-w"
                type="number"
                step="0.1"
                min="0"
                value={rules.attendance_late_weight}
                disabled={!canWrite}
                onChange={(e) =>
                  setRules((r) => ({ ...r, attendance_late_weight: Number(e.target.value) }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={rules.pending_floor_optional !== false}
                disabled={!canWrite}
                onChange={(e) => setRules((r) => ({ ...r, pending_floor_optional: e.target.checked }))}
              />
              Pending floor is optional (off = hard block: cannot confirm floor until closes are accepted)
            </label>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Cash advances: deduct only with manual add/deduct on the payroll wizard. Auto-deduct is disabled by contract.
            </p>
            {canWrite ? (
              <Button type="submit" className="min-h-11 sm:col-span-2" disabled={saving}>
                {saving ? 'Saving…' : 'Save payroll settings'}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground sm:col-span-2">Only Super Admin can edit.</p>
            )}
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
