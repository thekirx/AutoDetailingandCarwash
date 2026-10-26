import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessMyPayslips } from '@/auth/permissions'
import { formatAccounting } from '@/lib/dailySheet'
import { payslipStatusLabel } from '@/lib/payslip'
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
      description="Each slip is one half of a month. Salary plus any incentive. No tax. Mark it received, then sign with your name."
      actions={
        <Button type="button" variant="outline" className="min-h-11" asChild>
          <Link to="/operations/my-advances">My advances</Link>
        </Button>
      }
    >
      {rows.length ? (
        <ul className="mx-auto flex w-full max-w-xl flex-col gap-3" aria-label="Your payslips">
          {rows.map((row) => {
            const takeHome = (Number(row.salary_minor) || 0) + (Number(row.incentive_minor) || 0)
            return (
              <li key={row.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {row.period_start} – {row.period_end}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.branch} · {row.paid_from === 'gcash' ? 'GCash' : 'Cash'} · {payslipStatusLabel(row.status)}
                    </p>
                  </div>
                  <p className="tabular-nums font-medium">{formatAccounting(takeHome)}</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Salary {formatAccounting(row.salary_minor)}
                  {row.incentive_minor > 0 ? ` · Incentive ${formatAccounting(row.incentive_minor)}` : ''}
                  {row.note ? ` · ${row.note}` : ''}
                </p>
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
