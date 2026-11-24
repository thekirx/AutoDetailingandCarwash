import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Banknote, CheckCircle2, FileSpreadsheet, Plus, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessMyPayslips, canEditFinanceBooks, isSuperAdmin } from '@/auth/permissions'
import { formatAccounting } from '@/lib/dailySheet'
import { callFinanceOwnerOps } from '@/lib/financeOwnerClient'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { payHalf, payslipStatusLabel, payslipTakeHome, rangeLabel } from '@/lib/payslip'
import { supabase } from '@/lib/supabase'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const MonthlyPayrollPage = lazy(() => import('@/pages/MonthlyPayrollPage'))
const MyCashAdvancesPage = lazy(() => import('@/pages/MyCashAdvancesPage'))

export default function MyPayslipsPage() {
  const { profile } = useAuth()
  const isOwner = isSuperAdmin(profile)
  const canManagePayroll = canEditFinanceBooks(profile)
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'my-slips'

  const [rows, setRows] = useState([])
  const [names, setNames] = useState({})
  const [busyId, setBusyId] = useState('')
  const [issuingOwnerSlip, setIssuingOwnerSlip] = useState(false)
  const [ownerSalaryPesos, setOwnerSalaryPesos] = useState('')
  const [ownerIncentivePesos, setOwnerIncentivePesos] = useState('')
  const [ownerPaidFrom, setOwnerPaidFrom] = useState('cash')
  const [ownerNote, setOwnerNote] = useState('')

  const load = useCallback(async () => {
    if (!profile?.id) return
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

  function setTab(next) {
    const params = new URLSearchParams(searchParams)
    if (!next || next === 'my-slips') params.delete('tab')
    else params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

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

  async function handleIssueOwnSlip(event) {
    event.preventDefault()
    const salPesos = Number(String(ownerSalaryPesos).replace(/,/g, ''))
    const incPesos = Number(String(ownerIncentivePesos || '0').replace(/,/g, ''))
    if (!Number.isFinite(salPesos) || salPesos <= 0) {
      return toast.error('Enter a valid cutoff salary amount.')
    }
    const curHalf = payHalf(getLocalCalendarDate())
    setIssuingOwnerSlip(true)
    try {
      await callFinanceOwnerOps({
        action: 'upsert-payslip',
        staff_id: profile.id,
        branch: profile.branch_slug || 'bacoor',
        period_start: curHalf.start,
        period_end: curHalf.end,
        salary_minor: Math.round(salPesos * 100),
        incentive_minor: Math.max(0, Math.round((Number.isFinite(incPesos) ? incPesos : 0) * 100)),
        paid_from: ownerPaidFrom,
        note: ownerNote.trim() || 'Owner semi-monthly draw / payslip',
      })
      toast.success('Owner payslip issued and synced to Finance books.')
      setOwnerSalaryPesos('')
      setOwnerIncentivePesos('')
      setOwnerNote('')
      await load()
    } catch (err) {
      toast.error(err.message || 'Could not issue owner payslip')
    } finally {
      setIssuingOwnerSlip(false)
    }
  }

  return (
    <OpsPageShell
      className="hakum-my-payslips"
      eyebrow="Finance"
      title="Payslips"
      description="Each slip covers a half month (1st–15th or 16th–end of month). Salary plus any incentive Lucy or Super Admin typed. No tax. Mark it received, then sign with your name."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {canManagePayroll ? (
            <Button
              type="button"
              variant={activeTab === 'payroll' ? 'default' : 'outline'}
              className="min-h-11 gap-2"
              onClick={() => setTab(activeTab === 'payroll' ? 'my-slips' : 'payroll')}
            >
              <FileSpreadsheet className="size-4" aria-hidden />
              {activeTab === 'payroll' ? 'My Payslips' : 'Manage Payroll & History'}
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="min-h-11 gap-2" asChild>
            <Link to="/operations/my-advances">
              <Wallet className="size-4" aria-hidden />
              My advances
            </Link>
          </Button>
        </div>
      }
    >
      {canManagePayroll ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <Tabs value={activeTab} onValueChange={setTab} className="w-full sm:w-auto">
            <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-flex">
              <TabsTrigger value="my-slips" className="gap-2">
                <Banknote className="size-4" aria-hidden />
                My Payslips ({rows.length})
              </TabsTrigger>
              <TabsTrigger value="payroll" className="gap-2">
                <FileSpreadsheet className="size-4" aria-hidden />
                Payroll Wizard &amp; History
              </TabsTrigger>
              <TabsTrigger value="advances" className="gap-2">
                <Wallet className="size-4" aria-hidden />
                Cash Advances Hub
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      ) : null}

      {canManagePayroll && activeTab === 'payroll' ? (
        <Suspense fallback={<p className="py-6 text-sm text-muted-foreground">Loading payroll wizard &amp; history…</p>}>
          <MonthlyPayrollPage embedded />
        </Suspense>
      ) : canManagePayroll && activeTab === 'advances' ? (
        <Suspense fallback={<p className="py-6 text-sm text-muted-foreground">Loading cash advances hub…</p>}>
          <MyCashAdvancesPage embedded />
        </Suspense>
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          {isOwner ? (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground">Issue Owner Payslip ({payHalf(getLocalCalendarDate())?.label})</h2>
                  <p className="text-xs text-muted-foreground">
                    Record your semi-monthly owner salary or draw here. It immediately posts to Finance Books (Account 14) and appears below for receipt &amp; signature.
                  </p>
                </div>
                <Badge variant="outline" className="self-start sm:self-center">Owner Direct Sync</Badge>
              </div>
              <form onSubmit={handleIssueOwnSlip} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="owner-slip-salary" className="text-xs font-semibold">Cutoff Salary (₱)</Label>
                  <Input
                    id="owner-slip-salary"
                    inputMode="decimal"
                    placeholder="15000.00"
                    className="min-h-11 text-right tabular-nums"
                    value={ownerSalaryPesos}
                    onChange={(e) => setOwnerSalaryPesos(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="owner-slip-inc" className="text-xs font-semibold">Incentive / Adj (₱)</Label>
                  <Input
                    id="owner-slip-inc"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="min-h-11 text-right tabular-nums"
                    value={ownerIncentivePesos}
                    onChange={(e) => setOwnerIncentivePesos(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="owner-slip-method" className="text-xs font-semibold">Paid With</Label>
                  <select
                    id="owner-slip-method"
                    value={ownerPaidFrom}
                    onChange={(e) => setOwnerPaidFrom(e.target.value)}
                    className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="cash">Cash</option>
                    <option value="gcash">GCash</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="owner-slip-note" className="text-xs font-semibold">Remarks</Label>
                  <div className="flex gap-2">
                    <Input
                      id="owner-slip-note"
                      placeholder="Optional note"
                      className="min-h-11"
                      value={ownerNote}
                      onChange={(e) => setOwnerNote(e.target.value)}
                    />
                    <Button type="submit" className="min-h-11 shrink-0 gap-1.5" disabled={issuingOwnerSlip}>
                      <Plus className="size-4" aria-hidden />
                      {issuingOwnerSlip ? 'Issuing…' : 'Issue'}
                    </Button>
                  </div>
                </div>
              </form>
            </section>
          ) : null}

          {rows.length ? (
            <ul className="flex w-full flex-col gap-3" aria-label="Your payslips">
              {rows.map((row) => {
                const takeHome = payslipTakeHome(row.salary_minor, row.incentive_minor)
                return (
                  <li key={row.id} className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-base text-foreground">
                            {rangeLabel(row.period_start, row.period_end)}
                          </p>
                          <Badge variant={row.status === 'signed' ? 'default' : row.status === 'received' ? 'secondary' : 'outline'}>
                            {payslipStatusLabel(row.status)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {row.period_start} – {row.period_end} · {row.branch}
                        </p>
                      </div>
                      <p className="shrink-0 text-right">
                        <span className="block text-xs text-muted-foreground uppercase tracking-wider font-semibold">Take-home</span>
                        <span className="tabular-nums font-bold text-lg text-primary">{formatAccounting(takeHome)}</span>
                      </p>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl bg-muted/30 p-3 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Salary</dt>
                        <dd className="tabular-nums font-medium">{formatAccounting(row.salary_minor)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Incentive</dt>
                        <dd className="tabular-nums font-medium">{formatAccounting(row.incentive_minor || 0)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Paid with</dt>
                        <dd className="font-medium">{row.paid_from === 'gcash' ? 'GCash' : 'Cash'}</dd>
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
                      <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="size-4" aria-hidden />
                        Signed as {row.signed_name}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No payslip yet. Office pay is sent here each half month.
              </p>
              {canManagePayroll ? (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => setTab('payroll')}>
                    Open Payroll Wizard &amp; History
                  </Button>
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => setTab('advances')}>
                    Open Cash Advances Hub
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </OpsPageShell>
  )
}
