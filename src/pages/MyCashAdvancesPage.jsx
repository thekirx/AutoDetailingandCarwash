/** Crew / employee list of their own cash-advance requests (Michi C1). */
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessMyAdvances } from '@/auth/permissions'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cashAdvanceStatusMeta, formatCashAdvancePesos } from '@/lib/myCashAdvances'
import { cashAdvanceBalanceLabel, cashAdvanceBalances } from '@/lib/cashAdvanceBalance'
import { formatAccounting } from '@/lib/dailySheet'
import { loadCashAdvanceLedger } from '@/lib/dailySheetApi'
import { supabase } from '@/lib/supabase'

export default function MyCashAdvancesPage() {
  const { profile, user } = useAuth()
  const [rows, setRows] = useState([])
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const uid = user?.id || profile?.id
    if (!uid) return
    setLoading(true)
    try {
      const [{ data, error }, movements] = await Promise.all([
        supabase
          .from('ops_form_submissions')
          .select('id, status, payload, created_at, respondent_label, ops_forms!inner(kind)')
          .eq('ops_forms.kind', 'cash_advance')
          .eq('created_by', uid)
          .order('created_at', { ascending: false })
          .limit(50),
        loadCashAdvanceLedger(profile?.branch_slug || null, uid),
      ])
      if (error) throw error
      setRows(data || [])
      setLedger(movements || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [user?.id, profile?.id, profile?.branch_slug])

  useEffect(() => {
    if (canAccessMyAdvances(profile)) load()
  }, [load, profile])

  if (!canAccessMyAdvances(profile)) {
    return <Navigate to="/operations/attendance" replace />
  }

  const balance = cashAdvanceBalances(ledger)[0] || null

  return (
    <OpsPageShell
      eyebrow="Pay"
      title="My advances"
      description="Request an advance here. After it is approved, the branch records the cash on the Daily Sheet. This page shows what you still owe."
      actions={
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/operations/planning?tab=forms">Request advance</Link>
        </Button>
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Remaining</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {balance && balance.givenMinor > 0 ? formatAccounting(balance.remainingMinor) : formatAccounting(0)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {balance ? cashAdvanceBalanceLabel(balance) : 'No cash has been given yet.'}
            </p>
          </div>
          {!rows.length ? (
            <p className="text-sm text-muted-foreground">No advance requests yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {rows.map((row) => {
                const meta = cashAdvanceStatusMeta(row)
                return (
                  <li key={row.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold tabular-nums">{formatCashAdvancePesos(row.payload)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                          {row.payload?.branch ? ` · ${row.payload.branch}` : ''}
                        </p>
                        {row.payload?.reason ? (
                          <p className="mt-2 text-sm text-muted-foreground">{row.payload.reason}</p>
                        ) : null}
                      </div>
                      <Badge variant={meta.tone}>{meta.label}</Badge>
                    </div>
                    {meta.id === 'approved' ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Approved. The branch gives the cash on the Daily Sheet. It is cash, not a salary expense.
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
          {balance?.movements?.length ? (
            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">History</p>
              <ul className="flex flex-col gap-2">
                {balance.movements.map((move, index) => (
                  <li key={`${move.sheet_id}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      {move.kind === 'ca_repay' ? 'Paid back' : 'Given'}
                      {move.business_date ? ` · ${move.business_date}` : ''}
                    </span>
                    <span className="tabular-nums">{formatAccounting(move.kind === 'ca_repay' ? move.amount_minor : -move.amount_minor)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </OpsPageShell>
  )
}
