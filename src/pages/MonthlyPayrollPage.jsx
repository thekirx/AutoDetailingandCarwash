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

  const staffOptions = useMemo(
    () =>
      (people || [])
        .filter((p) => !branch || !p.branch_slug || p.branch_slug === branch || (p.branch_slugs || []).includes(branch))
        .map((p) => ({ value: p.id, label: `${p.full_name}${p.role ? ` · ${String(p.role).replace(/_/g, ' ')}` : ''}` })),
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
    const person = people.find((p) => p.id === staffId)
    setBusy(true)
    try {
      const title = `Monthly salary · ${person?.full_name || 'staff'}`
      const { error } = await supabase.from('expenses').insert({
        title,
        description: note.trim() || `monthly:${getLocalCalendarDate()}:${staffId}`,
        quantity: 1,
        unit_cost_minor: minor,
        total_minor: minor,
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
      toast.success(`Posted ${formatAccounting(minor)} via ${paidFrom === 'gcash' ? 'GCash' : 'cash'}`)
      setAmountText('')
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
      description="Post office and admin monthly pay to account 14 as a paid Finance expense. Choose cash or GCash. Day crew pay stays on the Daily Sheet."
      actions={
        <Button type="button" variant="outline" className="min-h-11" asChild>
          <Link to="/operations/finance?tab=purchases">Open bills</Link>
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
          <Label htmlFor="mp-staff">Employee</Label>
          <NamedSelect id="mp-staff" className="min-h-11" value={staffId} onChange={setStaffId} options={staffOptions} placeholder="Who is paid" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mp-amount">Amount (₱)</Label>
          <Input id="mp-amount" className="min-h-11 text-right tabular-nums" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mp-note">Note (optional)</Label>
          <Input id="mp-note" className="min-h-11" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. October admin salary" />
        </div>
        <Button type="submit" className="min-h-11" disabled={busy}>
          {busy ? 'Posting…' : 'Post to Finance'}
        </Button>
      </form>

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
