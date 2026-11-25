/** Crew / employee list of their own cash-advance requests (Michi C1) + Owner/ASA All-Staff Cash Advance Hub. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Check, RefreshCw, Search, Trash2, Wallet, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessMyAdvances, canAccessMyPayslips, canApproveCashAdvance, canEditFinanceBooks, isSuperAdmin } from '@/auth/permissions'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cashAdvanceStatusMeta, formatCashAdvancePesos } from '@/lib/myCashAdvances'
import { cashAdvanceBalanceLabel, cashAdvanceBalances } from '@/lib/cashAdvanceBalance'
import { formatAccounting } from '@/lib/dailySheet'
import { loadCashAdvanceLedger } from '@/lib/dailySheetApi'
import { callFinanceOwnerOps } from '@/lib/financeOwnerClient'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { enrichCashAdvancePayload } from '@/lib/payroll'
import { supabase } from '@/lib/supabase'

export default function MyCashAdvancesPage({ embedded = false } = {}) {
  const { profile, user } = useAuth()
  const isOwner = isSuperAdmin(profile)
  const canApprove = canApproveCashAdvance(profile)

  const [rows, setRows] = useState([])
  const [ledger, setLedger] = useState([])
  const [allRequests, setAllRequests] = useState([])
  const [allLedger, setAllLedger] = useState([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [branchChoice, setBranchChoice] = useState(profile?.branch_slug || 'bacoor')
  const [asking, setAsking] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')

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
        loadCashAdvanceLedger(profile?.branch_slug || (isOwner ? 'all' : null), uid).catch(() => []),
      ])
      if (error) throw error
      setRows(data || [])
      setLedger(movements || [])

      if (canApprove) {
        const [hubRes, companyMovements] = await Promise.all([
          callFinanceOwnerOps({ action: 'manage-cash-advance', sub_action: 'list' }).catch(() => ({ submissions: [] })),
          loadCashAdvanceLedger(isOwner ? 'all' : profile?.branch_slug || 'bacoor', null).catch(() => []),
        ])
        setAllRequests(hubRes?.submissions || [])
        setAllLedger(companyMovements || [])
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [user?.id, profile?.id, profile?.branch_slug, isOwner, canApprove])

  useEffect(() => {
    if (canAccessMyAdvances(profile)) load()
  }, [load, profile])

  async function ask(event) {
    event.preventDefault()
    const pesos = Number(String(amount).replace(/,/g, ''))
    if (!Number.isFinite(pesos) || pesos <= 0) return toast.error('Enter the peso amount.')
    if (!reason.trim()) return toast.error('Say what the advance is for.')
    setAsking(true)
    try {
      const { data: form, error: formError } = await supabase
        .from('ops_forms')
        .select('id')
        .eq('kind', 'cash_advance')
        .limit(1)
        .maybeSingle()
      if (formError) throw formError
      if (!form?.id) throw new Error('Cash advance requests are not set up yet.')
      const payload = enrichCashAdvancePayload(
        {
          amount: pesos,
          reason: reason.trim(),
          branch: profile?.branch_slug || branchChoice || 'bacoor',
          needed_by: getLocalCalendarDate(),
          employee_name: profile?.full_name || '',
        },
        profile,
      )
      const { error } = await supabase.from('ops_form_submissions').insert({
        form_id: form.id,
        payload,
        respondent_label: profile?.full_name || null,
        source: 'staff',
        created_by: profile.id,
      })
      if (error) throw error
      toast.success('Request sent. After approval, the branch records the cash on the Daily Sheet.')
      setAmount('')
      setReason('')
      await load()
    } catch (err) {
      toast.error(err.message || 'Could not send the request')
    } finally {
      setAsking(false)
    }
  }

  async function handleDecision(id, action) {
    setBusyId(id)
    try {
      const { data, error } = await supabase.rpc('approve_cash_advance', {
        payload: { id, action },
      })
      if (error) throw error
      if (action === 'approve' && data?.approval_code) {
        toast.success(`Approved — code ${data.approval_code} minted for Daily Sheet release.`)
      } else {
        toast.success('Cash advance request declined.')
      }
      await load()
    } catch (err) {
      toast.error(err.message || 'Could not update cash advance request')
    } finally {
      setBusyId('')
    }
  }

  async function handleDeleteSubmission(id) {
    setBusyId(id)
    try {
      await callFinanceOwnerOps({ action: 'manage-cash-advance', sub_action: 'delete', id })
      toast.success('Cash advance request deleted.')
      await load()
    } catch (err) {
      toast.error(err.message || 'Could not delete cash advance request')
    } finally {
      setBusyId('')
    }
  }

  const uid = user?.id || profile?.id
  const personalLedger = useMemo(
    () => (ledger || []).filter((r) => !uid || r.staff_id === uid),
    [ledger, uid],
  )
  const balance = cashAdvanceBalances(personalLedger)[0] || null
  const allBalances = useMemo(() => cashAdvanceBalances(allLedger), [allLedger])

  const filteredRequests = useMemo(() => {
    return (allRequests || []).filter((r) => {
      const meta = cashAdvanceStatusMeta(r)
      if (statusFilter !== 'all' && meta.id !== statusFilter) return false
      const br = String(r.payload?.branch || '').toLowerCase()
      if (branchFilter !== 'all' && br !== branchFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const name = String(r.payload?.employee_name || r.respondent_label || '').toLowerCase()
        const code = String(r.payload?.approval_code || '').toLowerCase()
        const why = String(r.payload?.reason || '').toLowerCase()
        if (!name.includes(q) && !code.includes(q) && !why.includes(q)) return false
      }
      return true
    })
  }, [allRequests, statusFilter, branchFilter, searchQuery])

  if (!canAccessMyAdvances(profile)) {
    return <Navigate to="/operations/attendance" replace />
  }

  const inner = loading ? (
    <p className="text-sm text-muted-foreground">Loading…</p>
  ) : (
    <div className="flex flex-col gap-5">
      {/* Personal Balance Summary Card */}
      <div
        className={`rounded-2xl border p-5 ${
          balance && balance.remainingMinor > 0
            ? 'border-amber-500/35 bg-amber-500/[0.06]'
            : 'border-border bg-card'
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {balance && balance.remainingMinor > 0 ? 'Outstanding Cash Advance Debt' : 'Cash Advance Balance'}
          </p>
          <Badge variant={balance && balance.remainingMinor > 0 ? 'destructive' : 'outline'}>
            {balance && balance.remainingMinor > 0 ? 'Active Debt' : 'Paid Up / No Debt'}
          </Badge>
        </div>
        <p className="mt-2 text-3xl font-extrabold tabular-nums text-foreground">
          {balance && balance.givenMinor > 0 ? formatAccounting(balance.remainingMinor) : formatAccounting(0)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {balance && balance.remainingMinor > 0
            ? 'Total unpaid cash advance debt recorded on the Daily Sheet.'
            : balance
              ? cashAdvanceBalanceLabel(balance)
              : 'No cash advance has been given yet.'}
        </p>
        {balance && balance.givenMinor > 0 ? (
          <div className="mt-3 flex flex-wrap gap-4 border-t border-border/80 pt-3 text-xs text-muted-foreground">
            <span>
              Total borrowed: <strong className="tabular-nums text-foreground">{formatAccounting(balance.givenMinor)}</strong>
            </span>
            <span>
              Total paid back: <strong className="tabular-nums text-emerald-600 dark:text-emerald-400">{formatAccounting(balance.repaidMinor)}</strong>
            </span>
            <span>
              Remaining debt: <strong className="tabular-nums text-foreground">{formatAccounting(balance.remainingMinor)}</strong>
            </span>
          </div>
        ) : null}
      </div>

      {/* Owner / ASA All-Staff Cash Advance Approvals & Active Debt Table */}
      {canApprove ? (
        <section className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Team Cash Advance Requests &amp; Active Balances</h2>
              <p className="text-xs text-muted-foreground">
                Approve pending requests to mint a 6-character <code className="font-mono">CAxxxx</code> code for the Branch Admin Daily Sheet, or review unpaid staff balances.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="min-h-10 gap-1.5" onClick={load}>
                <RefreshCw className="size-3.5" aria-hidden />
                Refresh
              </Button>
              <Button type="button" variant="outline" size="sm" className="min-h-10" asChild>
                <Link to="/operations/finance?tab=sheets">Open Daily Sheets</Link>
              </Button>
            </div>
          </div>

          {/* Active Staff Debt Summary Pills */}
          {allBalances.filter((b) => b.remainingMinor > 0).length > 0 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-2">
                Active Staff Cash Advance Debt ({allBalances.filter((b) => b.remainingMinor > 0).length} staff)
              </p>
              <div className="flex flex-wrap gap-2">
                {allBalances
                  .filter((b) => b.remainingMinor > 0)
                  .map((b) => (
                    <Badge key={b.staffId} variant="outline" className="py-1 px-2.5 text-xs bg-background">
                      {b.staffName}: <strong className="ml-1 tabular-nums text-amber-700 dark:text-amber-300">{formatAccounting(b.remainingMinor)}</strong>
                      <span className="ml-1 text-muted-foreground">
                        (borrowed {formatAccounting(b.givenMinor)} · repaid {formatAccounting(b.repaidMinor)})
                      </span>
                    </Badge>
                  ))}
              </div>
            </div>
          ) : null}

          {/* Filters */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2 border-t border-border">
            <div className="relative">
              <Search className="size-4 absolute left-3 top-3.5 text-muted-foreground" aria-hidden />
              <Input
                placeholder="Search employee, reason, or CAxxxx code…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-h-11 pl-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
              aria-label="Filter by request status"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending approval</option>
              <option value="approved">Approved (CAxxxx minted)</option>
              <option value="declined">Declined</option>
            </select>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
              aria-label="Filter by branch"
            >
              <option value="all">All branches</option>
              <option value="bacoor">Bacoor</option>
              <option value="batangas">Batangas</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Code / Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((r) => {
                  const p = r.payload || {}
                  const meta = cashAdvanceStatusMeta(r)
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString('en-PH') : '—'}
                      </TableCell>
                      <TableCell className="font-semibold whitespace-nowrap">
                        {p.employee_name || r.respondent_label || 'Staff'}
                      </TableCell>
                      <TableCell className="uppercase text-xs text-muted-foreground whitespace-nowrap">
                        {p.branch || '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-bold whitespace-nowrap">
                        {formatCashAdvancePesos(p)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {p.reason || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                          {p.approval_code ? (
                            <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-bold">
                              {p.approval_code}
                            </code>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1.5">
                          {r.status === 'new' ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                className="min-h-9 gap-1"
                                disabled={busyId === r.id}
                                onClick={() => handleDecision(r.id, 'approve')}
                              >
                                <Check className="size-3.5" aria-hidden />
                                Approve
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="min-h-9 gap-1"
                                disabled={busyId === r.id}
                                onClick={() => handleDecision(r.id, 'decline')}
                              >
                                <X className="size-3.5" aria-hidden />
                                Decline
                              </Button>
                            </>
                          ) : null}
                          {isOwner ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="min-h-9 text-destructive hover:text-destructive"
                              disabled={busyId === r.id}
                              onClick={() => handleDeleteSubmission(r.id)}
                              aria-label="Delete cash advance request"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!filteredRequests.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      No cash advance requests match the selected filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      {/* Request Form */}
      <form onSubmit={ask} className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[10rem_1fr_auto]">
        <div className="flex flex-col gap-1">
          <Label htmlFor="ca-amount">Amount (₱)</Label>
          <Input
            id="ca-amount"
            inputMode="decimal"
            placeholder="500"
            className="min-h-11"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ca-reason">What is it for?</Label>
          <div className="flex gap-2">
            {!profile?.branch_slug ? (
              <select
                value={branchChoice}
                onChange={(e) => setBranchChoice(e.target.value)}
                className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
                aria-label="Branch for cash advance"
              >
                <option value="bacoor">Bacoor</option>
                <option value="batangas">Batangas</option>
              </select>
            ) : null}
            <Input
              id="ca-reason"
              placeholder="e.g. medicine, school fee"
              className="min-h-11 flex-1"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-end">
          <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={asking}>
            {asking ? 'Sending…' : 'Ask for this amount'}
          </Button>
        </div>
      </form>

      {!rows.length ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No requests from this account yet</p>
          <p className="mt-1">Need cash ahead of payday? Enter the amount and reason above.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => {
            const p = r.payload || {}
            const meta = cashAdvanceStatusMeta(r)
            const date = r.created_at ? new Date(r.created_at).toLocaleDateString('en-PH') : ''
            return (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-lg font-semibold tabular-nums">{formatCashAdvancePesos(p)}</p>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>
                {p.approval_code ? (
                  <p className="mt-2 text-sm">
                    Give this code to the Branch Admin:{' '}
                    <code className="rounded bg-muted px-2 py-0.5 font-mono font-semibold">{p.approval_code}</code>
                  </p>
                ) : null}
                {p.reason ? <p className="mt-1 text-sm">{p.reason}</p> : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  {[date, p.needed_by ? `Needed by ${p.needed_by}` : '', p.branch ? String(p.branch) : '']
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )

  if (embedded) return inner

  return (
    <OpsPageShell
      eyebrow="Pay"
      title="My advances"
      description="Ask for an amount here. After it is approved, the branch records the cash on the Daily Sheet. This page shows what you still owe."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {canEditFinanceBooks(profile) ? (
            <Button type="button" variant="outline" className="min-h-11 gap-2" asChild>
              <Link to="/operations/finance?tab=salaries">
                Monthly Salaries (Finance)
              </Link>
            </Button>
          ) : null}
          {canAccessMyPayslips(profile) ? (
            <Button type="button" variant="outline" className="min-h-11 gap-2" asChild>
              <Link to="/operations/payslips">
                <Wallet className="size-4" aria-hidden />
                Payslips
              </Link>
            </Button>
          ) : null}
        </div>
      }
    >
      {inner}
    </OpsPageShell>
  )
}
