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
import { supabase } from '@/lib/supabase'

export default function MyCashAdvancesPage() {
  const { profile, user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const uid = user?.id || profile?.id
    if (!uid) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('ops_form_submissions')
        .select('id, status, payload, created_at, respondent_label, ops_forms!inner(kind)')
        .eq('ops_forms.kind', 'cash_advance')
        .eq('created_by', uid)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      setRows(data || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [user?.id, profile?.id])

  useEffect(() => {
    if (canAccessMyAdvances(profile)) load()
  }, [load, profile])

  if (!canAccessMyAdvances(profile)) {
    return <Navigate to="/operations/attendance" replace />
  }

  return (
    <OpsPageShell
      eyebrow="Pay"
      title="My advances"
      description="Cash advances you requested. Approval does not add expense to the books — Branch Admin types the code on the Daily Sheet to give cash."
      actions={
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/operations/planning?tab=forms">Request advance</Link>
        </Button>
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !rows.length ? (
        <p className="text-sm text-muted-foreground">
          No advance requests yet. Open Forms to submit a cash advance.
        </p>
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
                    Approved. Branch Admin gives the cash on the Daily Sheet — this is drawer cash, not a salary expense.
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </OpsPageShell>
  )
}
