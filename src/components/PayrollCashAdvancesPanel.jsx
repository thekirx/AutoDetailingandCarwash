/** Payroll inbox: approve / decline cash advances (not POS). */
import { useCallback, useEffect, useState } from 'react'
import { Check, XCircle } from 'lucide-react'
import { getBranchScopeList } from '@/auth/permissions'
import { writeAudit } from '@/lib/audit'
import { approvedCaForCloseDay } from '@/lib/bacoorDailyReport'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { cashAdvanceInBranchScope } from '@/lib/posSale'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NamedSelect } from '@/components/ui/named-select'
import { toast } from 'sonner'

const SELECT =
  'id, form_id, payload, status, respondent_label, created_at, resolved_at, ops_forms!inner ( name, kind, slug )'

export default function PayrollCashAdvancesPanel({
  profile,
  branch,
  branchOptions,
  onBranchChange,
  canApprove,
}) {
  const [pending, setPending] = useState([])
  const [approvedToday, setApprovedToday] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!branch) return
    setLoading(true)
    const today = getLocalCalendarDate()
    const [pendingRes, resolvedRes] = await Promise.all([
      supabase
        .from('ops_form_submissions')
        .select(SELECT)
        .eq('status', 'new')
        .eq('ops_forms.kind', 'cash_advance')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('ops_form_submissions')
        .select(SELECT)
        .eq('status', 'resolved')
        .eq('ops_forms.kind', 'cash_advance')
        .gte('resolved_at', `${today}T00:00:00+08:00`)
        .order('resolved_at', { ascending: false })
        .limit(100),
    ])
    setLoading(false)
    if (pendingRes.error) {
      toast.error(pendingRes.error.message)
      return
    }
    if (resolvedRes.error) toast.error(resolvedRes.error.message)
    const scope = getBranchScopeList(profile)
    const inScope = (row) => cashAdvanceInBranchScope(row, { branch, branchScopeList: scope })
    setPending((pendingRes.data || []).filter(inScope))
    setApprovedToday(
      (resolvedRes.data || []).filter(inScope).filter((row) => approvedCaForCloseDay(row, today)),
    )
  }, [branch, profile])

  useEffect(() => {
    load()
  }, [load])

  async function updateStatus(row, status) {
    if (!canApprove) return
    const { error } = await supabase.from('ops_form_submissions').update({ status }).eq('id', row.id)
    if (error) {
      toast.error(error.message)
      return
    }
    const p = row.payload || {}
    toast.success(`Cash advance ${status === 'resolved' ? 'approved' : 'declined'}`)
    writeAudit({
      action: 'payroll.cash_advance',
      entityType: 'ops_form_submission',
      entityId: row.id,
      summary: `Cash advance ${status === 'resolved' ? 'approved' : 'declined'} · ${branch}`,
      meta: { branch, amount_minor: Math.round(Number(p.amount || 0) * 100), status },
    })
    load()
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Cash advances</CardTitle>
          <CardDescription>
            Approve or decline employee requests here. Approved amounts roll into today’s POS daily
            close (expenses + cash left) and can be overridden on End of shift.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="payroll-ca-branch">
              Branch
            </label>
            <NamedSelect
              id="payroll-ca-branch"
              value={branch}
              onChange={onBranchChange}
              options={branchOptions}
            />
          </div>
          {!canApprove ? (
            <p className="self-end text-sm text-muted-foreground">
              View only — approve needs finance write.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading cash advances…</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight">Pending</h2>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open cash advance requests for this branch.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {pending.map((row) => {
                  const p = row.payload || {}
                  return (
                    <Card key={row.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">
                            {p.employee_name || row.respondent_label || 'Employee'}
                          </CardTitle>
                          <Badge variant="outline">{row.status}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-2xl font-semibold tabular-nums">
                          {formatMoney(Number(p.amount || 0) * 100)}
                        </p>
                        {p.needed_by ? (
                          <p className="text-xs text-muted-foreground">Needed by: {p.needed_by}</p>
                        ) : null}
                        {p.reason ? <p className="text-sm">{p.reason}</p> : null}
                        <p className="text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleString()}
                        </p>
                        {canApprove ? (
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              className="gap-1.5"
                              onClick={() => updateStatus(row, 'resolved')}
                            >
                              <Check className="size-3.5" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => updateStatus(row, 'archived')}
                            >
                              <XCircle className="size-3.5" /> Decline
                            </Button>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight">Approved today</h2>
            {approvedToday.length === 0 ? (
              <p className="text-sm text-muted-foreground">None approved for this branch today.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {approvedToday.map((row) => {
                  const p = row.payload || {}
                  return (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <span>{p.employee_name || row.respondent_label || 'Employee'}</span>
                      <span className="tabular-nums font-medium">
                        {formatMoney(Number(p.amount || 0) * 100)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
