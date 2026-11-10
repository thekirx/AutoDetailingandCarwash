/**
 * Office payroll: semi-monthly (1st–15th and 16th–end of month).
 * Day crew stay on the Daily Sheet.
 * Owner (BossMich), Lucy, Robert, and Super Admin can view, edit, adjust, process,
 * set base monthly salaries, view historical reports, and export CSV/Excel/PDF.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import {
  Calendar,
  DollarSign,
  Download,
  FileSpreadsheet,
  History,
  Lock,
  LockOpen,
  Pencil,
  Printer,
  RefreshCw,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canEditFinanceBooks, getBranchScopeList, isSuperAdmin, isAssistantSuperAdmin } from '@/auth/permissions'
import { listStaffPeople, setStaffMonthlySalary } from '@/lib/adminApi'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { formatAccounting } from '@/lib/dailySheet'
import { downloadCsv, downloadExcel, printAsPdf } from '@/lib/financeData'
import {
  isDayCrewRole,
  MONTHS,
  officePayrollPeople,
  payHalf,
  payPeriodList,
  payrollPaidFrom,
  payslipStatusLabel,
  payslipTakeHome,
  rangeLabel,
} from '@/lib/payslip'
import { parsePesosToMinor } from '@/lib/shiftClose'
import { supabase } from '@/lib/supabase'
import { fetchBranches } from '@/queue/queueApi'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsTabList from '@/components/ops/OpsTabBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NamedSelect } from '@/components/ui/named-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

function formatPesos(minor) {
  if (minor == null) return '—'
  return `₱${(Number(minor) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function MonthlyPayrollPage() {
  const { profile } = useAuth()
  const canWrite = canEditFinanceBooks(profile)
  const isManager = isSuperAdmin(profile) || isAssistantSuperAdmin(profile)
  const scope = getBranchScopeList(profile)
  const [searchParams, setSearchParams] = useSearchParams()

  const [viewMode, setViewMode] = useState('run') // 'run' | 'history'
  const [branches, setBranches] = useState([])
  const [people, setPeople] = useState([])
  const [branch, setBranch] = useState('')
  const [drafts, setDrafts] = useState({})
  const [slips, setSlips] = useState([])
  const [locked, setLocked] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [locking, setLocking] = useState(false)
  const [formError, setFormError] = useState('')

  // Base salary editing dialog
  const [editingBaseStaff, setEditingBaseStaff] = useState(null)
  const [baseSalaryInput, setBaseSalaryInput] = useState('')
  const [savingBase, setSavingBase] = useState(false)

  // History / Reports state
  const [historySlips, setHistorySlips] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyYear, setHistoryYear] = useState(() => String(new Date().getFullYear()))
  const [historyMonth, setHistoryMonth] = useState('all') // 'all' | '1'..'12'
  const [historyHalf, setHistoryHalf] = useState('all') // 'all' | '1' | '2'
  const [historyStatus, setHistoryStatus] = useState('all') // 'all' | 'sent' | 'received' | 'signed'
  const [historySearch, setHistorySearch] = useState('')

  // Jump to specific cutoff dialog / selector
  const [jumpYear, setJumpYear] = useState(() => String(new Date().getFullYear()))
  const [jumpMonth, setJumpMonth] = useState(() => String(new Date().getMonth() + 1))
  const [jumpHalf, setJumpHalf] = useState(() => (new Date().getDate() <= 15 ? '1' : '2'))

  const periods = useMemo(() => payPeriodList(getLocalCalendarDate(), 6), [])
  const periodKey = searchParams.get('period') || periods[0]?.start || ''
  const period = useMemo(() => {
    if (periodKey) {
      const parsed = payHalf(periodKey)
      if (parsed) return parsed
    }
    return periods[0] || null
  }, [periodKey, periods])

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
        .select('id, staff_id, branch, period_start, period_end, salary_minor, incentive_minor, paid_from, note, status, signed_name, signed_at, created_at')
        .eq('branch', branch)
        .eq('period_start', period.start)
        .eq('period_end', period.end),
      supabase
        .from('payroll_period_locks')
        .select('id, branch, period_start, period_end, locked_by, locked_at')
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

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      let q = supabase
        .from('payslips')
        .select('id, staff_id, branch, period_start, period_end, salary_minor, incentive_minor, paid_from, note, status, signed_name, signed_at, created_at')
        .order('period_start', { ascending: false })
        .order('created_at', { ascending: false })

      if (branch && branch !== 'all') {
        q = q.eq('branch', branch)
      } else if (Array.isArray(scope) && scope.length) {
        q = q.in('branch', scope)
      }

      if (historyYear && historyYear !== 'all') {
        q = q.gte('period_start', `${historyYear}-01-01`).lte('period_end', `${historyYear}-12-31`)
      }

      if (historyMonth && historyMonth !== 'all') {
        const mm = String(historyMonth).padStart(2, '0')
        q = q.gte('period_start', `${historyYear}-${mm}-01`).lte('period_start', `${historyYear}-${mm}-16`)
      }

      if (historyStatus && historyStatus !== 'all') {
        q = q.eq('status', historyStatus)
      }

      const { data, error } = await q
      if (error) throw error
      setHistorySlips(data || [])
    } catch (err) {
      toast.error(err.message || 'Could not load payroll history')
    } finally {
      setLoadingHistory(false)
    }
  }, [branch, scope, historyYear, historyMonth, historyStatus])

  useEffect(() => {
    loadPeople().catch((e) => toast.error(e.message))
  }, [loadPeople])

  useEffect(() => {
    loadPeriod().catch((e) => toast.error(e.message))
  }, [loadPeriod])

  useEffect(() => {
    if (viewMode === 'history') {
      loadHistory().catch((e) => toast.error(e.message))
    }
  }, [viewMode, loadHistory])

  const inBranch = useCallback(
    (person) =>
      !branch ||
      branch === 'all' ||
      !person.branch_slug ||
      person.branch_slug === branch ||
      (person.branch_slugs || []).includes(branch),
    [branch],
  )

  const office = useMemo(
    () => officePayrollPeople(people).filter(inBranch),
    [people, inBranch],
  )

  const staffMap = useMemo(() => {
    const map = new Map()
    for (const p of people) map.set(p.id, p)
    return map
  }, [people])

  const branchMap = useMemo(() => {
    const map = new Map()
    for (const b of branches) map.set(b.slug, b.name)
    return map
  }, [branches])

  const crewCount = useMemo(
    () => (people || []).filter((person) => inBranch(person) && isDayCrewRole(person.role)).length,
    [people, inBranch],
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

  function handleJumpPeriod() {
    const y = jumpYear
    const mm = String(jumpMonth).padStart(2, '0')
    const day = jumpHalf === '1' ? '01' : '16'
    const targetIso = `${y}-${mm}-${day}`
    selectPeriod(targetIso)
  }

  function draftFor(person) {
    if (drafts[person.id]) return drafts[person.id]
    const existing = slipByStaff.get(person.id)
    if (existing) {
      return {
        salary: pesos(existing.salary_minor),
        incentive: existing.incentive_minor ? pesos(existing.incentive_minor) : '',
        paidFrom: existing.paid_from || 'cash',
        note: existing.note || '',
      }
    }
    // Prefill from monthly_salary_minor / 2 (semi-monthly rate) if set
    const defaultCutoffSalary =
      person.monthly_salary_minor > 0
        ? (Number(person.monthly_salary_minor) / 200).toFixed(2)
        : ''
    return {
      salary: defaultCutoffSalary,
      incentive: '',
      paidFrom: '',
      note: '',
    }
  }

  function patchDraft(id, patch) {
    setDrafts((cur) => ({ ...cur, [id]: { ...draftFor({ id }), ...cur[id], ...patch } }))
  }

  async function openEditBaseSalary(person) {
    setEditingBaseStaff(person)
    setBaseSalaryInput(person.monthly_salary_minor ? pesos(person.monthly_salary_minor) : '')
  }

  async function saveBaseSalary(event) {
    event.preventDefault()
    if (!editingBaseStaff) return
    const minor = parsePesosToMinor(baseSalaryInput)
    if (minor == null || minor < 0) {
      toast.error('Enter a valid salary amount (₱0 or greater).')
      return
    }
    setSavingBase(true)
    try {
      await setStaffMonthlySalary(editingBaseStaff.id, minor)
      toast.success(`Base monthly salary for ${editingBaseStaff.full_name} set to ${formatPesos(minor)}/mo.`)
      // Update local people state
      setPeople((cur) =>
        cur.map((p) => (p.id === editingBaseStaff.id ? { ...p, monthly_salary_minor: minor } : p)),
      )
      // Update draft salary for this employee to cutoff rate if not already sent
      const cutoff = (minor / 200).toFixed(2)
      patchDraft(editingBaseStaff.id, { salary: cutoff })
      setEditingBaseStaff(null)
    } catch (err) {
      toast.error(err.message || 'Could not update base monthly salary')
    } finally {
      setSavingBase(false)
    }
  }

  async function sendOne(person) {
    setFormError('')
    if (locked) {
      setFormError('This period is locked. Lucy or Owner can unlock it.')
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
    const incentiveText =
      draft.incentive !== undefined && draft.incentive !== ''
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
    const paidFrom = payrollPaidFrom(draft.paidFrom, existing?.paid_from)
    const note = (draft.note || existing?.note || '').trim()
    setBusyId(person.id)
    try {
      const { error } =
        existing?.status === 'sent'
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
      toast.success(
        `${existing ? 'Saved' : 'Sent'} ${formatAccounting(takeHome)} for ${person.full_name}. Reflected to employee and Finance books.`,
      )
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
    if (!window.confirm(`${verb} ${period.label} for ${branchMap.get(branch) || branch}?`)) return
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

  // Filtered history list
  const filteredHistory = useMemo(() => {
    return historySlips.filter((slip) => {
      if (historyHalf === '1') {
        const d = Number(slip.period_start.split('-')[2])
        if (d > 15) return false
      } else if (historyHalf === '2') {
        const d = Number(slip.period_start.split('-')[2])
        if (d <= 15) return false
      }
      if (historySearch) {
        const staff = staffMap.get(slip.staff_id)
        const name = (staff?.full_name || '').toLowerCase()
        const role = (staff?.role || '').toLowerCase()
        const q = historySearch.toLowerCase()
        if (!name.includes(q) && !role.includes(q)) return false
      }
      return true
    })
  }, [historySlips, historyHalf, historySearch, staffMap])

  // Summary totals for history
  const historyTotals = useMemo(() => {
    let salary = 0
    let incentive = 0
    let cash = 0
    let gcash = 0
    for (const s of filteredHistory) {
      const sal = Number(s.salary_minor) || 0
      const inc = Number(s.incentive_minor) || 0
      const total = sal + inc
      salary += sal
      incentive += inc
      if (s.paid_from === 'gcash') gcash += total
      else cash += total
    }
    return {
      count: filteredHistory.length,
      salary,
      incentive,
      takeHome: salary + incentive,
      cash,
      gcash,
    }
  }, [filteredHistory])

  // Summary totals for current period
  const currentPeriodTotals = useMemo(() => {
    let salary = 0
    let incentive = 0
    let cash = 0
    let gcash = 0
    let sentCount = 0
    for (const s of slips) {
      const sal = Number(s.salary_minor) || 0
      const inc = Number(s.incentive_minor) || 0
      const total = sal + inc
      salary += sal
      incentive += inc
      if (s.paid_from === 'gcash') gcash += total
      else cash += total
      sentCount += 1
    }
    return {
      sentCount,
      totalCount: office.length,
      salary,
      incentive,
      takeHome: salary + incentive,
      cash,
      gcash,
    }
  }, [slips, office])

  // Export functions
  function getExportColumns(forPrint = false) {
    const money = (minor) => (minor == null ? '' : forPrint ? formatAccounting(minor) : (minor / 100).toFixed(2))
    return [
      { label: 'Period start', key: 'period_start' },
      { label: 'Period end', key: 'period_end' },
      { label: 'Period label', value: (r) => rangeLabel(r.period_start, r.period_end) },
      { label: 'Branch', value: (r) => branchMap.get(r.branch) || r.branch },
      { label: 'Staff name', value: (r) => staffMap.get(r.staff_id)?.full_name || '—' },
      { label: 'Role', value: (r) => roleLabel(staffMap.get(r.staff_id)?.role) },
      { label: 'Salary', value: (r) => money(r.salary_minor) },
      { label: 'Incentive', value: (r) => money(r.incentive_minor || 0) },
      { label: 'Take home', value: (r) => money(payslipTakeHome(r.salary_minor, r.incentive_minor)) },
      { label: 'Paid via', value: (r) => (r.paid_from === 'gcash' ? 'GCash' : 'Cash') },
      { label: 'Status', value: (r) => payslipStatusLabel(r.status) },
      { label: 'Signed as', key: 'signed_name' },
      { label: 'Note', key: 'note' },
    ]
  }

  function handleExport(kind, rowsToExport, filenamePrefix, title) {
    const cols = getExportColumns(kind === 'print')
    const filename = `${filenamePrefix}-${getLocalCalendarDate()}`
    if (kind === 'csv') {
      downloadCsv(rowsToExport, cols, `${filename}.csv`)
      toast.success('Payroll report CSV downloaded.')
    } else if (kind === 'excel') {
      downloadExcel(rowsToExport, cols, `${filename}.xls`, title)
      toast.success('Payroll report Excel spreadsheet downloaded.')
    } else {
      printAsPdf(
        rowsToExport,
        cols,
        title,
        `${rowsToExport.length} payslips · Total ${formatAccounting(rowsToExport.reduce((sum, r) => sum + payslipTakeHome(r.salary_minor, r.incentive_minor), 0))}`,
      )
    }
  }

  const tabs = periods.map((row, index) => ({
    id: row.start,
    label: index === 0 ? 'This period' : row.label,
    badge: index === 0 ? row.label : undefined,
  }))

  if (!canWrite) return <Navigate to="/operations/access-denied" replace />

  return (
    <OpsPageShell
      className="hakum-monthly-payroll"
      eyebrow="Finance"
      title="Payroll"
      description="Office and admin pay, semi-monthly (1st–15th and 16th–end of month). Lucy, Robert, or Owner types salary and incentive. Crew stay on the Daily Sheet."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="min-h-11" asChild>
            <Link to="/operations/payslips">My payslips</Link>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* View Mode Switcher */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          <Tabs value={viewMode} onValueChange={setViewMode} className="w-full sm:w-auto">
            <TabsList className="grid w-full grid-cols-2 sm:w-80">
              <TabsTrigger value="run" className="gap-2">
                <DollarSign className="size-4" aria-hidden />
                Payroll run
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="size-4" aria-hidden />
                History & reports
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="mp-branch" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Branch:
              </Label>
              <NamedSelect
                id="mp-branch"
                name="branch"
                className="min-h-10 w-48 text-sm"
                value={branch}
                onChange={setBranch}
                options={
                  viewMode === 'history'
                    ? [{ value: 'all', label: 'All branches' }, ...branches.map((b) => ({ value: b.slug, label: b.name }))]
                    : branches.map((b) => ({ value: b.slug, label: b.name }))
                }
                placeholder="Branch"
              />
            </div>
            {crewCount && viewMode === 'run' ? (
              <span className="text-xs text-muted-foreground hidden lg:inline">
                ({crewCount === 1 ? '1 crew member stays on Daily Sheet' : `${crewCount} crew stay on Daily Sheet`})
              </span>
            ) : null}
          </div>
        </div>

        {viewMode === 'run' ? (
          /* =========================================================================
             VIEW MODE: RUN PAYROLL (ACTIVE RUN)
             ========================================================================= */
          <div className="flex flex-col gap-4">
            {/* Quick Period Tabs & Jump to Cutoff */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Tabs value={period?.start || ''} onValueChange={selectPeriod} className="flex-1 overflow-x-auto">
                <OpsTabList aria-label="Payroll periods" tabs={tabs} />
              </Tabs>

              {/* Jump to specific cutoff */}
              <div className="flex items-center gap-2 shrink-0 bg-muted/40 p-1.5 rounded-xl border border-border">
                <Calendar className="size-4 text-muted-foreground ml-1" aria-hidden />
                <span className="text-xs font-medium text-muted-foreground">Jump:</span>
                <select
                  value={jumpMonth}
                  onChange={(e) => setJumpMonth(e.target.value)}
                  className="bg-background text-xs rounded-lg border border-input px-2 py-1.5"
                  aria-label="Select month"
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={String(i + 1)}>
                      {m.slice(0, 3)}
                    </option>
                  ))}
                </select>
                <select
                  value={jumpHalf}
                  onChange={(e) => setJumpHalf(e.target.value)}
                  className="bg-background text-xs rounded-lg border border-input px-2 py-1.5"
                  aria-label="Select cutoff half"
                >
                  <option value="1">1st–15th</option>
                  <option value="2">16th–End</option>
                </select>
                <select
                  value={jumpYear}
                  onChange={(e) => setJumpYear(e.target.value)}
                  className="bg-background text-xs rounded-lg border border-input px-2 py-1.5"
                  aria-label="Select year"
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
                <Button type="button" size="sm" variant="secondary" className="h-7 text-xs px-2.5" onClick={handleJumpPeriod}>
                  Go
                </Button>
              </div>
            </div>

            {/* Run KPI Summary Strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5 bg-card border border-border rounded-2xl p-4">
              <div>
                <span className="block text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Payout</span>
                <span className="text-xl font-bold tabular-nums text-foreground">{formatAccounting(currentPeriodTotals.takeHome)}</span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground uppercase tracking-wider font-semibold">Base Salaries</span>
                <span className="text-lg font-semibold tabular-nums text-foreground">{formatAccounting(currentPeriodTotals.salary)}</span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground uppercase tracking-wider font-semibold">Incentives</span>
                <span className="text-lg font-semibold tabular-nums text-foreground">{formatAccounting(currentPeriodTotals.incentive)}</span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground uppercase tracking-wider font-semibold">Payment Split</span>
                <span className="text-xs tabular-nums text-muted-foreground block mt-1">
                  Cash: <b className="text-foreground">{formatAccounting(currentPeriodTotals.cash)}</b>
                  <br />
                  GCash: <b className="text-foreground">{formatAccounting(currentPeriodTotals.gcash)}</b>
                </span>
              </div>
              <div className="col-span-2 sm:col-span-4 lg:col-span-1 flex flex-col justify-center">
                <span className="block text-xs text-muted-foreground uppercase tracking-wider font-semibold">Progress</span>
                <span className="text-sm font-medium">
                  {currentPeriodTotals.sentCount} of {currentPeriodTotals.totalCount} staff sent
                </span>
                {slips.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-0 text-primary justify-start mt-0.5"
                    onClick={() => handleExport('csv', slips, `payroll-${period.start}`, `Payroll Run - ${period.label}`)}
                  >
                    <Download className="size-3.5 mr-1" /> Export run CSV
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Period Details & Lock Section */}
            <section className="rounded-2xl border border-border bg-card" aria-labelledby="mp-period-heading">
              <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id="mp-period-heading" className="text-lg font-bold text-pretty text-foreground">
                      {period ? period.label : 'Payroll period'}
                    </h2>
                    <Badge variant={locked ? 'destructive' : 'secondary'} className="font-semibold text-xs">
                      {locked ? 'Locked' : 'Open'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {locked
                      ? 'Locked period. Lucy, Robert, or Owner can unlock to make adjustments.'
                      : 'Fixed cutoff: 1st–15th or 16th–end of month. Lucy or Owner types/adjusts salary & incentive. Approved slips post to Finance.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 shrink-0 gap-2"
                    disabled={locking || !branch || (locked && !isManager)}
                    onClick={toggleLock}
                  >
                    {locked ? <Lock aria-hidden className="size-4" /> : <LockOpen aria-hidden className="size-4" />}
                    {locking ? 'Saving…' : locked ? 'Unlock period' : 'Lock period'}
                  </Button>
                </div>
              </div>

              {formError ? (
                <p className="mx-4 mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}

              {office.length ? (
                <ul className="divide-y divide-border">
                  {office.map((person) => {
                    const slip = slipByStaff.get(person.id)
                    const draft = draftFor(person)
                    const salaryMinor = slip ? slip.salary_minor : parsePesosToMinor(draft.salary)
                    const incentiveMinor = slip
                      ? slip.incentive_minor
                      : draft.incentive.trim()
                        ? parsePesosToMinor(draft.incentive)
                        : 0
                    const takeHome =
                      salaryMinor != null && incentiveMinor != null ? payslipTakeHome(salaryMinor, incentiveMinor) : null
                    const frozen = locked || (slip && slip.status !== 'sent')

                    return (
                      <li key={person.id} className="flex flex-col gap-3 p-4 hover:bg-muted/10 transition-colors">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-semibold text-foreground text-base">{person.full_name}</p>
                              <Badge variant="outline" className="text-xs">
                                {roleLabel(person.role)}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {person.monthly_salary_minor > 0 ? (
                                  <>
                                    Base monthly:{' '}
                                    <strong className="text-foreground">{formatPesos(person.monthly_salary_minor)}/mo</strong>{' '}
                                    <span className="text-muted-foreground">({formatPesos(person.monthly_salary_minor / 2)}/cutoff)</span>
                                  </>
                                ) : (
                                  <span className="text-amber-600 dark:text-amber-400">No default base salary set</span>
                                )}
                              </span>
                              {isManager && !locked ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs px-2 text-primary"
                                  onClick={() => openEditBaseSalary(person)}
                                >
                                  <Pencil className="size-3 mr-1" /> Set base
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          <p className="shrink-0 text-right text-sm">
                            <span className="block text-xs uppercase tracking-wider text-muted-foreground font-semibold">Take-home</span>
                            <span className="tabular-nums font-bold text-lg text-primary">
                              {takeHome == null ? '—' : formatAccounting(takeHome)}
                            </span>
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 bg-muted/20 p-3 rounded-xl border border-border/60">
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`mp-salary-${person.id}`} className="text-xs font-semibold">
                              Cutoff Salary (₱)
                            </Label>
                            <Input
                              id={`mp-salary-${person.id}`}
                              name={`salary-${person.id}`}
                              className="min-h-11 text-right tabular-nums font-medium"
                              inputMode="decimal"
                              autoComplete="off"
                              disabled={frozen}
                              placeholder="0.00"
                              value={
                                frozen && slip
                                  ? pesos(slip.salary_minor)
                                  : draft.salary || (slip ? pesos(slip.salary_minor) : '')
                              }
                              onChange={(e) => patchDraft(person.id, { salary: e.target.value })}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`mp-incentive-${person.id}`} className="text-xs font-semibold">
                              Incentive / Adj (₱)
                            </Label>
                            <Input
                              id={`mp-incentive-${person.id}`}
                              name={`incentive-${person.id}`}
                              className="min-h-11 text-right tabular-nums"
                              inputMode="decimal"
                              autoComplete="off"
                              disabled={frozen}
                              placeholder="0.00"
                              value={
                                frozen && slip
                                  ? pesos(slip.incentive_minor)
                                  : draft.incentive || (slip ? pesos(slip.incentive_minor) : '')
                              }
                              onChange={(e) => patchDraft(person.id, { incentive: e.target.value })}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`mp-paid-${person.id}`} className="text-xs font-semibold">
                              Paid with
                            </Label>
                            <NamedSelect
                              id={`mp-paid-${person.id}`}
                              name={`paid-${person.id}`}
                              className="min-h-11"
                              disabled={frozen}
                              value={payrollPaidFrom(frozen ? slip?.paid_from : draft.paidFrom, slip?.paid_from)}
                              onChange={(value) => patchDraft(person.id, { paidFrom: value })}
                              options={[
                                { value: 'cash', label: 'Cash' },
                                { value: 'gcash', label: 'GCash' },
                              ]}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`mp-note-${person.id}`} className="text-xs font-semibold">
                              Note / Remarks
                            </Label>
                            <Input
                              id={`mp-note-${person.id}`}
                              name={`note-${person.id}`}
                              className="min-h-11"
                              autoComplete="off"
                              disabled={frozen}
                              placeholder="e.g. Regular 1st cutoff pay"
                              value={frozen && slip ? slip.note || '' : draft.note || slip?.note || ''}
                              onChange={(e) => patchDraft(person.id, { note: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1">
                          <div>
                            {slip ? (
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant={slip.status === 'signed' ? 'default' : 'secondary'} className="text-xs">
                                  {payslipStatusLabel(slip.status)}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {slip.paid_from === 'gcash' ? 'GCash' : 'Cash'}
                                  {slip.signed_name ? ` · Signed by ${slip.signed_name}` : ''}
                                </span>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {locked ? 'Not sent. Period is locked.' : 'Draft ready. Click send to issue payslip.'}
                              </p>
                            )}
                          </div>
                          <Button
                            type="button"
                            className="min-h-11 sm:w-auto"
                            disabled={frozen || busyId === person.id}
                            onClick={() => sendOne(person)}
                          >
                            {busyId === person.id
                              ? 'Saving…'
                              : slip?.status === 'sent' && !locked
                                ? 'Save changes'
                                : slip
                                  ? payslipStatusLabel(slip.status)
                                  : 'Send payslip'}
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="p-6 text-sm text-muted-foreground text-center">
                  No office or admin staff found for this branch. Day crew are paid on the Daily Sheet.
                </p>
              )}
            </section>
          </div>
        ) : (
          /* =========================================================================
             VIEW MODE: PAYROLL HISTORY & EXPORT REPORTS
             ========================================================================= */
          <div className="flex flex-col gap-4">
            {/* Filter Bar */}
            <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Payroll History & Reports</h2>
                  <p className="text-sm text-muted-foreground">
                    Filter historical payroll by year, month, cutoff, branch, and status. Export reports to CSV, Excel, or Print/PDF.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-10 gap-1.5 text-xs font-semibold"
                    onClick={loadHistory}
                    disabled={loadingHistory}
                  >
                    <RefreshCw className={`size-3.5 ${loadingHistory ? 'animate-spin' : ''}`} aria-hidden />
                    Refresh
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-10 gap-1.5 text-xs font-semibold"
                    disabled={!filteredHistory.length}
                    onClick={() => handleExport('csv', filteredHistory, `payroll-report-${historyYear}`, `Payroll Report ${historyYear}`)}
                  >
                    <Download className="size-3.5" aria-hidden />
                    Export CSV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-10 gap-1.5 text-xs font-semibold"
                    disabled={!filteredHistory.length}
                    onClick={() => handleExport('excel', filteredHistory, `payroll-report-${historyYear}`, `Payroll Report ${historyYear}`)}
                  >
                    <FileSpreadsheet className="size-3.5" aria-hidden />
                    Export Excel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-10 gap-1.5 text-xs font-semibold"
                    disabled={!filteredHistory.length}
                    onClick={() => handleExport('print', filteredHistory, `payroll-report-${historyYear}`, `Payroll Report ${historyYear}`)}
                  >
                    <Printer className="size-3.5" aria-hidden />
                    Print / PDF
                  </Button>
                </div>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 pt-2 border-t border-border">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Year</Label>
                  <select
                    value={historyYear}
                    onChange={(e) => setHistoryYear(e.target.value)}
                    className="bg-background text-sm rounded-xl border border-input px-3 py-2 min-h-11"
                  >
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Month</Label>
                  <select
                    value={historyMonth}
                    onChange={(e) => setHistoryMonth(e.target.value)}
                    className="bg-background text-sm rounded-xl border border-input px-3 py-2 min-h-11"
                  >
                    <option value="all">All months</option>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={String(i + 1)}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Cutoff Run</Label>
                  <select
                    value={historyHalf}
                    onChange={(e) => setHistoryHalf(e.target.value)}
                    className="bg-background text-sm rounded-xl border border-input px-3 py-2 min-h-11"
                  >
                    <option value="all">Both cutoffs (All)</option>
                    <option value="1">1st half (1st–15th)</option>
                    <option value="2">2nd half (16th–end)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                  <select
                    value={historyStatus}
                    onChange={(e) => setHistoryStatus(e.target.value)}
                    className="bg-background text-sm rounded-xl border border-input px-3 py-2 min-h-11"
                  >
                    <option value="all">All statuses</option>
                    <option value="sent">Sent</option>
                    <option value="received">Received</option>
                    <option value="signed">Signed</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                  <Label className="text-xs font-medium text-muted-foreground">Search Staff</Label>
                  <div className="relative">
                    <Search className="size-4 absolute left-3 top-3.5 text-muted-foreground" aria-hidden />
                    <Input
                      placeholder="Search name or role…"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="min-h-11 pl-9"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* History KPI Summary Strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5 bg-card border border-border rounded-2xl p-4">
              <div>
                <span className="block text-xs text-muted-foreground uppercase tracking-wider font-semibold">Filtered Take-Home</span>
                <span className="text-xl font-bold tabular-nums text-foreground">{formatAccounting(historyTotals.takeHome)}</span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground uppercase tracking-wider font-semibold">Salaries</span>
                <span className="text-lg font-semibold tabular-nums text-foreground">{formatAccounting(historyTotals.salary)}</span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground uppercase tracking-wider font-semibold">Incentives</span>
                <span className="text-lg font-semibold tabular-nums text-foreground">{formatAccounting(historyTotals.incentive)}</span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground uppercase tracking-wider font-semibold">Cash / GCash</span>
                <span className="text-xs tabular-nums text-muted-foreground block mt-1">
                  Cash: <b className="text-foreground">{formatAccounting(historyTotals.cash)}</b>
                  <br />
                  GCash: <b className="text-foreground">{formatAccounting(historyTotals.gcash)}</b>
                </span>
              </div>
              <div className="col-span-2 sm:col-span-4 lg:col-span-1 flex flex-col justify-center">
                <span className="block text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Slips</span>
                <span className="text-lg font-bold tabular-nums text-foreground">{historyTotals.count} payslips</span>
              </div>
            </div>

            {/* History Table */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Salary</TableHead>
                      <TableHead className="text-right">Incentive</TableHead>
                      <TableHead className="text-right font-bold">Take-home</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((s) => {
                      const staff = staffMap.get(s.staff_id)
                      const takeHome = payslipTakeHome(s.salary_minor, s.incentive_minor)
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {rangeLabel(s.period_start, s.period_end)}
                            <span className="block text-xs text-muted-foreground font-normal">
                              {s.period_start} to {s.period_end}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{branchMap.get(s.branch) || s.branch}</TableCell>
                          <TableCell className="font-semibold whitespace-nowrap">{staff?.full_name || 'Staff'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{roleLabel(staff?.role)}</TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">{formatAccounting(s.salary_minor)}</TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">{formatAccounting(s.incentive_minor || 0)}</TableCell>
                          <TableCell className="text-right tabular-nums font-bold text-foreground whitespace-nowrap">
                            {formatAccounting(takeHome)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge variant="outline" className="text-xs">
                              {s.paid_from === 'gcash' ? 'GCash' : 'Cash'}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge variant={s.status === 'signed' ? 'default' : s.status === 'received' ? 'secondary' : 'outline'} className="text-xs">
                              {payslipStatusLabel(s.status)}
                            </Badge>
                            {s.signed_name ? (
                              <span className="block text-xs text-muted-foreground">Signed: {s.signed_name}</span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{s.note || '—'}</TableCell>
                        </TableRow>
                      )
                    })}
                    {!filteredHistory.length && (
                      <TableRow>
                        <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                          {loadingHistory ? 'Loading payroll history…' : 'No payroll records match the selected filters.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Base Monthly Salary Dialog */}
      <Dialog open={!!editingBaseStaff} onOpenChange={(open) => !open && setEditingBaseStaff(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set base monthly salary</DialogTitle>
            <DialogDescription>
              Configure default base salary for <strong>{editingBaseStaff?.full_name}</strong> ({roleLabel(editingBaseStaff?.role)}).
              This rate will automatically prefill each semi-monthly cutoff (half per payroll period).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveBaseSalary} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="base-monthly-salary">Monthly Salary (₱)</Label>
              <Input
                id="base-monthly-salary"
                required
                type="number"
                min="0"
                step="0.01"
                className="min-h-11 text-right tabular-nums font-semibold"
                placeholder="20000.00"
                value={baseSalaryInput}
                onChange={(e) => setBaseSalaryInput(e.target.value)}
              />
              {baseSalaryInput && Number(baseSalaryInput) > 0 ? (
                <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border">
                  Semi-monthly cutoff rate:{' '}
                  <strong className="text-foreground">
                    {formatPesos(Math.round((Number(baseSalaryInput) / 2) * 100))}
                  </strong>{' '}
                  per period (1st–15th and 16th–end of month).
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditingBaseStaff(null)}>
                Cancel
              </Button>
              <Button type="submit" className="min-h-11" disabled={savingBase}>
                {savingBase ? 'Saving…' : 'Save base salary'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </OpsPageShell>
  )
}
