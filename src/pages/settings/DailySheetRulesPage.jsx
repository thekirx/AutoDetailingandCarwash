import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canEditFinanceBooks } from '@/auth/permissions'
import { canReviewDailySheet } from '@/lib/dailySheet'
import { sheetErrorMessage } from '@/lib/dailySheetApi'
import { DEFAULT_COMPENSATION_RULES, normalizeCompensationSettings, toCompensationSettingsRow } from '@/lib/compensation'
import { parsePesosToMinor } from '@/lib/shiftClose'
import { supabase } from '@/lib/supabase'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const PCT_FIELDS = [
  { key: 'wash_pool_pct', label: 'Wash pool %', hint: 'Share of paid services and packages split across bay crew. Detailing and merch stay out.' },
  { key: 'ceramic_crew_split_pct', label: 'Detailing crew split %' },
  { key: 'ceramic_crew_solo_pct', label: 'Detailing crew solo %' },
  { key: 'ceramic_detailer_split_pct', label: 'Detailer split %' },
]
const WEIGHT_FIELDS = [
  { key: 'attendance_present_weight', label: 'Present attendance weight' },
  { key: 'attendance_late_weight', label: 'Late attendance weight' },
]

/** Settings → Daily sheet rules: how the sheet suggests crew salaries (compensation_settings) + Team Lead daily rates. */
export default function DailySheetRulesPage() {
  const { profile } = useAuth()
  const canWrite = canEditFinanceBooks(profile)
  const [rules, setRules] = useState(DEFAULT_COMPENSATION_RULES)
  const [saving, setSaving] = useState(false)
  const [leads, setLeads] = useState([])
  const [rates, setRates] = useState({})
  const [leadError, setLeadError] = useState('')

  const load = useCallback(async () => {
    const [comp, tl] = await Promise.all([
      supabase.from('compensation_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('staff_profiles').select('id, full_name, branch_slug, daily_rate_minor').eq('role', 'team_lead').eq('is_active', true).order('full_name'),
    ])
    if (comp.error) toast.error(comp.error.message)
    else setRules(normalizeCompensationSettings(comp.data))
    if (tl.error) {
      setLeadError(sheetErrorMessage(tl.error))
    } else {
      setLeadError('')
      setLeads(tl.data || [])
      setRates(Object.fromEntries((tl.data || []).map((r) => [r.id, r.daily_rate_minor ? String(r.daily_rate_minor / 100) : ''])))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!canReviewDailySheet(profile)) return <Navigate to="/operations/access-denied" replace />

  async function saveRules(e) {
    e.preventDefault()
    if (!canWrite) return
    setSaving(true)
    const { error } = await supabase.from('compensation_settings').upsert(toCompensationSettingsRow(rules), { onConflict: 'id' })
    setSaving(false)
    if (error) toast.error(error.message)
    else toast.success('Daily sheet rules saved')
  }

  async function saveRate(lead) {
    const text = String(rates[lead.id] ?? '').trim()
    const minor = text === '' ? 0 : parsePesosToMinor(text)
    if (minor == null || !Number.isFinite(minor) || minor < 0) return toast.error(`Enter a peso amount for ${lead.full_name}, like 650.`)
    const { error } = await supabase.from('staff_profiles').update({ daily_rate_minor: minor }).eq('id', lead.id)
    if (error) return toast.error(error.message)
    toast.success(`${lead.full_name}: daily rate saved`)
    load()
  }

  const numberInput = (field, props) => (
    <Input
      id={`rule-${field.key}`}
      type="number"
      className="min-h-11"
      value={rules[field.key]}
      disabled={!canWrite}
      onChange={(e) => setRules((r) => ({ ...r, [field.key]: Number(e.target.value) }))}
      {...props}
    />
  )

  return (
    <OpsPageShell
      className="hakum-daily-sheet-rules"
      eyebrow="Settings"
      title="Daily sheet rules"
      description="How the Daily Sheet suggests crew salaries. Branch Admins can change a suggestion with a reason; Super Admin or ASA approve the sheet."
      actions={
        <Button type="button" variant="outline" className="min-h-11" asChild>
          <Link to="/operations/settings">← Company settings</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Salary suggestions</CardTitle>
          <CardDescription>Used for every branch. Branch Admins cannot change these.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveRules} className="grid gap-4 sm:grid-cols-2">
            {PCT_FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <Label htmlFor={`rule-${f.key}`}>{f.label}</Label>
                {numberInput(f, { min: 0, max: 100, step: 1 })}
                {f.hint ? <p className="text-xs text-muted-foreground">{f.hint}</p> : null}
              </div>
            ))}
            {WEIGHT_FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <Label htmlFor={`rule-${f.key}`}>{f.label}</Label>
                {numberInput(f, { min: 0, step: 0.1 })}
              </div>
            ))}
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Cash advances are released by the Branch Admin on the Daily Sheet and approved with it. Nothing is deducted automatically.
            </p>
            {canWrite ? (
              <Button type="submit" className="min-h-11 sm:col-span-2" disabled={saving}>
                {saving ? 'Saving…' : 'Save rules'}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground sm:col-span-2">Super Admin or ASA with finance write can edit.</p>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Lead daily rates</CardTitle>
          <CardDescription>Prefills the Team Lead salary on the Daily Sheet when they are checked in.</CardDescription>
        </CardHeader>
        <CardContent>
          {leadError ? (
            <p className="text-sm text-muted-foreground">{leadError}</p>
          ) : leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active Team Leads.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {leads.map((lead) => (
                <li key={lead.id} className="flex flex-wrap items-end gap-3 py-3">
                  <div className="min-w-40 flex-1">
                    <p className="font-medium">{lead.full_name}</p>
                    <p className="text-xs text-muted-foreground">{lead.branch_slug || 'No branch'}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`rate-${lead.id}`}>Daily rate (₱)</Label>
                    <Input
                      id={`rate-${lead.id}`}
                      inputMode="decimal"
                      className="min-h-11 w-32 text-right tabular-nums"
                      value={rates[lead.id] ?? ''}
                      disabled={!canWrite}
                      onChange={(e) => setRates((r) => ({ ...r, [lead.id]: e.target.value }))}
                    />
                  </div>
                  {canWrite ? (
                    <Button type="button" variant="outline" className="min-h-11" onClick={() => saveRate(lead)}>
                      Save
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </OpsPageShell>
  )
}
