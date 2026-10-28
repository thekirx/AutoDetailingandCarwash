/**
 * Office payroll. One half-month at a time. Day crew stay on the Daily Sheet.
 * A locked period refuses new slips. Super Admin can unlock it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Lock, LockOpen } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canEditFinanceBooks, getBranchScopeList, isSuperAdmin } from '@/auth/permissions'
import { listStaffPeople } from '@/lib/adminApi'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { formatAccounting } from '@/lib/dailySheet'
import { isDayCrewRole, officePayrollPeople, payPeriodList, payslipStatusLabel, payslipTakeHome } from '@/lib/payslip'
import { parsePesosToMinor } from '@/lib/shiftClose'
import { supabase } from '@/lib/supabase'
import { fetchBranches } from '@/queue/queueApi'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsTabList from '@/components/ops/OpsTabBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NamedSelect } from '@/components/ui/named-select'
import { Tabs } from '@/components/ui/tabs'

function roleLabel(role) {
  if (role === 'assistant_super_admin') return 'General Admin'
  if (role === 'BossMich') return 'Owner'
  if (role === 'admin') return 'Branch Admin'
  if (role === 'operations_lead') return 'Operations Lead'
  return String(role || 'Office').replace(/_/g, ' ')
}

function pesos(minor) {
  if (minor == null) return ''
  return (Number(minor) / 100).toFixed(2)
}

export default function MonthlyPayrollPage() {
  const { profile } = useAuth()
  const canWrite = canEditFinanceBooks(profile)
  const owner = isSuperAdmin(profile)
  const scope = getBranchScopeList(profile)
  const [searchParams, setSearchParams] = useSearchParams()
  const [branches, setBranches] = useState([])
  const [people, setPeople] = useState([])
  const [branch, setBranch] = useState('')
  const [drafts, setDrafts] = useState({})
  const [slips, setSlips] = useState([])
  const [locked, setLocked] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [locking, setLocking] = useState(false)
  const [formError, setFormError] = useState('')

  const periods = useMemo(() => payPeriodList(getLocalCalendarDate(), 4), [])
  const periodKey = searchParams.get('period') || periods[0]?.start || ''
  const period = periods.find((row) => row.start === periodKey) || periods[0] || null

  const loadPeople = useCallback(async () => {
    const [br, staff] = await Promise.all([
      fetchBranches(),
      listStaffPeople({ includeInactive: false }),
    ])
    const scoped = (br || []).filter((b) => scope === null || (Array.isArray(scope) && scope.includes(b.slug)))
    setBranches(scoped)
    setBranch((cur) => cur || scoped[0]?.slug || '')
    setPeople(staff || [])
  }, [scope])

  const loadPeriod = useCallback(async () => {
    if (!branch || !period) return
    const [slipRes, lockRes] = await Promise.all([
      supabase
        .from('payslips')
        .select('id, staff_id, salary_minor, incentive_minor, paid_from, note, status')
        .eq('branch', branch)
        .eq('period_start', period.start)
        .eq('period_end', period.end),
      supabase
        .from('payroll_period_locks')
        .select('id')
        .eq('branch', branch)
        .eq('period_start', period.start)
        .eq('period_end', period.end)
        .maybeSingle(),
    ])
    if (slipRes.error) toast.error(slipRes.error.message)
    else setSlips(slipRes.data || [])
    if (lockRes.error) toast.error(lockRes.error.message)
    else setLocked(Boolean(lockRes.data?.id))
  }, [branch, period])

  useEffect(() => {
    loadPeople().catch((e) => toast.error(e.message))
  }, [loadPeople])

  useEffect(() => {
    loadPeriod().catch((e) => toast.error(e.message))
  }, [loadPeriod])

  const inBranch = (person) => !branch || !person.branch_slug || person.branch_slug === branch || (person.branch_slugs || []).includes(branch)
  const office = useMemo(
    () => officePayrollPeople(people).filter(inBranch),
    [people, branch],
  )
  const crewCount = useMemo(
    () => (people || []).filter((person) => inBranch(person) && isDayCrewRole(person.role)).length,
    [people, branch],
  )
  const slipByStaff = useMemo(() => {
    const map = new Map()
    for (const row of slips) map.set(row.staff_id, row)
    return map
  }, [slips])

  function selectPeriod(start) {
    const next = new URLSearchParams(searchParams)
    if (!start || start === periods[0]?.start) next.delete('period')
    else next.set('period', start)
    setSearchParams(next, { replace: true })
    setFormError('')
  }

  function draftFor(person) {
    return drafts[person.id] || { salary: '', incentive: '', paidFrom: 'cash', note: '' }
  }

  function patchDraft(id, patch) {
    setDrafts((cur) => ({ ...cur, [id]: { ...draftFor({ id }), ...cur[id], ...patch } }))
  }

  if (!canWrite) return <Navigate to="/operations/access-denied" replace />

  async function sendOne(person) {
    setFormError('')
    if (locked) {
      setFormError('This period is locked. Super Admin can unlock it.')
      return
    }
    if (!branch || !period) {
      setFormError('Pick a branch and a payroll period.')
      return
    }
    if (isDayCrewRole(person.role)) {
      setFormError('Crew are paid on the Daily Sheet.')
      return
    }
    const existing = slipByStaff.get(person.id)
    const draft = draftFor(person)
    const salaryText = draft.salary || (existing ? pesos(existing.salary_minor) : '')
    const incentiveText = draft.incentive !== undefined && draft.incentive !== ''
      ? draft.incentive
      : (existing ? pesos(existing.incentive_minor) : '')
    const minor = parsePesosToMinor(salaryText)
    if (minor == null || minor <= 0) {
      setFormError(`Enter a salary for ${person.full_name}.`)
      return
    }
    const incentive = String(incentiveText).trim() ? parsePesosToMinor(incentiveText) : 0
    if (incentive == null || incentive < 0) {
      setFormError(`Incentive for ${person.full_name} must be zero or more.`)
      return
    }
    const takeHome = payslipTakeHome(minor, incentive)
    const paidFrom = (draft.paidFrom || existing?.paid_from) === 'gcash' ? 'gcash' : 'cash'
    const note = (draft.note || existing?.note || '').trim()
    setBusyId(person.id)
    try {
      const { error } = existing?.status === 'sent'
        ? await supabase.rpc('update_office_payslip', {
            p_id: existing.id,
            p_salary: minor,
            p_incentive: incentive,
            p_paid_from: paidFrom,
            p_note: note || null,
          })
        : await supabase.rpc('send_payslip', {
            p_staff: person.id,
            p_branch: branch,
            p_start: period.start,
            p_end: period.end,
            p_salary: minor,
            p_incentive: incentive,
            p_paid_from: paidFrom,
            p_note: note || null,
          })
      if (error) throw error
      toast.success(`${existing ? 'Saved' : 'Sent'} ${formatAccounting(takeHome)} for ${person.full_name}. Finance has the same amount.`)
      await loadPeriod()
    } catch (err) {
      const message = err.message || 'Could not send the payslip'
      setFormError(message)
      toast.error(message)
    } finally {
      setBusyId('')
    }
  }

  async function toggleLock() {
    if (!period || !branch) return
    const next = !locked
    const verb = next ? 'Lock' : 'Unlock'
    if (!window.confirm(`${verb} ${period.label} for this branch?`)) return
    setLocking(true)
    setFormError('')
    try {
      const { error } = await supabase.rpc('set_payroll_period_lock', {
        p_branch: branch,
        p_start: period.start,
        p_end: period.end,
        p_lock: next,
      })
      if (error) throw error
      toast.success(next ? 'Period locked.' : 'Period unlocked.')
      await loadPeriod()
    } catch (err) {
      setFormError(err.message || 'Could not change the lock')
      toast.error(err.message || 'Could not change the lock')
    } finally {
      setLocking(false)
    }
  }

  const tabs = periods.map((row, index) => ({
    id: row.start,
    label: index === 0 ? 'This period' : row.label,
  }))

  return (
    <OpsPageShell
      className="hakum-monthly-payroll"
      eyebrow="Finance"
      title="Payroll"
      description="Office and admin pay, 14 days at a time. Lucy or Super Admin types the salary and incentive by hand, in cash or GCash. No tax. The same amount posts to Finance. Crew stay on the Daily Sheet."
      actions={
        <Button type="button" variant="outline" className="min-h-11" asChild>
          <Link to="/operations/payslips">My payslips</Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex w-full max-w-xs flex-col gap-1.5">
            <Label htmlFor="mp-branch">Branch</Label>
            <NamedSelect
              id="mp-branch"
              name="branch"
              className="min-h-11"
              value={branch}
              onChange={setBranch}
              options={branches.map((b) => ({ value: b.slug, label: b.name }))}
              placeholder="Branch"
            />
          </div>
          {crewCount ? (
            <p className="text-sm text-muted-foreground">
              {crewCount === 1 ? '1 crew member stays on the Daily Sheet.' : `${crewCount} crew stay on the Daily Sheet.`}
            </p>
          ) : null}
        </div>

        <Tabs value={period?.start || ''} onValueChange={selectPeriod}>
          <OpsTabList aria-label="Payroll periods" tabs={tabs} />
        </Tabs>

        <section className="rounded-2xl border border-border bg-card" aria-labelledby="mp-period-heading">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 id="mp-period-heading" className="text-lg font-semibold text-pretty">
                {period ? period.label : 'Payroll period'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {locked
                  ? 'Locked. New payslips wait until Super Admin unlocks this period.'
                  : 'Open. Type salary and incentive, pick cash or GCash, then send. A sent slip can still be changed until the employee receives it. Finance gets the same amount.'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 shrink-0"
              disabled={locking || !branch || (locked && !owner)}
              onClick={toggleLock}
            >
              {locked ? <Lock aria-hidden /> : <LockOpen aria-hidden />}
              {locking ? 'Saving…' : locked ? (owner ? 'Unlock period' : 'Locked') : 'Lock period'}
            </Button>
          </div>

          {formError ? (
            <p className="mx-4 mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm" role="alert">
              {formError}
            </p>
          ) : null}

          {office.length ? (
            <ul className="divide-y divide-border">
              {office.map((person) => {
                const slip = slipByStaff.get(person.id)
                const draft = draftFor(person)
                const salaryMinor = slip ? slip.salary_minor : parsePesosToMinor(draft.salary)
                const incentiveMinor = slip ? slip.incentive_minor : (draft.incentive.trim() ? parsePesosToMinor(draft.incentive) : 0)
                const takeHome = salaryMinor != null && incentiveMinor != null ? payslipTakeHome(salaryMinor, incentiveMinor) : null
                const frozen = locked || (slip && slip.status !== 'sent')
                return (
                  <li key={person.id} className="flex flex-col gap-3 p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{person.full_name}</p>
                        <p className="text-xs text-muted-foreground">{roleLabel(person.role)}</p>
                      </div>
                      <p className="shrink-0 text-right text-sm">
                        <span className="block text-xs text-muted-foreground">Take-home</span>
                        <span className="tabular-nums font-semibold">{takeHome == null ? '—' : formatAccounting(takeHome)}</span>
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`mp-salary-${person.id}`}>Salary (₱)</Label>
                        <Input
                          id={`mp-salary-${person.id}`}
                          name={`salary-${person.id}`}
                          className="min-h-11 text-right tabular-nums"
                          inputMode="decimal"
                          autoComplete="off"
                          disabled={frozen}
                          value={frozen && slip ? pesos(slip.salary_minor) : (draft.salary || (slip ? pesos(slip.salary_minor) : ''))}
                          onChange={(e) => patchDraft(person.id, { salary: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`mp-incentive-${person.id}`}>Incentive (₱)</Label>
                        <Input
                          id={`mp-incentive-${person.id}`}
                          name={`incentive-${person.id}`}
                          className="min-h-11 text-right tabular-nums"
                          inputMode="decimal"
                          autoComplete="off"
                          disabled={frozen}
                          value={frozen && slip ? pesos(slip.incentive_minor) : (draft.incentive || (slip ? pesos(slip.incentive_minor) : ''))}
                          onChange={(e) => patchDraft(person.id, { incentive: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`mp-paid-${person.id}`}>Paid with</Label>
                        <NamedSelect
                          id={`mp-paid-${person.id}`}
                          name={`paid-${person.id}`}
                          className="min-h-11"
                          disabled={frozen}
                          value={frozen && slip ? slip.paid_from : (draft.paidFrom || slip?.paid_from || 'cash')}
                          onChange={(value) => patchDraft(person.id, { paidFrom: value })}
                          options={[
                            { value: 'cash', label: 'Cash' },
                            { value: 'gcash', label: 'GCash' },
                          ]}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`mp-note-${person.id}`}>Note</Label>
                        <Input
                          id={`mp-note-${person.id}`}
                          name={`note-${person.id}`}
                          className="min-h-11"
                          autoComplete="off"
                          disabled={frozen}
                          value={frozen && slip ? (slip.note || '') : (draft.note || slip?.note || '')}
                          onChange={(e) => patchDraft(person.id, { note: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      {slip ? (
                        <p className="text-sm text-muted-foreground">
                          {payslipStatusLabel(slip.status)}
                          {slip.paid_from === 'gcash' ? ' · GCash' : ' · Cash'}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">{locked ? 'Not sent. Period is locked.' : 'Not sent yet.'}</p>
                      )}
                      <Button
                        type="button"
                        className="min-h-11 sm:w-auto"
                        disabled={frozen || busyId === person.id}
                        onClick={() => sendOne(person)}
                      >
                        {busyId === person.id ? 'Saving…' : slip?.status === 'sent' && !locked ? 'Save changes' : slip ? payslipStatusLabel(slip.status) : 'Send payslip'}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">No office or admin staff at this branch. Crew are paid on the Daily Sheet.</p>
          )}
        </section>
      </div>
    </OpsPageShell>
  )
}
