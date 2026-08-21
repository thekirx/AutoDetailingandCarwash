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
} from '@/lib/payroll'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function MyPayPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [estimateMinor, setEstimateMinor] = useState(0)
  const [loading, setLoading] = useState(true)

  const today = getLocalCalendarDate()
  const month = useMemo(() => manilaMonthBounds(today), [today])
  const estimateBranches = useMemo(
    () => branchSlugsForOwnPay(profile, getBranchScopeList),
    [profile],
  )

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)

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

    let salesPromise
    let attPromise
    if (!estimateBranches.length) {
      salesPromise = Promise.resolve({ data: [], error: null })
      attPromise = Promise.resolve({ data: [], error: null })
    } else {
      salesPromise = supabase
        .from('sales')
        .select('id, branch, status, total_minor, occurred_at, sale_line_items(line_total_minor, services(pay_category))')
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

    const [linesRes, settingsRes, salesRes, attRes] = await Promise.all([
      linesPromise,
      settingsPromise,
      salesPromise,
      attPromise,
    ])
    setLoading(false)
    if (linesRes.error) toast.error(linesRes.error.message)
    else setRows(linesRes.data || [])

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
  }, [profile?.id, estimateBranches, today])

  useEffect(() => {
    load()
  }, [load])

  if (!canViewOwnPay(profile)) {
    return <Navigate to={canAccessPayroll(profile) ? '/operations/payroll' : '/operations/access-denied'} replace />
  }

  const open = rows.filter((row) => ['confirmed', 'paid'].includes(row.payroll_runs?.status))
  const current = currentPostedPayoutMinor(open)
  const todayConfirmed = confirmedPayInCalendarWindow(open, { start: today, end: today })
  const monthConfirmed = confirmedPayInCalendarWindow(open, { start: month.start, end: month.end })

  return (
    <section className="hakum-payroll flex flex-col gap-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="border-b border-border pb-4">
        <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Pay</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <Banknote className="size-6 shrink-0 text-primary" aria-hidden />
          My pay
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Confirmed pay is money already posted from Payroll. Estimates are unpaid wash-pool shares until a run confirms.
        </p>
      </header>

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
        {open.map((row) => (
          <article key={row.id} className="hakum-payroll-row">
            <p className="font-medium">{formatMoney(row.amount_minor)}</p>
            <p className="text-muted-foreground">
              {String(row.source_key || '').startsWith('deduct:') ? 'Deduct · ' : ''}
              {row.kind.replaceAll('_', ' ')} · {row.branch}
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
