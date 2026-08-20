/** Employee payouts. Super Admin uses the Payroll register instead. */
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Banknote } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessPayroll, canViewOwnPay } from '@/auth/permissions'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function MyPayPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('payroll_run_lines')
      .select('id, amount_minor, kind, branch, source_key, source_sale_id, created_at, payroll_runs(period_start, period_end, status, frequency, confirmed_at)')
      .eq('staff_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setLoading(false)
    if (error) toast.error(error.message)
    else setRows(data || [])
  }, [profile?.id])

  useEffect(() => {
    load()
  }, [load])

  if (!canViewOwnPay(profile)) {
    return <Navigate to={canAccessPayroll(profile) ? '/operations/payroll' : '/operations/access-denied'} replace />
  }

  const open = rows.filter((row) => ['confirmed', 'paid'].includes(row.payroll_runs?.status))
  const current = open[0]
  const total = open.reduce((sum, row) => sum + (Number(row.amount_minor) || 0), 0)

  return (
    <section className="hakum-payroll flex flex-col gap-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="border-b border-border pb-4">
        <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Pay</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <Banknote className="size-6 shrink-0 text-primary" aria-hidden />
          My pay
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Confirmed payroll from POS sales. Wash pool estimates on Attendance are not a posted payout.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Current payout</CardTitle>
          <CardDescription>
            {current
              ? `${current.payroll_runs.period_start} to ${current.payroll_runs.period_end}`
              : 'Nothing posted yet. After payroll runs, your share shows here.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold tracking-tight">{loading ? '…' : formatMoney(current?.amount_minor || 0)}</p>
          <p className="mt-2 text-sm text-muted-foreground">All posted lines {formatMoney(total)}</p>
        </CardContent>
      </Card>

      <div className="hakum-payroll-table">
        {open.map((row) => (
          <article key={row.id} className="hakum-payroll-row">
            <p className="font-medium">{formatMoney(row.amount_minor)}</p>
            <p className="text-muted-foreground">
              {row.kind.replaceAll('_', ' ')} · {row.branch}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.payroll_runs?.period_start} to {row.payroll_runs?.period_end}
              {row.source_sale_id ? ` · POS ${String(row.source_sale_id).slice(0, 8)}` : ''}
            </p>
          </article>
        ))}
        {!loading && !open.length ? (
          <p className="text-sm text-muted-foreground">No posted payouts yet.</p>
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
