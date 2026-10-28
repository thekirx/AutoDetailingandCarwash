import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessMyPayslips } from '@/auth/permissions'
import { formatAccounting } from '@/lib/dailySheet'
import { payslipStatusLabel, payslipTakeHome } from '@/lib/payslip'
import { supabase } from '@/lib/supabase'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
export default function MyPayslipsPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [names, setNames] = useState({})
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('payslips')
      .select('id, period_start, period_end, salary_minor, incentive_minor, paid_from, note, status, signed_name, signed_at, branch')
      .eq('staff_id', profile.id)
      .order('period_start', { ascending: false })
    if (error) throw error
    setRows(data || [])
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.id || !canAccessMyPayslips(profile)) return
    load().catch((err) => toast.error(err.message || 'Could not load payslips'))
  }, [load, profile])

  if (!canAccessMyPayslips(profile)) return <Navigate to="/operations/access-denied" replace />

  async function receive(id) {
    setBusyId(id)
    try {
      const { error } = await supabase.rpc('mark_payslip_received', { p_id: id })
      if (error) throw error
      toast.success('Marked received')
      await load()
    } catch (err) {
      toast.error(err.message || 'Could not mark received')
    } finally {
      setBusyId('')
    }
  }

  async function sign(id) {
    const signedName = String(names[id] || '').trim()
    setBusyId(id)
    try {
      const { error } = await supabase.rpc('sign_payslip', { p_id: id, p_name: signedName })
      if (error) throw error
      toast.success('Payslip signed')
      await load()
    } catch (err) {
      toast.error(err.message || 'Could not sign')
    } finally {
      setBusyId('')
    }
  }

  return (
    <OpsPageShell
      className="hakum-my-payslips"
      eyebrow="Finance"
      title="Payslips"
      description="Each slip covers 14 days. Salary plus any incentive Lucy or Super Admin typed. No tax. Mark it received, then sign with your name."
      actions={
        <Button type="button" variant="outline" className="min-h-11" asChild>
          <Link to="/operations/my-advances">My advances</Link>
        </Button>
      }
    >
      {rows.length ? (
        <ul className="mx-auto flex w-full max-w-xl flex-col gap-3" aria-label="Your payslips">
          {rows.map((row) => {
            const takeHome = payslipTakeHome(row.salary_minor, row.incentive_minor)
            return (
              <li key={row.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {row.period_start} – {row.period_end}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.branch} · {payslipStatusLabel(row.status)}
                    </p>
                  </div>
                  <p className="shrink-0 text-right">
                    <span className="block text-xs text-muted-foreground">Take-home</span>
                    <span className="tabular-nums font-semibold">{formatAccounting(takeHome)}</span>
                  </p>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Salary</dt>
                    <dd className="tabular-nums">{formatAccounting(row.salary_minor)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Incentive</dt>
                    <dd className="tabular-nums">{formatAccounting(row.incentive_minor || 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Paid with</dt>
                    <dd>{row.paid_from === 'gcash' ? 'GCash' : 'Cash'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Note</dt>
                    <dd className="break-words">{row.note || '—'}</dd>
                  </div>
                </dl>
                {row.status === 'sent' ? (
                  <Button type="button" className="mt-3 min-h-11" disabled={busyId === row.id} onClick={() => receive(row.id)}>
                    I received this
                  </Button>
                ) : null}
                {row.status === 'received' ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Label htmlFor={`sign-${row.id}`}>Sign with your name</Label>
                      <Input
                        id={`sign-${row.id}`}
                        className="min-h-11"
                        value={names[row.id] || ''}
                        onChange={(e) => setNames((cur) => ({ ...cur, [row.id]: e.target.value }))}
                        autoComplete="name"
                      />
                    </div>
                    <Button type="button" className="min-h-11" disabled={busyId === row.id} onClick={() => sign(row.id)}>
                      Sign
                    </Button>
                  </div>
                ) : null}
                {row.status === 'signed' ? (
                  <p className="mt-3 text-sm">Signed as {row.signed_name}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mx-auto w-full max-w-xl text-sm text-muted-foreground">No payslip yet. Office pay is sent here each half month.</p>
      )}
    </OpsPageShell>
  )
}
