/** Payroll register: SA/ASA wizard from POS proof → payout lines → confirm. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Banknote, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import {
  canAccessPayroll,
  canRunPayroll,
  getBranchScopeList,
} from '@/auth/permissions'
import { listBranches } from '@/lib/adminApi'
import {
  DEFAULT_COMPENSATION_RULES,
  PAYOUT_FREQUENCIES,
  normalizeCompensationSettings,
  toCompensationSettingsRow,
} from '@/lib/compensation'
import { collectPaged } from '@/lib/crmInsights'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import {
  PAYROLL_WIZARD_STEPS,
  addPayrollAdjustment,
  adjustPayrollLine,
  buildPayrollPreview,
  buildRunPayrollPayload,
  netPayrollLinesMinor,
  payrollBlocksConfirm,
  payrollPeriodRange,
  rebuildWashPoolLines,
  validatePayrollAdjustment,
  validatePayrollCustomRange,
} from '@/lib/payroll'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NamedSelect } from '@/components/ui/named-select'
import { toast } from 'sonner'

const FREQ_LABELS = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  custom: 'Custom range',
}

const SETTINGS_FREQUENCIES = PAYOUT_FREQUENCIES.filter((f) => f !== 'custom')

const WEEKDAYS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
]

function periodIso(start, end) {
  return { startIso: `${start}T00:00:00+08:00`, endIso: `${end}T23:59:59.999+08:00` }
}

export default function PayrollPage() {
  const { profile } = useAuth()
  const canRun = canRunPayroll(profile)
  const scope = getBranchScopeList(profile)

  const [tab, setTab] = useState('run')
  const [step, setStep] = useState(0)
  const [branches, setBranches] = useState([])
  const [rules, setRules] = useState({ ...DEFAULT_COMPENSATION_RULES })
  const [branch, setBranch] = useState('')
  const [frequency, setFrequency] = useState('weekly')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [runs, setRuns] = useState([])
  const [notes, setNotes] = useState('')
  const [packages, setPackages] = useState([])
  const [staffRoster, setStaffRoster] = useState([])
  const [adjForm, setAdjForm] = useState({ staffId: '', direction: 'add', label: '', amountPesos: '' })
  const [pkgForm, setPkgForm] = useState({ staff_id: '', package_kind: 'fixed', amountPesos: '', notes: '', branch: '' })

  const branchOptions = useMemo(() => {
    const rows = scope === null ? branches : branches.filter((b) => scope.includes(b.slug))
    return rows.map((b) => ({ value: b.slug, label: b.name || b.slug }))
  }, [branches, scope])

  const applyPeriod = useCallback((freq, anchor, custom = null) => {
    if (freq === 'custom') {
      const range = payrollPeriodRange('custom', anchor, custom || { start: periodStart, end: periodEnd })
      setPeriodStart(range.start)
      setPeriodEnd(range.end)
      return
    }
    const range = payrollPeriodRange(freq, anchor)
    setPeriodStart(range.start)
    setPeriodEnd(range.end)
  }, [periodStart, periodEnd])

  const loadSettings = useCallback(async () => {
    const [branchRows, settingsRes] = await Promise.all([
      listBranches(),
      supabase
        .from('compensation_settings')
        .select(
          'wash_pool_pct, ceramic_shirt_deduction_minor, ceramic_card_fee_pct, ceramic_crew_solo_pct, ceramic_crew_split_pct, ceramic_detailer_split_pct, payout_frequency, payout_weekday',
        )
        .eq('id', 1)
        .maybeSingle(),
    ])
    const list = branchRows || []
    setBranches(list)
    const n = normalizeCompensationSettings(settingsRes.data)
    setRules(n)
    setFrequency(n.payout_frequency)
    const nextBranch = scope === null ? list[0]?.slug : (scope[0] || list[0]?.slug || '')
    setBranch((cur) => cur || nextBranch || '')
    applyPeriod(n.payout_frequency, getLocalCalendarDate())
  }, [applyPeriod, scope])

  const loadRuns = useCallback(async () => {
    let q = supabase
      .from('payroll_runs')
      .select('id, branch, frequency, period_start, period_end, status, wash_pool_pct, pos_sales_minor, total_payout_minor, confirmed_at, payroll_run_lines(id, staff_id, amount_minor, kind, branch, source_key, source_sale_id)')
      .order('period_start', { ascending: false })
      .limit(40)
    if (branch) q = q.eq('branch', branch)
    const { data, error } = await q
    if (error) toast.error(error.message)
    else setRuns(data || [])
  }, [branch])

  useEffect(() => {
    loadSettings().catch((err) => toast.error(err.message))
    loadRuns().catch((err) => toast.error(err.message))
    Promise.all([
      supabase
        .from('staff_pay_packages')
        .select('id, staff_id, package_kind, amount_minor, effective_from, notes, is_active, branch, staff_profiles(full_name)')
        .eq('is_active', true)
        .order('effective_from', { ascending: false }),
      supabase.from('staff_profiles').select('id, full_name, role, branch_slug').eq('is_active', true).order('full_name'),
    ]).then(([pkg, staff]) => {
      if (!pkg.error) setPackages(pkg.data || [])
      if (!staff.error) setStaffRoster(staff.data || [])
    })
  }, [loadSettings, loadRuns])

  useEffect(() => {
    setPkgForm((f) => ({ ...f, branch: f.branch || branch || '' }))
  }, [branch])

  async function loadProof() {
    if (!periodStart || !periodEnd) return
    if (frequency === 'custom') {
      const check = validatePayrollCustomRange(periodStart, periodEnd)
      if (!check.ok) {
        toast.error(check.reason)
        return
      }
    }
    setLoading(true)
    try {
      const { startIso, endIso } = periodIso(periodStart, periodEnd)
      const [salesRows, attRows, expRows, claimedRows, pkgRows, staffRows] = await Promise.all([
        collectPaged(async (from, to) => {
          let q = supabase
            .from('sales')
            .select('id, branch, status, total_minor, occurred_at, sale_line_items(line_total_minor, services(pay_category))')
            .eq('status', 'paid')
            .gte('occurred_at', startIso)
            .lte('occurred_at', endIso)
            .order('occurred_at', { ascending: false })
          if (branch) q = q.eq('branch', branch)
          const { data, error } = await q.range(from, to)
          if (error) throw error
          return data || []
        }, 1000),
        collectPaged(async (from, to) => {
          let q = supabase
            .from('staff_attendance')
            .select('staff_id, branch_slug, attendance_date, status, staff_profiles(id, full_name, role)')
            .gte('attendance_date', periodStart)
            .lte('attendance_date', periodEnd)
          if (branch) q = q.eq('branch_slug', branch)
          const { data, error } = await q.range(from, to)
          if (error) throw error
          return data || []
        }, 1000),
        collectPaged(async (from, to) => {
          let q = supabase
            .from('expenses')
            .select('description, total_minor, branch, expense_kind')
            .like('description', 'ceramic:%')
            .gte('created_at', startIso)
            .lte('created_at', endIso)
          if (branch) q = q.eq('branch', branch)
          const { data, error } = await q.range(from, to)
          if (error) throw error
          return data || []
        }, 1000),
        collectPaged(async (from, to) => {
          const { data, error } = await supabase.from('payroll_run_sales').select('sale_id').range(from, to)
          if (error) throw error
          return data || []
        }, 1000),
        supabase
          .from('staff_pay_packages')
          .select('id, staff_id, package_kind, amount_minor, effective_from, notes, is_active, branch, staff_profiles(id, full_name, branch_slug, role)')
          .eq('is_active', true)
          .eq('branch', branch)
          .lte('effective_from', periodEnd),
        supabase
          .from('staff_profiles')
          .select('id, full_name, role, branch_slug')
          .eq('is_active', true)
          .order('full_name'),
      ])
      if (pkgRows.error) throw pkgRows.error
      if (staffRows.error) throw staffRows.error
      setPackages(pkgRows.data || [])
      setStaffRoster(staffRows.data || [])

      const attendance = (attRows || []).map((row) => ({
        id: row.staff_id,
        staff_id: row.staff_id,
        full_name: row.staff_profiles?.full_name || '',
        role: row.staff_profiles?.role || '',
        branch_slug: row.branch_slug,
        attendance_date: row.attendance_date,
        status: row.status,
      }))
      const packageInput = (pkgRows.data || []).map((p) => ({
        ...p,
        staff: p.staff_profiles,
        staff_name: p.staff_profiles?.full_name,
        branch: p.branch,
      }))
      const next = buildPayrollPreview({
        period: { start: periodStart, end: periodEnd },
        rules,
        sales: salesRows,
        attendance,
        ceramicExpenses: expRows,
        claimedSaleIds: (claimedRows || []).map((r) => r.sale_id),
        packages: packageInput,
      })
      setPreview(next)
      setStep(1)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function saveRules(e) {
    e.preventDefault()
    if (!canRun) return
    setSaving(true)
    const { error } = await supabase
      .from('compensation_settings')
      .upsert({ ...toCompensationSettingsRow(rules), updated_at: new Date().toISOString() })
    setSaving(false)
    if (error) toast.error(error.message)
    else toast.success('Payout rules saved')
  }

  async function confirmRun() {
    const gate = payrollBlocksConfirm(preview)
    if (gate.blocked) {
      toast.error(gate.reason)
      return
    }
    setSaving(true)
    const payload = buildRunPayrollPayload({
      preview,
      branch,
      frequency,
      notes,
    })
    const { data, error } = await supabase.rpc('run_payroll', { payload })
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(`Payroll posted · ${formatMoney(data?.total_payout_minor || preview.total_payout_minor)}`)
    setPreview(null)
    setStep(0)
    setNotes('')
    applyPeriod(frequency, getLocalCalendarDate())
    loadRuns()
  }

  if (!canAccessPayroll(profile)) {
    return <Navigate to="/operations/access-denied" replace />
  }

  const gate = payrollBlocksConfirm(preview)
  const stepId = PAYROLL_WIZARD_STEPS[step]?.id

  return (
    <section className="hakum-payroll flex flex-col gap-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="border-b border-border pb-4">
        <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Books</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <Banknote className="size-6 shrink-0 text-primary" aria-hidden />
          Payroll
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Pay crew from paid POS sales. Each run keeps the ticket ids as proof, then posts salary lines to Finance.
        </p>
      </header>

      <div role="tablist" aria-label="Payroll sections" className="planner-v2-tabs">
        {[
          { id: 'run', label: 'Run payroll' },
          { id: 'packages', label: 'Packages' },
          { id: 'history', label: 'Payouts' },
          { id: 'rules', label: 'Rules' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'is-on' : ''}
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'run' && (
        <div className="flex flex-col gap-4">
          <ol className="hakum-payroll-steps">
            {PAYROLL_WIZARD_STEPS.map((item, idx) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={idx === step ? 'is-on' : ''}
                  onClick={() => setStep(idx)}
                >
                  <span>{idx + 1}</span>
                  {item.label}
                </button>
              </li>
            ))}
          </ol>

          {stepId === 'period' && (
            <Card>
              <CardHeader>
                <CardTitle>Choose the pay period</CardTitle>
                <CardDescription>
                  Frequency follows company rules. Dates can be overridden for a one-off run.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="payroll-branch">Branch</Label>
                  <NamedSelect
                    id="payroll-branch"
                    value={branch}
                    onChange={setBranch}
                    options={branchOptions}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="payroll-freq">Payout frequency</Label>
                  <NamedSelect
                    id="payroll-freq"
                    value={frequency}
                    onChange={(value) => {
                      setFrequency(value)
                      if (value !== 'custom') applyPeriod(value, periodStart || getLocalCalendarDate())
                    }}
                    options={PAYOUT_FREQUENCIES.map((f) => ({ value: f, label: FREQ_LABELS[f] }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="payroll-start">Start</Label>
                  <Input id="payroll-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="payroll-end">End</Label>
                  <Input id="payroll-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
                <p className="sm:col-span-2 text-xs text-muted-foreground">
                  POS proof → packages → labeled add/deduct → Finance post on confirm.
                </p>
                <div className="sm:col-span-2">
                  <Button className="min-h-11 w-full sm:w-auto" disabled={loading || !branch} onClick={loadProof}>
                    {loading ? 'Loading POS…' : 'Load POS proof'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {stepId === 'proof' && (
            <Card>
              <CardHeader>
                <CardTitle>POS proof</CardTitle>
                <CardDescription>
                  Paid sales in this window, minus tickets already on another payroll run. Detailing jobs fund ceramic shares, not the wash pool.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!preview ? (
                  <p className="text-sm text-muted-foreground">Load the period first.</p>
                ) : (
                  <>
                    <p className="text-sm">
                      Wash sales {formatMoney(preview.pos_sales_minor)} · wash pool {formatMoney(preview.pool_minor)} · {preview.proof.length} tickets
                    </p>
                    <div className="hakum-payroll-table">
                      {(preview.proof || []).map((row) => (
                        <article key={row.sale_id} className="hakum-payroll-row">
                          <p className="font-medium">{row.sale_id.slice(0, 8)}</p>
                          <p>{row.branch} · {row.day}</p>
                          <p>{formatMoney(row.total_minor)}</p>
                        </article>
                      ))}
                      {!preview.proof.length ? (
                        <p className="text-sm text-muted-foreground">No unpaid POS wash tickets in this window.</p>
                      ) : null}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {stepId === 'lines' && (
            <Card>
              <CardHeader>
                <CardTitle>Payout lines</CardTitle>
                <CardDescription>Change wash commission % for this run, then edit a line if the floor split is wrong.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex max-w-xs flex-col gap-1.5">
                  <Label htmlFor="payroll-pct">Wash pool %</Label>
                  <Input
                    id="payroll-pct"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    disabled={!canRun || !preview}
                    value={preview?.rules?.wash_pool_pct ?? rules.wash_pool_pct}
                    onChange={(e) => {
                      if (!preview) return
                      setPreview(rebuildWashPoolLines(preview, Number(e.target.value)))
                    }}
                  />
                </div>
                <div className="hakum-payroll-table">
                  {(preview?.lines || []).map((row) => (
                    <article key={row.key} className="hakum-payroll-row">
                      <p className="font-medium">{row.staff_name || 'Unassigned'}</p>
                      <p className="text-muted-foreground">
                        {row.direction === 'deduct' ? 'Deduct' : row.kind.replaceAll('_', ' ')}
                        {row.label ? ` · ${row.label}` : ''} · {row.branch}
                      </p>
                      {row.missing_assignee ? <Badge variant="outline">Needs assignee</Badge> : null}
                      <Input
                        type="number"
                        min="0"
                        step="100"
                        className="min-h-11"
                        disabled={!canRun || row.kind?.startsWith('adjustment')}
                        value={row.pay_minor}
                        onChange={(e) =>
                          setPreview((prev) => {
                            const lines = adjustPayrollLine(prev.lines, row.key, e.target.value)
                            return {
                              ...prev,
                              lines,
                              total_payout_minor: netPayrollLinesMinor(lines),
                            }
                          })
                        }
                        aria-label={`Amount for ${row.staff_name || 'unassigned'}`}
                      />
                    </article>
                  ))}
                  {!preview?.lines?.length ? (
                    <p className="text-sm text-muted-foreground">No payout lines. Check attendance, packages, and POS proof.</p>
                  ) : null}
                </div>
                {canRun && preview ? (
                  <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2">
                    <p className="sm:col-span-2 text-sm font-medium">Add / deduct</p>
                    <NamedSelect
                      value={adjForm.staffId}
                      onChange={(staffId) => setAdjForm((f) => ({ ...f, staffId }))}
                      options={(staffRoster.length ? staffRoster : []).map((s) => ({
                        value: s.id,
                        label: s.full_name || s.id,
                      }))}
                      placeholder="Employee"
                    />
                    <NamedSelect
                      value={adjForm.direction}
                      onChange={(direction) => setAdjForm((f) => ({ ...f, direction }))}
                      options={[
                        { value: 'add', label: 'Add' },
                        { value: 'deduct', label: 'Deduct' },
                      ]}
                    />
                    <Input
                      placeholder="Label (required)"
                      value={adjForm.label}
                      onChange={(e) => setAdjForm((f) => ({ ...f, label: e.target.value }))}
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount (pesos)"
                      value={adjForm.amountPesos}
                      onChange={(e) => setAdjForm((f) => ({ ...f, amountPesos: e.target.value }))}
                    />
                    <Button
                      type="button"
                      className="sm:col-span-2 min-h-11"
                      onClick={() => {
                        const staff = staffRoster.find((s) => s.id === adjForm.staffId)
                        const amountMinor = Math.round(Number(adjForm.amountPesos) * 100)
                        const check = validatePayrollAdjustment({
                          direction: adjForm.direction,
                          label: adjForm.label,
                          amountMinor,
                        })
                        if (!check.ok || !staff) {
                          toast.error(check.errors?.label || check.errors?.amount || 'Pick an employee and fill add/deduct')
                          return
                        }
                        setPreview((prev) => {
                          const lines = addPayrollAdjustment(prev.lines, {
                            staff,
                            branch: branch || staff.branch_slug,
                            direction: adjForm.direction,
                            label: adjForm.label,
                            amountMinor,
                          })
                          return { ...prev, lines, total_payout_minor: netPayrollLinesMinor(lines) }
                        })
                        setAdjForm({ staffId: '', direction: 'add', label: '', amountPesos: '' })
                      }}
                    >
                      Add line
                    </Button>
                    <p className="sm:col-span-2 text-sm">
                      Net payout {formatMoney(preview?.total_payout_minor || 0)}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {stepId === 'confirm' && (
            <Card>
              <CardHeader>
                <CardTitle>Confirm payout</CardTitle>
                <CardDescription>
                  Posts this run, locks the POS tickets, and writes salary expenses. This cannot be quietly undone.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">
                  {periodStart} to {periodEnd} · {FREQ_LABELS[frequency]} · total {formatMoney(preview?.total_payout_minor || 0)}
                </p>
                {gate.blocked ? <p className="text-sm text-destructive">{gate.reason}</p> : null}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="payroll-notes">Notes</Label>
                  <Input id="payroll-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
                </div>
                <Button
                  className="min-h-11 w-full sm:w-auto"
                  disabled={!canRun || saving || gate.blocked || !preview}
                  onClick={confirmRun}
                >
                  {saving ? 'Posting…' : canRun ? 'Confirm payroll' : 'View only'}
                </Button>
                {!canRun ? (
                  <p className="text-sm text-muted-foreground">ASA finance write is required to post.</p>
                ) : null}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <ChevronLeft data-icon="inline-start" />
              Back
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={step >= PAYROLL_WIZARD_STEPS.length - 1 || (step === 0 && !preview)}
              onClick={() => setStep((s) => Math.min(PAYROLL_WIZARD_STEPS.length - 1, s + 1))}
            >
              Next
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      )}

      {tab === 'packages' && (
        <Card>
          <CardHeader>
            <CardTitle>Staff pay packages</CardTitle>
            <CardDescription>
              Fixed / custom / hybrid packages for non-pool roles. Included when you load POS proof for a period.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canRun ? (
              <form
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const amount_minor = Math.round(Number(pkgForm.amountPesos) * 100)
                  const pkgBranch = pkgForm.branch || branch
                  if (!pkgForm.staff_id || !(amount_minor > 0) || !pkgBranch) {
                    toast.error('Employee, branch, and amount required')
                    return
                  }
                  const { error } = await supabase.from('staff_pay_packages').insert({
                    staff_id: pkgForm.staff_id,
                    package_kind: pkgForm.package_kind,
                    amount_minor,
                    branch: pkgBranch,
                    notes: pkgForm.notes.trim() || null,
                  })
                  if (error) toast.error(error.message)
                  else {
                    toast.success('Package saved')
                    setPkgForm({ staff_id: '', package_kind: 'fixed', amountPesos: '', notes: '', branch: branch || '' })
                    const { data } = await supabase
                      .from('staff_pay_packages')
                      .select('id, staff_id, package_kind, amount_minor, effective_from, notes, is_active, branch, staff_profiles(full_name)')
                      .eq('is_active', true)
                      .order('effective_from', { ascending: false })
                    setPackages(data || [])
                  }
                }}
              >
                <NamedSelect
                  value={pkgForm.staff_id}
                  onChange={(staff_id) => setPkgForm((f) => ({ ...f, staff_id }))}
                  options={staffRoster.map((s) => ({ value: s.id, label: s.full_name }))}
                  placeholder="Employee"
                />
                <NamedSelect
                  value={pkgForm.branch || branch}
                  onChange={(next) => setPkgForm((f) => ({ ...f, branch: next }))}
                  options={branchOptions}
                  placeholder="Branch"
                />
                <NamedSelect
                  value={pkgForm.package_kind}
                  onChange={(package_kind) => setPkgForm((f) => ({ ...f, package_kind }))}
                  options={[
                    { value: 'fixed', label: 'Fixed' },
                    { value: 'custom', label: 'Custom' },
                    { value: 'hybrid', label: 'Hybrid' },
                  ]}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount (pesos)"
                  value={pkgForm.amountPesos}
                  onChange={(e) => setPkgForm((f) => ({ ...f, amountPesos: e.target.value }))}
                />
                <Input
                  placeholder="Notes"
                  value={pkgForm.notes}
                  onChange={(e) => setPkgForm((f) => ({ ...f, notes: e.target.value }))}
                />
                <Button type="submit" className="min-h-11 sm:col-span-2">
                  Save package
                </Button>
              </form>
            ) : null}
            <div className="hakum-payroll-table">
              {packages.map((p) => (
                <article key={p.id} className="hakum-payroll-row">
                  <p className="font-medium">{p.staff_profiles?.full_name || p.staff_id}</p>
                  <p className="text-muted-foreground">
                    {p.package_kind} · {p.branch} · from {p.effective_from}
                  </p>
                  <p>{formatMoney(p.amount_minor)}</p>
                </article>
              ))}
              {!packages.length ? (
                <p className="text-sm text-muted-foreground">No active packages yet.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'history' && (
        <div className="hakum-payroll-table">
          {runs.map((run) => (
            <article key={run.id} className="hakum-payroll-row">
              <p className="font-medium">
                {run.period_start} to {run.period_end}
              </p>
              <p className="text-muted-foreground">
                {FREQ_LABELS[run.frequency] || run.frequency} · {run.branch || 'multi'} · {run.status}
              </p>
              <p>{formatMoney(run.total_payout_minor)} from {formatMoney(run.pos_sales_minor)} POS</p>
              <p className="text-xs text-muted-foreground">{(run.payroll_run_lines || []).length} employee lines</p>
            </article>
          ))}
          {!runs.length ? <p className="text-sm text-muted-foreground">No payroll runs yet.</p> : null}
        </div>
      )}

      {tab === 'rules' && (
        <Card>
          <CardHeader>
            <CardTitle>Payout rules</CardTitle>
            <CardDescription>
              Company defaults for wash pool, ceramic splits, and how often payroll runs. Same singleton POS uses at checkout.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveRules} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rule-freq">Default frequency</Label>
                <NamedSelect
                  id="rule-freq"
                  value={rules.payout_frequency}
                  disabled={!canRun}
                  onChange={(value) => setRules((prev) => ({ ...prev, payout_frequency: value }))}
                  options={SETTINGS_FREQUENCIES.map((f) => ({ value: f, label: FREQ_LABELS[f] }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rule-day">Typical payday</Label>
                <NamedSelect
                  id="rule-day"
                  value={String(rules.payout_weekday)}
                  disabled={!canRun}
                  onChange={(value) => setRules((prev) => ({ ...prev, payout_weekday: Number(value) }))}
                  options={WEEKDAYS}
                />
              </div>
              {[
                { key: 'wash_pool_pct', label: 'Wash pool %', step: '1' },
                { key: 'ceramic_card_fee_pct', label: 'Card fee %', step: '0.1' },
                { key: 'ceramic_crew_solo_pct', label: 'Crew solo %', step: '1' },
                { key: 'ceramic_crew_split_pct', label: 'Crew split %', step: '1' },
                { key: 'ceramic_detailer_split_pct', label: 'Detailer split %', step: '1' },
                { key: 'ceramic_shirt_deduction_minor', label: 'Shirt deduction (centavos)', step: '100' },
              ].map((f) => (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={`rule-${f.key}`}>{f.label}</Label>
                  <Input
                    id={`rule-${f.key}`}
                    type="number"
                    step={f.step}
                    min="0"
                    disabled={!canRun}
                    value={rules[f.key] ?? ''}
                    onChange={(e) => setRules((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                  />
                </div>
              ))}
              <div className="sm:col-span-2 lg:col-span-3">
                <Button type="submit" className="min-h-11" disabled={saving || !canRun}>
                  {saving ? 'Saving…' : 'Save rules'}
                </Button>
                <p className="mt-2 text-sm text-muted-foreground">
                  <Link className="text-primary underline-offset-4 hover:underline" to="/operations/settings">
                    Also on Settings
                  </Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
