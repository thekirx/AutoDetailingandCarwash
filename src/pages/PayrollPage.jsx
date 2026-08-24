/** Payroll register: SA/ASA wizard from POS proof → payout lines → confirm. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Banknote, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import {
  canAccessPayroll,
  canApproveCashAdvance,
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
  PAYROLL_RUN_KINDS,
  FIXED_SALARY_BOOKS_BRANCH,
  addPayrollAdjustment,
  addPayrollCommission,
  adjustPayrollLine,
  buildPayrollPreview,
  buildRunPayrollPayload,
  groupPayrollLinesByStaff,
  netPayrollLinesMinor,
  payrollBlocksConfirm,
  payrollPeriodRange,
  payrollWizardSteps,
  prorateMonthlyPackageMinor,
  rebuildWashPoolLines,
  removeStaffFromPayrollPreview,
  resolveFixedSalaryBranch,
  buildPendingFloorPayrollQueue,
  floorConfirmBlockedByPendingCloses,
  posProofTotalsByBranchDay,
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
import PayrollCashAdvancesPanel from '@/components/PayrollCashAdvancesPanel'

const FREQ_LABELS = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  semimonthly: '15th & month-end',
  monthly: 'Monthly',
  custom: 'Custom range (override anytime)',
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
  const canApproveCa = canApproveCashAdvance(profile)
  const scope = getBranchScopeList(profile)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const initialTab = ['home', 'run', 'cash-advance', 'packages', 'history', 'rules'].includes(tabParam)
    ? tabParam
    : 'home'

  const [tab, setTab] = useState(initialTab)
  const [step, setStep] = useState(0)
  const [runKind, setRunKind] = useState('floor')
  const [pendingCloses, setPendingCloses] = useState([])
  const [posProofByKey, setPosProofByKey] = useState(null)
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
  const [commissionForm, setCommissionForm] = useState({ staffId: '', label: 'Commission', amountPesos: '' })
  const [pkgForm, setPkgForm] = useState({ staff_id: '', package_kind: 'fixed', amountPesos: '', notes: '', branch: '' })

  const wizardSteps = useMemo(() => payrollWizardSteps(runKind), [runKind])
  const stepId = wizardSteps[step]?.id
  const staffGroups = useMemo(
    () => (preview?.lines ? groupPayrollLinesByStaff(preview.lines) : []),
    [preview?.lines],
  )

  const branchOptions = useMemo(() => {
    const rows = scope === null ? branches : branches.filter((b) => scope.includes(b.slug))
    return rows.map((b) => ({ value: b.slug, label: b.name || b.slug }))
  }, [branches, scope])

  const packageBranchOptions = useMemo(
    () => [
      { value: '', label: 'Company / HQ (no bay)' },
      ...branchOptions.filter((b) => b.value !== FIXED_SALARY_BOOKS_BRANCH),
    ],
    [branchOptions],
  )

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
          'wash_pool_pct, ceramic_shirt_deduction_minor, ceramic_card_fee_pct, ceramic_crew_solo_pct, ceramic_crew_split_pct, ceramic_detailer_split_pct, payout_frequency, payout_weekday, attendance_present_weight, attendance_late_weight, pending_floor_optional, cash_advance_auto_deduct',
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
    // Include claimed sales + occurred_at so pending coverage keys off proof days.
    const selectWithKind =
      'id, branch, frequency, period_start, period_end, status, wash_pool_pct, pos_sales_minor, total_payout_minor, confirmed_at, notes, run_kind, payroll_run_lines(id, staff_id, amount_minor, kind, branch, source_key, source_sale_id), payroll_run_sales(sale_id, branch, total_minor, sales(occurred_at))'
    const selectPlain =
      'id, branch, frequency, period_start, period_end, status, wash_pool_pct, pos_sales_minor, total_payout_minor, confirmed_at, notes, payroll_run_lines(id, staff_id, amount_minor, kind, branch, source_key, source_sale_id), payroll_run_sales(sale_id, branch, total_minor, sales(occurred_at))'
    const mapRuns = (rows) =>
      (rows || []).map((run) => ({
        ...run,
        payroll_run_sales: (run.payroll_run_sales || []).map((s) => ({
          sale_id: s.sale_id,
          branch: s.branch,
          total_minor: s.total_minor,
          business_date: String(s.sales?.occurred_at || '').slice(0, 10),
        })),
      }))
    let q = supabase
      .from('payroll_runs')
      .select(selectWithKind)
      .order('period_start', { ascending: false })
      .limit(80)
    if (Array.isArray(scope) && scope.length) {
      const branchList = scope.map((s) => `"${s}"`).join(',')
      q = q.or(`branch.in.(${branchList}),branch.is.null`)
    }
    const { data, error } = await q
    if (error) {
      let retryQ = supabase
        .from('payroll_runs')
        .select(selectPlain)
        .order('period_start', { ascending: false })
        .limit(80)
      if (Array.isArray(scope) && scope.length) {
        const branchList = scope.map((s) => `"${s}"`).join(',')
        retryQ = retryQ.or(`branch.in.(${branchList}),branch.is.null`)
      }
      const retry = await retryQ
      if (retry.error) toast.error(retry.error.message)
      else setRuns(mapRuns(retry.data))
    } else setRuns(mapRuns(data))
  }, [scope])

  const loadPendingCloses = useCallback(async () => {
    let q = supabase
      .from('shift_close_reports')
      .select('id, branch, business_date, status, shift_ended_at, submitted')
      .in('status', ['submitted', 'accepted', 'locked'])
      .order('business_date', { ascending: false })
      .limit(90)
    if (Array.isArray(scope) && scope.length) q = q.in('branch', scope)
    const { data, error } = await q
    if (!error) setPendingCloses(data || [])

    const days = (data || []).map((c) => String(c.business_date || '').slice(0, 10)).filter(Boolean)
    const branchesIn = [...new Set((data || []).map((c) => c.branch).filter(Boolean))]
    if (!days.length || !branchesIn.length) {
      setPosProofByKey(null)
      return
    }
    const minDay = days.reduce((a, b) => (a < b ? a : b))
    const maxDay = days.reduce((a, b) => (a > b ? a : b))
    let salesQ = supabase
      .from('sales')
      .select('id, branch, status, total_minor, occurred_at')
      .eq('status', 'paid')
      .gte('occurred_at', `${minDay}T00:00:00+08:00`)
      .lte('occurred_at', `${maxDay}T23:59:59.999+08:00`)
      .limit(2000)
    if (branchesIn.length === 1) salesQ = salesQ.eq('branch', branchesIn[0])
    else salesQ = salesQ.in('branch', branchesIn)
    const salesRes = await salesQ
    if (!salesRes.error) {
      setPosProofByKey(posProofTotalsByBranchDay(salesRes.data || []))
    }
  }, [scope])

  const pendingFloorQueue = useMemo(
    () => buildPendingFloorPayrollQueue({ closes: pendingCloses, runs, posProofByKey }),
    [pendingCloses, runs, posProofByKey],
  )

  function startAccumulatedFloorPay(group) {
    const readyDays = (group?.days || []).filter((d) => d.ready)
    if (!readyDays.length) {
      toast.message('Accept closes in Finance before running floor pay')
      return
    }
    const period_start = readyDays[0].business_date
    const period_end = readyDays[readyDays.length - 1].business_date
    setRunKind('floor')
    setBranch(group.branch)
    setFrequency('custom')
    setPeriodStart(period_start)
    setPeriodEnd(period_end)
    setPreview(null)
    setStep(0)
    setTab('run')
    setSearchParams({ tab: 'run' }, { replace: true })
    toast.message(
      readyDays.length > 1
        ? `Floor window ${period_start} → ${period_end} · ${readyDays.length} ready days`
        : `Floor day ${period_start}`,
    )
  }

  useEffect(() => {
    loadSettings().catch((err) => toast.error(err.message))
    loadRuns().catch((err) => toast.error(err.message))
    loadPendingCloses().catch(() => {})
    Promise.all([
      supabase
        .from('staff_pay_packages')
        .select('id, staff_id, package_kind, amount_minor, effective_from, notes, is_active, branch, staff_profiles(full_name)')
        .eq('is_active', true)
        .order('effective_from', { ascending: false }),
      supabase.from('staff_profiles').select('id, full_name, role, branch_slug').eq('is_active', true).order('full_name'),
    ]).then(([pkg, staff]) => {
      if (!pkg.error) {
        const rows = pkg.data || []
        const scoped =
          Array.isArray(scope) && scope.length
            ? rows.filter((row) => !row.branch || scope.includes(row.branch))
            : rows
        setPackages(scoped)
      }
      if (!staff.error) {
        const rows = staff.data || []
        const scoped =
          Array.isArray(scope) && scope.length
            ? rows.filter((row) => !row.branch_slug || scope.includes(row.branch_slug))
            : rows
        setStaffRoster(scoped)
      }
    })
  }, [loadSettings, loadRuns, loadPendingCloses, scope])

  useEffect(() => {
    setPreview(null)
  }, [branch, runKind])
    if (!periodStart || !periodEnd) return
    if (runKind === 'floor' && !branch) {
      toast.error('Pick a branch for floor pay')
      return
    }
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
      const isFixed = runKind === 'fixed'

      const emptyList = Promise.resolve([])
      const [salesRows, attRows, expRows, claimedRows, pkgRows, staffRows] = await Promise.all([
        isFixed
          ? emptyList
          : collectPaged(async (from, to) => {
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
        isFixed
          ? emptyList
          : collectPaged(async (from, to) => {
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
        isFixed
          ? emptyList
          : collectPaged(async (from, to) => {
              let q = supabase
                .from('expenses')
                .select('description, total_minor, branch, expense_kind')
                .or('description.like.ceramic:%,description.like.detailing:%')
                .gte('created_at', startIso)
                .lte('created_at', endIso)
              if (branch) q = q.eq('branch', branch)
              const { data, error } = await q.range(from, to)
              if (error) throw error
              return data || []
            }, 1000),
        isFixed
          ? emptyList
          : collectPaged(async (from, to) => {
              const { data, error } = await supabase.from('payroll_run_sales').select('sale_id').range(from, to)
              if (error) throw error
              return data || []
            }, 1000),
        (() => {
          let q = supabase
            .from('staff_pay_packages')
            .select(
              'id, staff_id, package_kind, amount_minor, effective_from, notes, is_active, branch, staff_profiles(id, full_name, branch_slug, role)',
            )
            .eq('is_active', true)
            .lte('effective_from', periodEnd)
          // Fixed salary: company-wide packages (any / null branch). Floor: bay packages only.
          if (!isFixed && branch) q = q.eq('branch', branch)
          return q
        })(),
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
        runKind,
        frequency,
      })
      setPreview(next)
      setStep(1)
      toast.success(
        isFixed
          ? `${next.lines.length} salary line(s) loaded`
          : `${next.proof.length} POS ticket(s) · ${next.lines.length} payout line(s)`,
      )
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
    const closeGate = floorConfirmBlockedByPendingCloses({
      pendingFloorOptional: rules.pending_floor_optional,
      runKind,
      branch,
      periodStart,
      periodEnd,
      closes: pendingCloses,
    })
    if (closeGate.blocked) {
      toast.error(closeGate.reason)
      return
    }
    const gate = payrollBlocksConfirm(preview)
    if (gate.blocked) {
      toast.error(gate.reason)
      return
    }
    setSaving(true)
    const payload = buildRunPayrollPayload({
      preview,
      branch: runKind === 'fixed' ? null : branch,
      frequency,
      runKind,
      notes: [runKind === 'fixed' ? 'Fixed salary' : 'Floor pay', notes].filter(Boolean).join(' · '),
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

  return (
    <section className="hakum-payroll flex flex-col gap-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="border-b border-border pb-4">
        <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Books</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <Banknote className="size-6 shrink-0 text-primary" aria-hidden />
          Payroll
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Floor pay for crew who worked the bay. Fixed salary for office roles (monthly package, auto-split by
          payout frequency). Cash advances approve here — not on POS.
        </p>
      </header>

      <div role="tablist" aria-label="Payroll sections" className="planner-v2-tabs">
        {[
          { id: 'home', label: 'Dashboard' },
          { id: 'run', label: 'Run payroll' },
          { id: 'cash-advance', label: 'Cash advances' },
          { id: 'packages', label: 'Salaries' },
          { id: 'history', label: 'Payouts' },
          { id: 'rules', label: 'Rules' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'is-on' : ''}
            aria-pressed={tab === item.id}
            onClick={() => {
              setTab(item.id)
              setSearchParams(item.id === 'home' ? {} : { tab: item.id }, { replace: true })
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'home' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Pending floor pay</CardTitle>
              <CardDescription>
                {rules.pending_floor_optional === false
                  ? 'Hard gate: accept end-of-shift in Finance, then confirm floor pay here. Close ₱ is attestation; POS proof ₱ is what pay uses.'
                  : 'Close days waiting for a floor run. Close ₱ is attestation; POS proof ₱ is paid sales for the same days.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {rules.pending_floor_optional === false && pendingFloorQueue.ready_day_count > 0 ? (
                <p className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
                  Floor confirm is blocked until these closes are handled · {pendingFloorQueue.ready_day_count} ready day
                  {pendingFloorQueue.ready_day_count === 1 ? '' : 's'}. Confirm from Run payroll after loading proof.
                </p>
              ) : null}
              {!pendingFloorQueue.groups.length ? (
                <p className="text-sm text-muted-foreground">
                  No uncovered closes. After Finance accepts an end of shift, SA/ASA get a notification — then confirm floor pay here.
                </p>
              ) : (
                pendingFloorQueue.groups.map((group) => (
                  <div
                    key={group.branch}
                    className="rounded-xl border border-border p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {group.branch} · {group.period_start}
                          {group.period_end !== group.period_start ? ` → ${group.period_end}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {group.ready_count} ready
                          {group.review_count ? ` · ${group.review_count} awaiting close review` : ''}
                          {' · '}
                          {group.days.length} day{group.days.length === 1 ? '' : 's'}
                        </p>
                        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                          Close attested · {formatMoney(group.close_sales_minor)}
                          {group.pos_proof_known
                            ? ` · POS proof · ${formatMoney(group.pos_proof_minor)}`
                            : ' · POS proof · loading…'}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {group.days.map((d) => d.business_date).join(' · ')}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.ready_count > 0 ? (
                          <Button
                            type="button"
                            className="min-h-11"
                            onClick={() => startAccumulatedFloorPay(group)}
                          >
                            Run floor pay
                            {group.days.length > 1 ? ` (${group.days.length} days)` : ''}
                          </Button>
                        ) : (
                          <Button type="button" variant="outline" className="min-h-11" asChild>
                            <Link to="/operations/finance?tab=shift-close">Accept closes in Finance</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <p className="text-xs text-muted-foreground">
                Ready days: {pendingFloorQueue.ready_day_count}
                {pendingFloorQueue.review_day_count
                  ? ` · still in review: ${pendingFloorQueue.review_day_count}`
                  : ''}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Next scheduled window</CardTitle>
              <CardDescription>
                {FREQ_LABELS[frequency] || frequency} · {periodStart || '—'} to {periodEnd || '—'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="min-h-11"
                onClick={() => {
                  setRunKind('floor')
                  setTab('run')
                  setSearchParams({ tab: 'run' }, { replace: true })
                  setStep(0)
                }}
              >
                Run floor pay
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  setRunKind('fixed')
                  setTab('run')
                  setSearchParams({ tab: 'run' }, { replace: true })
                  setStep(0)
                }}
              >
                Run fixed salary
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent payouts</CardTitle>
            </CardHeader>
            <CardContent className="hakum-payroll-table">
              {(runs || []).slice(0, 5).map((run) => (
                <article key={run.id} className="hakum-payroll-row">
                  <p className="font-medium">
                    {run.period_start} → {run.period_end}
                  </p>
                  <p className="text-muted-foreground">
                    {run.run_kind === 'fixed' || /fixed salary/i.test(run.notes || '')
                      ? 'Fixed'
                      : 'Floor'}{' '}
                    · {run.branch || 'company'} · {FREQ_LABELS[run.frequency] || run.frequency}
                  </p>
                  <Badge variant="secondary">{run.status}</Badge>
                  <p className="tabular-nums font-medium">{formatMoney(run.total_payout_minor)}</p>
                </article>
              ))}
              {!runs.length ? (
                <p className="text-sm text-muted-foreground">No payroll runs yet.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'run' && (
        <div className="flex flex-col gap-4">
          <ol className="hakum-payroll-steps">
            {wizardSteps.map((item, idx) => (
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
                <CardTitle>Choose who you are paying</CardTitle>
                <CardDescription>
                  {runKind === 'fixed'
                    ? 'Office / BA / marketing salaries — no bay required. Amounts are monthly, prorated for this frequency.'
                    : 'Floor pay uses attendance + paid POS at one bay.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="hakum-payroll-kind sm:col-span-2" role="group" aria-label="Payroll type">
                  {PAYROLL_RUN_KINDS.map((kind) => (
                    <button
                      key={kind.id}
                      type="button"
                      className={runKind === kind.id ? 'is-on' : ''}
                      aria-pressed={runKind === kind.id}
                      onClick={() => {
                        setRunKind(kind.id)
                        setPreview(null)
                        setStep(0)
                      }}
                    >
                      <strong>{kind.label}</strong>
                      <span>{kind.hint}</span>
                    </button>
                  ))}
                </div>
                {runKind === 'floor' ? (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="payroll-branch">Branch</Label>
                    <NamedSelect
                      id="payroll-branch"
                      value={branch}
                      onChange={setBranch}
                      options={branchOptions}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 sm:col-span-2">
                    <p className="text-sm font-medium">Company-wide salaries</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      No bay to pick. Books post under HQ / Office when an employee has no home branch.
                    </p>
                  </div>
                )}
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
                {runKind === 'fixed' && periodStart && frequency ? (
                  <p className="sm:col-span-2 text-xs text-muted-foreground">
                    Example: ₱30,000 / month → this run pays{' '}
                    {formatMoney(prorateMonthlyPackageMinor(3_000_000, frequency, { start: periodStart, end: periodEnd }))}{' '}
                    at {FREQ_LABELS[frequency]}.
                  </p>
                ) : (
                  <p className="sm:col-span-2 text-xs text-muted-foreground">
                    Loads wash pool + ceramic from days with attendance and unpaid POS tickets.
                  </p>
                )}
                <div className="sm:col-span-2">
                  <Button
                    className="min-h-11 w-full sm:w-auto"
                    disabled={loading || (runKind === 'floor' && !branch)}
                    onClick={loadProof}
                  >
                    {loading
                      ? 'Loading…'
                      : runKind === 'fixed'
                        ? 'Load salaried employees'
                        : 'Load POS proof'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {stepId === 'proof' && runKind !== 'fixed' && (
            <Card>
              <CardHeader>
                <CardTitle>POS proof</CardTitle>
                <CardDescription>
                  Paid wash sales in this window, minus tickets already on another payroll run. Detailing funds ceramic shares, not the wash pool.
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

          {stepId === 'people' && (
            <Card>
              <CardHeader>
                <CardTitle>Salaried employees</CardTitle>
                <CardDescription>
                  Override a prorated amount, or remove someone from this run. Next step adds commissions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!preview ? (
                  <p className="text-sm text-muted-foreground">Load salaried employees first.</p>
                ) : (
                  <div className="hakum-payroll-table">
                    {staffGroups.map((g) => {
                      const salaryLine = g.lines.find((l) => String(l.kind || '').startsWith('package'))
                      if (!salaryLine) return null
                      return (
                        <article key={g.staff_id || g.staff_name} className="hakum-payroll-row hakum-payroll-row--salary">
                          <div>
                            <p className="font-medium">{g.staff_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {g.role || 'Staff'}
                              {salaryLine.monthly_amount_minor
                                ? ` · monthly ${formatMoney(salaryLine.monthly_amount_minor)}`
                                : ''}
                            </p>
                          </div>
                          <Label className="sr-only" htmlFor={`sal-${salaryLine.key}`}>
                            This run amount for {g.staff_name}
                          </Label>
                          <Input
                            id={`sal-${salaryLine.key}`}
                            type="number"
                            min="0"
                            step="100"
                            className="min-h-11"
                            disabled={!canRun}
                            value={salaryLine.pay_minor}
                            onChange={(e) =>
                              setPreview((prev) => {
                                const lines = adjustPayrollLine(prev.lines, salaryLine.key, e.target.value)
                                return { ...prev, lines, total_payout_minor: netPayrollLinesMinor(lines) }
                              })
                            }
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            disabled={!canRun || !g.staff_id}
                            onClick={() =>
                              setPreview((prev) => {
                                const lines = removeStaffFromPayrollPreview(prev.lines, g.staff_id)
                                return { ...prev, lines, total_payout_minor: netPayrollLinesMinor(lines) }
                              })
                            }
                          >
                            Skip
                          </Button>
                        </article>
                      )
                    })}
                    {!staffGroups.some((g) => g.lines.some((l) => String(l.kind || '').startsWith('package'))) ? (
                      <p className="text-sm text-muted-foreground">
                        No active monthly salaries. Add people under Salaries first.
                      </p>
                    ) : null}
                  </div>
                )}
                <p className="text-sm font-medium">
                  Salary subtotal {formatMoney(preview?.lines?.filter((l) => String(l.kind || '').startsWith('package')).reduce((s, l) => s + (l.pay_minor || 0), 0) || 0)}
                </p>
              </CardContent>
            </Card>
          )}

          {stepId === 'extras' && (
            <Card>
              <CardHeader>
                <CardTitle>Commissions &amp; bonuses</CardTitle>
                <CardDescription>
                  Add commission or bonus on top of salary for this payout. Deductions also work here.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!preview ? (
                  <p className="text-sm text-muted-foreground">Load employees first.</p>
                ) : (
                  <>
                    <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2">
                      <NamedSelect
                        value={commissionForm.staffId}
                        onChange={(staffId) => setCommissionForm((f) => ({ ...f, staffId }))}
                        options={staffGroups
                          .filter((g) => g.staff_id)
                          .map((g) => ({ value: g.staff_id, label: g.staff_name }))}
                        placeholder="Employee"
                      />
                      <Input
                        placeholder="Label (e.g. Sales commission)"
                        value={commissionForm.label}
                        onChange={(e) => setCommissionForm((f) => ({ ...f, label: e.target.value }))}
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Amount (pesos)"
                        value={commissionForm.amountPesos}
                        onChange={(e) => setCommissionForm((f) => ({ ...f, amountPesos: e.target.value }))}
                      />
                      <Button
                        type="button"
                        className="min-h-11"
                        disabled={!canRun}
                        onClick={() => {
                          const staff = staffRoster.find((s) => s.id === commissionForm.staffId)
                          const amountMinor = Math.round(Number(commissionForm.amountPesos) * 100)
                          if (!staff || !(amountMinor > 0)) {
                            toast.error('Pick an employee and enter a commission amount')
                            return
                          }
                          setPreview((prev) => {
                            const lines = addPayrollCommission(prev.lines, {
                              staff,
                              branch: resolveFixedSalaryBranch({}, staff),
                              label: commissionForm.label || 'Commission',
                              amountMinor,
                            })
                            return { ...prev, lines, total_payout_minor: netPayrollLinesMinor(lines) }
                          })
                          setCommissionForm({ staffId: '', label: 'Commission', amountPesos: '' })
                          toast.success('Commission added')
                        }}
                      >
                        Add commission
                      </Button>
                    </div>
                    <div className="hakum-payroll-table">
                      {(preview.lines || [])
                        .filter((l) => !String(l.kind || '').startsWith('package'))
                        .map((row) => (
                          <article key={row.key} className="hakum-payroll-row">
                            <p className="font-medium">{row.staff_name}</p>
                            <p className="text-muted-foreground">
                              {row.direction === 'deduct' ? 'Deduct' : 'Add'} · {row.label || row.kind}
                            </p>
                            <Input
                              type="number"
                              min="0"
                              step="100"
                              className="min-h-11"
                              disabled={!canRun}
                              value={row.pay_minor}
                              onChange={(e) =>
                                setPreview((prev) => {
                                  const lines = adjustPayrollLine(prev.lines, row.key, e.target.value)
                                  return { ...prev, lines, total_payout_minor: netPayrollLinesMinor(lines) }
                                })
                              }
                            />
                          </article>
                        ))}
                      {!(preview.lines || []).some((l) => !String(l.kind || '').startsWith('package')) ? (
                        <p className="text-sm text-muted-foreground">No commissions yet — optional.</p>
                      ) : null}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {stepId === 'lines' && runKind !== 'fixed' && (
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
                            branch: branch || staff.branch_slug || FIXED_SALARY_BOOKS_BRANCH,
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

          {(stepId === 'review' || (stepId === 'confirm' && runKind !== 'fixed')) && (
            <Card>
              <CardHeader>
                <CardTitle>{runKind === 'fixed' ? 'Full payroll review' : 'Confirm payout'}</CardTitle>
                <CardDescription>
                  {runKind === 'fixed'
                    ? 'Every employee on this run — salary, commissions, and net. Adjust anything, then post.'
                    : 'Posts this run, locks the POS tickets, and writes salary expenses. This cannot be quietly undone.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">
                  {periodStart} to {periodEnd} · {FREQ_LABELS[frequency]}
                  {runKind === 'fixed' ? ' · company-wide' : ` · ${branch}`} · total{' '}
                  {formatMoney(preview?.total_payout_minor || 0)}
                </p>
                {runKind === 'fixed' ? (
                  <div className="hakum-payroll-table">
                    {staffGroups.map((g) => (
                      <article key={g.staff_id || g.staff_name} className="hakum-payroll-review">
                        <header>
                          <p className="font-medium">{g.staff_name}</p>
                          <p className="tabular-nums text-lg font-semibold">{formatMoney(g.total_minor)}</p>
                        </header>
                        <ul>
                          {g.lines.map((row) => (
                            <li key={row.key}>
                              <span>
                                {String(row.kind || '').startsWith('package')
                                  ? 'Salary'
                                  : row.label || row.kind.replaceAll('_', ' ')}
                                {row.direction === 'deduct' ? ' (deduct)' : ''}
                              </span>
                              <Input
                                type="number"
                                min="0"
                                step="100"
                                className="min-h-11 max-w-[9rem]"
                                disabled={!canRun}
                                value={row.pay_minor}
                                onChange={(e) =>
                                  setPreview((prev) => {
                                    const lines = adjustPayrollLine(prev.lines, row.key, e.target.value)
                                    return { ...prev, lines, total_payout_minor: netPayrollLinesMinor(lines) }
                                  })
                                }
                                aria-label={`${row.label || row.kind} for ${g.staff_name}`}
                              />
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-muted-foreground">
                          Salary {formatMoney(g.salary_minor)}
                          {g.commission_minor
                            ? ` · extras ${formatMoney(g.commission_minor)}`
                            : ''}
                        </p>
                      </article>
                    ))}
                    {!staffGroups.length ? (
                      <p className="text-sm text-muted-foreground">Nothing to pay — go back and load employees.</p>
                    ) : null}
                  </div>
                ) : null}
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
              disabled={step >= wizardSteps.length - 1 || (step === 0 && !preview)}
              onClick={() => setStep((s) => Math.min(wizardSteps.length - 1, s + 1))}
            >
              Next
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      )}

      {tab === 'cash-advance' && (
        <PayrollCashAdvancesPanel
          profile={profile}
          branch={branch}
          branchOptions={branchOptions}
          onBranchChange={setBranch}
          canApprove={canApproveCa}
        />
      )}

      {tab === 'packages' && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly salaries</CardTitle>
            <CardDescription>
              Enter the full monthly amount. Branch is optional — leave as Company / HQ for office roles with no bay.
              Fixed salary runs prorate by payout frequency.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canRun ? (
              <form
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const amount_minor = Math.round(Number(pkgForm.amountPesos) * 100)
                  const pkgBranch = pkgForm.branch || null
                  if (!pkgForm.staff_id || !(amount_minor > 0)) {
                    toast.error('Employee and monthly amount required')
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
                    toast.success('Monthly salary saved')
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
                  value={pkgForm.branch || ''}
                  onChange={(next) => setPkgForm((f) => ({ ...f, branch: next }))}
                  options={packageBranchOptions}
                  placeholder="Branch (optional)"
                />
                <NamedSelect
                  value={pkgForm.package_kind}
                  onChange={(package_kind) => setPkgForm((f) => ({ ...f, package_kind }))}
                  options={[
                    { value: 'fixed', label: 'Fixed salary' },
                    { value: 'hybrid', label: 'Hybrid (salary + extras)' },
                    { value: 'custom', label: 'Custom' },
                  ]}
                />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pkg-amount">Monthly amount (₱)</Label>
                  <Input
                    id="pkg-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 30000"
                    value={pkgForm.amountPesos}
                    onChange={(e) => setPkgForm((f) => ({ ...f, amountPesos: e.target.value }))}
                  />
                </div>
                <Input
                  className="sm:col-span-2"
                  placeholder="Notes (optional)"
                  value={pkgForm.notes}
                  onChange={(e) => setPkgForm((f) => ({ ...f, notes: e.target.value }))}
                />
                <Button type="submit" className="min-h-11 sm:col-span-2 sm:w-auto">
                  Save monthly salary
                </Button>
              </form>
            ) : null}
            <div className="hakum-payroll-table">
              {packages.map((p) => (
                <article key={p.id} className="hakum-payroll-row">
                  <p className="font-medium">{p.staff_profiles?.full_name || p.staff_id}</p>
                  <p className="text-muted-foreground">
                    {p.package_kind} · {p.branch || 'HQ / company'} · from {p.effective_from}
                  </p>
                  <p className="tabular-nums font-medium">{formatMoney(p.amount_minor)} / mo</p>
                </article>
              ))}
              {!packages.length ? (
                <p className="text-sm text-muted-foreground">No active monthly salaries yet.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'history' && (
        <div className="hakum-payroll-table">
          {runs.map((run) => {
            const kind =
              run.run_kind === 'fixed' || /fixed salary/i.test(run.notes || '') ? 'Fixed' : 'Floor'
            return (
              <article key={run.id} className="hakum-payroll-row">
                <p className="font-medium">
                  {kind} · {run.period_start} to {run.period_end}
                </p>
                <p className="text-muted-foreground">
                  {FREQ_LABELS[run.frequency] || run.frequency} · {run.branch || 'multi'} · {run.status}
                </p>
                <p>{formatMoney(run.total_payout_minor)} from {formatMoney(run.pos_sales_minor)} POS</p>
                <p className="text-xs text-muted-foreground">{(run.payroll_run_lines || []).length} employee lines</p>
              </article>
            )
          })}
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
