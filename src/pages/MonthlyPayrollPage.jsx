/**
 * Monthly salaries (office / BA etc.): ASA/SA posts paid expenses to account 14 with cash or GCash.
 * Day crew pay stays on the Daily Sheet — this page is not a floor-payroll wizard.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canEditFinanceBooks, getBranchScopeList } from '@/auth/permissions'
import { listStaffPeople } from '@/lib/adminApi'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { formatAccounting } from '@/lib/dailySheet'
import { isDayCrewRole, payHalfChoices, payslipTakeHome } from '@/lib/payslip'
import { parsePesosToMinor } from '@/lib/shiftClose'
import { supabase } from '@/lib/supabase'
import { fetchBranches } from '@/queue/queueApi'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NamedSelect } from '@/components/ui/named-select'

export default function MonthlyPayrollPage() {
  const { profile } = useAuth()
  const canWrite = canEditFinanceBooks(profile)
  const scope = getBranchScopeList(profile)
  const [branches, setBranches] = useState([])
  const [people, setPeople] = useState([])
  const [salaryAccountId, setSalaryAccountId] = useState('')
  const [branch, setBranch] = useState('')
  const [staffId, setStaffId] = useState('')
  const [amountText, setAmountText] = useState('')
  const [incentiveText, setIncentiveText] = useState('')
  const [periodKey, setPeriodKey] = useState('')
  const [paidFrom, setPaidFrom] = useState('cash')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [recent, setRecent] = useState([])

  const load = useCallback(async () => {
    const [br, staff, cat, rows] = await Promise.all([
      fetchBranches(),
      listStaffPeople({ includeInactive: false }),
      supabase.from('expense_categories').select('id, code, name').eq('code', '14').maybeSingle(),
      supabase
        .from('expenses')
        .select('id, title, total_minor, branch, paid_from, created_at, status')
        .eq('expense_kind', 'salary_monthly')
        .order('created_at', { ascending: false })
        .limit(12),
    ])
    const scoped = (br || []).filter((b) => scope === null || (Array.isArray(scope) && scope.includes(b.slug)))
    setBranches(scoped)
    setBranch((cur) => cur || scoped[0]?.slug || '')
    setPeople(staff || [])
    if (cat.data?.id) setSalaryAccountId(cat.data.id)
    if (cat.error) toast.error(cat.error.message)
    if (rows.error) toast.error(rows.error.message)
    else setRecent(rows.data || [])
  }, [scope])

  useEffect(() => {
    load().catch((e) => toast.error(e.message))
  }, [load])

  const halves = useMemo(() => payHalfChoices(getLocalCalendarDate()), [])
  const period = halves.find((row) => row.start === periodKey) || halves[0] || null
  const inBranch = (p) => !branch || !p.branch_slug || p.branch_slug === branch || (p.branch_slugs || []).includes(branch)
  const staffOptions = useMemo(
    () =>
      (people || [])
        .filter((p) => inBranch(p) && !isDayCrewRole(p.role))
        .map((p) => ({ value: p.id, label: `${p.full_name}${p.role ? ` · ${String(p.role).replace(/_/g, ' ')}` : ''}` })),
    [people, branch],
  )
  const crewNames = useMemo(
    () => (people || []).filter((p) => inBranch(p) && isDayCrewRole(p.role)).map((p) => p.full_name),
    [people, branch],
  )

  if (!canWrite) return <Navigate to="/operations/access-denied" replace />

  async function submit(e) {
    e.preventDefault()
    if (!salaryAccountId) return toast.error('Salary account (code 14) is missing.')
    if (!branch) return toast.error('Pick a branch.')
    if (!staffId) return toast.error('Pick who is paid.')
    const minor = parsePesosToMinor(amountText)
    if (minor == null || minor <= 0) return toast.error('Enter a peso amount.')
    const incentive = incentiveText.trim() ? parsePesosToMinor(incentiveText) : 0
    if (incentive == null || incentive < 0) return toast.error('Incentive must be zero or more.')
    if (!period) return toast.error('Pick the half month.')
    const person = people.find((p) => p.id === staffId)
    if (isDayCrewRole(person?.role)) return toast.error('Crew are paid on the Daily Sheet.')
    const takeHome = payslipTakeHome(minor, incentive)
    setBusy(true)
    try {
      const { error: slipError } = await supabase.rpc('send_payslip', {
        p_staff: staffId,
        p_branch: branch,
        p_start: period.start,
        p_end: period.end,
        p_salary: minor,
        p_incentive: incentive,
        p_paid_from: paidFrom === 'gcash' ? 'gcash' : 'cash',
        p_note: note.trim() || null,
      })
      if (slipError && !/payslips_one_half|duplicate key/i.test(slipError.message || '')) throw slipError
      const title = `Monthly salary · ${person?.full_name || 'staff'}`
      const { error } = await supabase.from('expenses').insert({
        title,
        description: [note.trim(), incentive > 0 ? `incentive:${incentive}` : '', `period:${period.start}`].filter(Boolean).join(' · ') || `monthly:${period.start}:${staffId}`,
        quantity: 1,
        unit_cost_minor: takeHome,
        total_minor: takeHome,
        branch,
        category_id: salaryAccountId,
        status: 'paid',
        expense_kind: 'salary_monthly',
        paid_from: paidFrom === 'gcash' ? 'gcash' : 'cash',
        created_by: profile.id,
        approved_by: profile.id,
        paid_by: profile.id,
      })
      if (error) throw error
      toast.success(`Sent ${formatAccounting(takeHome)} for ${period.label}. No tax.`)
      setAmountText('')
      setIncentiveText('')
      setNote('')
      await load()
    } catch (err) {
      toast.error(err.message || 'Could not post monthly salary')
    } finally {
      setBusy(false)
    }
  }

  return (
    <OpsPageShell
      className="hakum-monthly-payroll"
      eyebrow="Finance"
      title="Monthly salaries"
      description="Office and admin pay, one half of a month at a time. Salary plus an optional incentive. No tax. The slip is sent to the employee to receive and sign. Day crew stay on the Daily Sheet."
      actions={
        <Button type="button" variant="outline" className="min-h-11" asChild>
          <Link to="/operations/payslips">Payslips</Link>
        </Button>
      }
    >
      <form onSubmit={submit} className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mp-branch">Branch</Label>
            <NamedSelect
              id="mp-branch"
              className="min-h-11"
              value={branch}
              onChange={setBranch}
              options={branches.map((b) => ({ value: b.slug, label: b.name }))}
              placeholder="Branch"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mp-paid">Paid with</Label>
            <NamedSelect
              id="mp-paid"
              className="min-h-11"
              value={paidFrom}
              onChange={setPaidFrom}
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'gcash', label: 'GCash' },
              ]}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mp-staff">Monthly employee</Label>
          <NamedSelect id="mp-staff" className="min-h-11" value={staffId} onChange={setStaffId} options={staffOptions} placeholder="Who is paid" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mp-period">Half month</Label>
          <NamedSelect
            id="mp-period"
            className="min-h-11"
            value={period?.start || ''}
            onChange={setPeriodKey}
            options={halves.map((row) => ({ value: row.start, label: row.label }))}
            placeholder="Half month"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mp-amount">Salary (₱)</Label>
            <Input id="mp-amount" className="min-h-11 text-right tabular-nums" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mp-incentive">Incentive (₱, optional)</Label>
            <Input id="mp-incentive" className="min-h-11 text-right tabular-nums" inputMode="decimal" value={incentiveText} onChange={(e) => setIncentiveText(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mp-note">Note (optional)</Label>
          <Input id="mp-note" className="min-h-11" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. October admin salary" />
        </div>
        <Button type="submit" className="min-h-11" disabled={busy}>
          {busy ? 'Sending…' : 'Send payslip and post'}
        </Button>
      </form>
      {crewNames.length ? (
        <p className="mx-auto mt-3 w-full max-w-xl text-sm text-muted-foreground">
          Day crew on the Daily Sheet: {crewNames.join(', ')}
        </p>
      ) : null}

      {recent.length ? (
        <section className="mx-auto mt-6 w-full max-w-xl" aria-label="Recent monthly salaries">
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Recent posts</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {recent.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{row.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {row.branch} · {row.paid_from === 'gcash' ? 'GCash' : 'Cash'} · {row.status}
                  </span>
                </span>
                <span className="tabular-nums font-medium">{formatAccounting(row.total_minor)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </OpsPageShell>
  )
}
