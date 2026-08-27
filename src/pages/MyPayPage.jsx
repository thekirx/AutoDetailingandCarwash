/** Employee payouts. Super Admin uses the Payroll register instead. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Banknote } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessPayroll, canViewOwnPay, getBranchScopeList } from '@/auth/permissions'
import { branchSlugsForOwnPay } from '@/lib/branchScope'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import {
  confirmedPayInCalendarWindow,
  currentPostedPayoutMinor,
  manilaMonthBounds,
  payrollPeriodRange,
  validatePayrollCustomRange,
} from '@/lib/payroll'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NamedSelect } from '@/components/ui/named-select'
import { toast } from 'sonner'

const MY_PAY_PERIODS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
  { value: 'custom', label: 'Custom' },
]

export default function MyPayPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [estimateMinor, setEstimateMinor] = useState(0)
  const [loading, setLoading] = useState(true)
  const [freq, setFreq] = useState('monthly')
  const [anchor, setAnchor] = useState(() => getLocalCalendarDate())
  const [customStart, setCustomStart] = useState(() => getLocalCalendarDate())
  const [customEnd, setCustomEnd] = useState(() => getLocalCalendarDate())
  const [cashAdvances, setCashAdvances] = useState([])
  const [caRepayments, setCaRepayments] = useState([])
  const [kpi, setKpi] = useState({ avg_minutes: null, failed_qa: 0 })

  const today = getLocalCalendarDate()
  const month = useMemo(() => manilaMonthBounds(today), [today])
  const period = useMemo(() => {
    if (freq === 'custom') {
      const check = validatePayrollCustomRange(customStart, customEnd)
      if (!check.ok) return { start: customStart, end: customEnd, error: check.reason }
      return payrollPeriodRange('custom', anchor, { start: customStart, end: customEnd })
    }
    return payrollPeriodRange(freq, anchor)
  }, [freq, anchor, customStart, customEnd])

  const estimateBranches = useMemo(
    () => branchSlugsForOwnPay(profile, getBranchScopeList),
    [profile],
  )

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)

    const periodStart = period.start
    const periodEnd = period.end

    const linesPromise = supabase
      .from('payroll_run_lines')
      .select('id, amount_minor, kind, branch, source_key, source_sale_id, created_at, payroll_runs(period_start, period_end, status, frequency, confirmed_at)')
      .eq('staff_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(100)

    const settingsPromise = supabase
      .from('compensation_settings')
      .select('wash_pool_pct')
      .eq('id', 1)
      .maybeSingle()

    const caPromise = supabase
      .from('ops_form_submissions')
      .select('id, payload, status, created_at, resolved_at, ops_forms!inner(kind, name)')
      .eq('ops_forms.kind', 'cash_advance')
      .order('created_at', { ascending: false })
      .limit(80)

    const repayPromise = supabase
      .from('expenses')
      .select('id, title, description, total_minor, expense_kind, branch, status, created_at')
      .in('expense_kind', ['ca_repayment', 'cash_advance_payment'])
      .order('created_at', { ascending: false })
      .limit(80)

    const kpiPromise = supabase.rpc('get_crew_kpi', {
      input_start_date: periodStart,
      input_end_date: periodEnd,
      input_branch_slug: estimateBranches[0] || null,
    })

    let salesPromise
    let attPromise
    if (!estimateBranches.length) {
      salesPromise = Promise.resolve({ data: [], error: null })
      attPromise = Promise.resolve({ data: [], error: null })
    } else {
      salesPromise = supabase
        .from('sales')
        .select('id, branch, status, total_minor, occurred_at, sale_line_items(line_total_minor, services(pay_category, salary_pct))')
        .eq('status', 'paid')
        .in('branch', estimateBranches)
        .gte('occurred_at', `${today}T00:00:00+08:00`)
        .lte('occurred_at', `${today}T23:59:59.999+08:00`)
      attPromise = supabase
        .from('staff_attendance')
        .select('staff_id, branch_slug, attendance_date, status, staff_profiles(id, full_name, role)')
        .in('branch_slug', estimateBranches)
        .eq('attendance_date', today)
    }

    const [linesRes, settingsRes, salesRes, attRes, caRes, repayRes, kpiRes] = await Promise.all([
      linesPromise,
      settingsPromise,
      salesPromise,
      attPromise,
      caPromise,
      repayPromise,
      kpiPromise,
    ])
    setLoading(false)
    if (linesRes.error) toast.error(linesRes.error.message)
    else setRows(linesRes.data || [])

    const ownCas = (caRes.data || []).filter(
      (row) => String(row.payload?.staff_id || '') === String(profile.id),
    )
    setCashAdvances(ownCas)

    const nameNeedle = String(profile.full_name || '').trim().toLowerCase()
    const ownRepay = (repayRes.data || []).filter((row) => {
      const blob = `${row.title || ''} ${row.description || ''}`.toLowerCase()
      if (String(profile.id) && blob.includes(String(profile.id).toLowerCase())) return true
      return nameNeedle && blob.includes(nameNeedle)
    })
    setCaRepayments(ownRepay)

    if (!kpiRes.error) {
      const mine = (kpiRes.data || []).filter((r) => String(r.staff_id) === String(profile.id))
      const cars = mine.reduce((s, r) => s + (Number(r.cars_handled) || 0), 0)
      const seconds = mine.reduce((s, r) => s + (Number(r.completed_deployed_seconds) || 0), 0)
      const failed = mine.reduce((s, r) => s + (Number(r.failed_qa) || 0), 0)
      setKpi({
        avg_minutes: cars > 0 ? Math.round((seconds / cars / 60) * 10) / 10 : null,
        failed_qa: failed,
      })
    } else {
      setKpi({ avg_minutes: null, failed_qa: 0 })
    }

    if (!estimateBranches.length) {
      setEstimateMinor(0)
      return
    }

    try {
      const { buildPayrollPreview } = await import('@/lib/payroll')
      const attendance = (attRes.data || []).map((row) => ({
        id: row.staff_id,
        staff_id: row.staff_id,
        full_name: row.staff_profiles?.full_name || '',
        role: row.staff_profiles?.role || '',
        branch_slug: row.branch_slug,
        attendance_date: row.attendance_date,
        status: row.status,
      }))
      const preview = buildPayrollPreview({
        period: { start: today, end: today },
        rules: { wash_pool_pct: Number(settingsRes.data?.wash_pool_pct) || 35 },
        sales: salesRes.data || [],
        attendance,
      })
      const mine = (preview.lines || [])
        .filter((l) => l.staff_id === profile.id)
        .reduce((s, l) => s + (Number(l.pay_minor) || 0), 0)
      setEstimateMinor(mine)
    } catch {
      setEstimateMinor(0)
    }
  }, [profile?.id, profile?.full_name, estimateBranches, today, period.start, period.end])

  useEffect(() => {
    load()
  }, [load])

  if (!canViewOwnPay(profile)) {
    return <Navigate to={canAccessPayroll(profile) ? '/operations/payroll' : '/operations/access-denied'} replace />
  }

  const open = rows.filter((row) => ['confirmed', 'paid'].includes(row.payroll_runs?.status))
  const inPeriod = open.filter((row) => {
    const ps = row.payroll_runs?.period_start
    const pe = row.payroll_runs?.period_end
    if (!ps || !pe) return false
    return pe >= period.start && ps <= period.end
  })
  const current = currentPostedPayoutMinor(open)
  const todayConfirmed = confirmedPayInCalendarWindow(open, { start: today, end: today })
  const monthConfirmed = confirmedPayInCalendarWindow(open, { start: month.start, end: month.end })
  const periodConfirmed = confirmedPayInCalendarWindow(open, { start: period.start, end: period.end })

  return (
    <section className="hakum-payroll flex flex-col gap-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="border-b border-border pb-4">
        <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Pay</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <Banknote className="size-6 shrink-0 text-primary" aria-hidden />
          My pay
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Confirmed pay is money already posted from Payroll — floor (wash/ceramic) and fixed salary both show here.
          Estimates are unpaid wash-pool shares until a run confirms.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Report period</CardTitle>
          <CardDescription>
            {period.start} to {period.end}
            {period.error ? ` · ${period.error}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <Label>Frequency</Label>
            <NamedSelect
              value={freq}
              onChange={setFreq}
              options={MY_PAY_PERIODS}
              placeholder="Period"
            />
          </div>
          {freq !== 'custom' ? (
            <div className="flex flex-col gap-1">
              <Label>Anchor day</Label>
              <Input type="date" className="min-h-11" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <Label>Start</Label>
                <Input
                  type="date"
                  className="min-h-11"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>End</Label>
                <Input
                  type="date"
                  className="min-h-11"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="flex flex-col justify-end">
            <p className="text-2xl font-semibold tabular-nums">{loading ? '…' : formatMoney(periodConfirmed)}</p>
            <p className="text-xs text-muted-foreground">Confirmed in this period</p>
          </div>
        </CardContent>
      </Card>

      {!estimateBranches.length ? (
        <p className="text-sm text-muted-foreground">
          No branch assignment on your profile — ask Super Admin to assign a branch before estimates can load.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Today (confirmed)</CardTitle>
            <CardDescription>Posted lines covering today</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{loading ? '…' : formatMoney(todayConfirmed)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">This month (confirmed)</CardTitle>
            <CardDescription>
              {month.start} to {month.end}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{loading ? '…' : formatMoney(monthConfirmed)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Estimate — unpaid</CardTitle>
            <CardDescription>Today’s wash pool share (not posted)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-muted-foreground">
              {loading ? '…' : formatMoney(estimateMinor)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your KPIs</CardTitle>
            <CardDescription>
              Avg service time + failed QA · {period.start} → {period.end}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6">
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {loading ? '…' : kpi.avg_minutes == null ? '—' : `${kpi.avg_minutes} min`}
              </p>
              <p className="text-xs text-muted-foreground">Avg completed service</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{loading ? '…' : kpi.failed_qa}</p>
              <p className="text-xs text-muted-foreground">Failed QA</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cash advances</CardTitle>
            <CardDescription>Your requests + repayments only</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!cashAdvances.length && !caRepayments.length ? (
              <p className="text-muted-foreground">No cash advances on file for you.</p>
            ) : null}
            {cashAdvances.slice(0, 8).map((row) => (
              <div key={row.id} className="flex justify-between gap-2 tabular-nums">
                <span>
                  Advance · {row.status}
                  {row.payload?.amount != null ? ` · ₱${row.payload.amount}` : ''}
                </span>
                <span className="text-xs text-muted-foreground">{String(row.created_at || '').slice(0, 10)}</span>
              </div>
            ))}
            {caRepayments.slice(0, 8).map((row) => (
              <div key={row.id} className="flex justify-between gap-2 tabular-nums">
                <span>Repay · {row.title || 'CA repayment'} · {formatMoney(row.total_minor)}</span>
                <span className="text-xs text-muted-foreground">{String(row.created_at || '').slice(0, 10)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest confirmed payout</CardTitle>
          <CardDescription>
            {current.periodStart
              ? `${current.periodStart} to ${current.periodEnd}`
              : 'Nothing posted yet. After payroll runs, your share shows here.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold tracking-tight">{loading ? '…' : formatMoney(current.amountMinor)}</p>
        </CardContent>
      </Card>

      <div className="hakum-payroll-table">
        {(inPeriod.length ? inPeriod : open).map((row) => (
          <article key={row.id} className="hakum-payroll-row">
            <p className="font-medium">{formatMoney(row.amount_minor)}</p>
            <p className="text-muted-foreground">
              {String(row.source_key || '').startsWith('deduct:') ? 'Deduct · ' : ''}
              {String(row.kind || '').startsWith('package') || String(row.source_key || '').startsWith('package:')
                ? 'Fixed salary'
                : row.kind === 'wash_pool'
                  ? 'Floor · wash pool'
                  : row.kind === 'ceramic_detailer'
                    ? 'Detailing · detailer'
                    : row.kind === 'ceramic_crew'
                      ? 'Detailing · crew'
                      : String(row.kind || '').replaceAll('_', ' ')}{' '}
              · {row.branch}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.payroll_runs?.period_start} to {row.payroll_runs?.period_end}
              {row.source_sale_id ? ` · POS ${String(row.source_sale_id).slice(0, 8)}` : ''}
            </p>
          </article>
        ))}
        {!loading && !open.length ? (
          <p className="text-sm text-muted-foreground">
            No confirmed pay yet — hang tight until Payroll posts a run. Estimates above are not money in hand.
          </p>
        ) : null}
      </div>

      {canAccessPayroll(profile) ? (
        <p className="text-sm">
          <Link className="text-primary underline-offset-4 hover:underline" to="/operations/payroll">
            Open payroll register
          </Link>
        </p>
      ) : null}
    </section>
  )
}
