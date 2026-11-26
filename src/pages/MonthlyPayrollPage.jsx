/**
 * Office payroll: semi-monthly (1st–15th and 16th–end of month) + Pro-Rated Day Calculator Wizard.
 * Day crew stay on the Daily Sheet.
 * Owner (BossMich), Lucy, Robert, and Super Admin can view, edit, adjust, process,
 * set base monthly salaries, run pro-rated or fixed half-month cutoffs in a filterable table,
 * and edit or delete historical payslips with automatic Finance Books (`public.expenses`) sync.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import {
  Calculator,
  Calendar,
  CheckCircle2,
  Clock,
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
  Send,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canEditFinanceBooks, getBranchScopeList, isSuperAdmin, isAssistantSuperAdmin } from '@/auth/permissions'
import { listStaffPeople, setStaffMonthlySalary } from '@/lib/adminApi'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { formatAccounting } from '@/lib/dailySheet'
import { collectPaged } from '@/lib/crmInsights'
import { downloadCsv, downloadExcel, printAsPdf } from '@/lib/financeData'
import { callFinanceOwnerOps } from '@/lib/financeOwnerClient'
import {
  computeProratedCutoffSalary,
  daysBetweenInclusive,
  evaluateCutoffReadiness,
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

export default function MonthlyPayrollPage({ defaultBranch, onFinanceSync } = {}) {
  const { profile } = useAuth()
  const isOwner = isSuperAdmin(profile)
  const canWrite = canEditFinanceBooks(profile)
  const isManager = isSuperAdmin(profile) || isAssistantSuperAdmin(profile)
  const scope = getBranchScopeList(profile)
  const [searchParams, setSearchParams] = useSearchParams()

  const [viewMode, setViewMode] = useState('run') // 'run' | 'history'
  const [branches, setBranches] = useState([])
  const [people, setPeople] = useState([])
  const [branch, setBranch] = useState(() => defaultBranch || '')
  const [drafts, setDrafts] = useState({})
  const [slips, setSlips] = useState([])
  const [latestPriorEnd, setLatestPriorEnd] = useState(null)
  const [locked, setLocked] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [batchSending, setBatchSending] = useState(false)
  const [locking, setLocking] = useState(false)
  const [formError, setFormError] = useState('')

  // Run table filters & pro-rata calculator controls
  const [runSearch, setRunSearch] = useState('')
  const [runRoleFilter, setRunRoleFilter] = useState('all')
  const [runStatusFilter, setRunStatusFilter] = useState('all')
  const [calcMode, setCalcMode] = useState('prorated_days') // 'prorated_days' | 'fixed_half'
  const [coveredDays, setCoveredDays] = useState(15)

  // Base salary editing dialog
  const [editingBaseStaff, setEditingBaseStaff] = useState(null)
  const [baseSalaryInput, setBaseSalaryInput] = useState('')
  const [savingBase, setSavingBase] = useState(false)

  // History / Reports state + Owner Edit/Delete Payslip Dialog
  const todayManila = getLocalCalendarDate()
  const [historySlips, setHistorySlips] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyYear, setHistoryYear] = useState(() => todayManila.slice(0, 4))
  const [historyMonth, setHistoryMonth] = useState('all')
  const [historyHalf, setHistoryHalf] = useState('all')
  const [historyStatus, setHistoryStatus] = useState('all')
  const [historySearch, setHistorySearch] = useState('')
  const [editingHistorySlip, setEditingHistorySlip] = useState(null)
  const [historyEditForm, setHistoryEditForm] = useState({
    salary: '',
    incentive: '',
    paid_from: 'cash',
    status: 'sent',
    note: '',
    period_start: '',
    period_end: '',
    branch: '',
  })
  const [savingHistorySlip, setSavingHistorySlip] = useState(false)
  const [deleteSlipTarget, setDeleteSlipTarget] = useState(null)
  const [deletingSlip, setDeletingSlip] = useState(false)

  // Jump to specific cutoff selector
  const [jumpYear, setJumpYear] = useState(() => todayManila.slice(0, 4))
  const [jumpMonth, setJumpMonth] = useState(() => String(Number(todayManila.slice(5, 7))))
  const [jumpHalf, setJumpHalf] = useState(() => (Number(todayManila.slice(8, 10)) <= 15 ? '1' : '2'))

  const periods = useMemo(() => payPeriodList(getLocalCalendarDate(), 6), [])
  const periodKey = searchParams.get('pperiod') || periods[0]?.start || ''
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
    setBranch((cur) => cur || defaultBranch || scoped[0]?.slug || '')
    setPeople(staff || [])
  }, [scope, defaultBranch])

  useEffect(() => {
    if (defaultBranch && branches.some((b) => b.slug === defaultBranch)) {
      setBranch(defaultBranch)
    }
  }, [defaultBranch, branches])

  const loadPeriod = useCallback(async () => {
    if (!branch || !period) return
    const targetBranch = branch === 'all' ? branches[0]?.slug || 'bacoor' : branch
    const [slipRes, lockRes, priorRes] = await Promise.all([
      supabase
        .from('payslips')
        .select('id, staff_id, branch, period_start, period_end, salary_minor, incentive_minor, paid_from, note, status, signed_name, signed_at, created_at')
        .eq('branch', targetBranch)
        .eq('period_start', period.start)
        .eq('period_end', period.end),
      supabase
        .from('payroll_period_locks')
        .select('id, branch, period_start, period_end, locked_by, locked_at')
        .eq('branch', targetBranch)
        .eq('period_start', period.start)
        .eq('period_end', period.end)
        .maybeSingle(),
      supabase
        .from('payslips')
        .select('period_end')
        .eq('branch', targetBranch)
        .lt('period_end', period.start)
        .order('period_end', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    if (slipRes.error) toast.error(slipRes.error.message)
    else setSlips(slipRes.data || [])
    if (lockRes.error) toast.error(lockRes.error.message)
    else setLocked(Boolean(lockRes.data?.id))
    setLatestPriorEnd(priorRes?.data?.period_end || null)
  }, [branch, branches, period])

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const mm = historyMonth && historyMonth !== 'all' ? String(historyMonth).padStart(2, '0') : null
      const rows = await collectPaged(async (from, to) => {
        let q = supabase
          .from('payslips')
          .select('id, staff_id, branch, period_start, period_end, salary_minor, incentive_minor, paid_from, note, status, signed_name, signed_at, created_at')
          .order('period_start', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to)

        if (branch && branch !== 'all') {
          q = q.eq('branch', branch)
        } else if (Array.isArray(scope) && scope.length) {
          q = q.in('branch', scope)
        }

        if (historyYear && historyYear !== 'all') {
          if (mm) {
            const lastDay = String(new Date(Date.UTC(Number(historyYear), Number(mm), 0)).getUTCDate()).padStart(2, '0')
            q = q.gte('period_start', `${historyYear}-${mm}-01`).lte('period_start', `${historyYear}-${mm}-${lastDay}`)
          } else {
            q = q.gte('period_start', `${historyYear}-01-01`).lte('period_end', `${historyYear}-12-31`)
          }
        }

        if (historyStatus && historyStatus !== 'all') {
          q = q.eq('status', historyStatus)
        }

        const { data, error } = await q
        if (error) throw error
        return data || []
      }, 1000)

      const filtered =
        mm && (!historyYear || historyYear === 'all')
          ? rows.filter((r) => String(r.period_start || '').slice(5, 7) === mm)
          : rows
      setHistorySlips(filtered)
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
    if (period) {
      setCoveredDays(daysBetweenInclusive(period.start, period.end))
    }
  }, [period])

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

  const readiness = useMemo(
    () =>
      evaluateCutoffReadiness({
        period,
        slips,
        officeStaff: office,
        latestPriorPeriodEnd: latestPriorEnd,
      }),
    [period, slips, office, latestPriorEnd],
  )

  function selectPeriod(start) {
    const next = new URLSearchParams(searchParams)
    if (!start || start === periods[0]?.start) next.delete('pperiod')
    else next.set('pperiod', start)
    setSearchParams(next, { replace: true })
    setFormError('')
    setDrafts({})
  }

  function handleJumpPeriod() {
    const y = jumpYear
    const mm = String(jumpMonth).padStart(2, '0')
    const day = jumpHalf === '1' ? '01' : '16'
    const targetIso = `${y}-${mm}-${day}`
    selectPeriod(targetIso)
  }

  const computeSuggestedSalaryPesos = useCallback(
    (person, daysOverride = coveredDays, modeOverride = calcMode) => {
      if (!person?.monthly_salary_minor || person.monthly_salary_minor <= 0) return ''
      const res = computeProratedCutoffSalary({
        monthlySalaryMinor: person.monthly_salary_minor,
        mode: modeOverride,
        coveredDays: daysOverride,
      })
      return pesos(res.salaryMinor)
    },
    [coveredDays, calcMode],
  )

  function draftFor(person) {
    if (drafts[person.id]) return drafts[person.id]
    const existing = slipByStaff.get(person.id)
    if (existing) {
      return {
        salary: pesos(existing.salary_minor),
        incentive: existing.incentive_minor ? pesos(existing.incentive_minor) : '',
        paidFrom: existing.paid_from || '',
        note: existing.note || '',
      }
    }
    return {
      salary: computeSuggestedSalaryPesos(person),
      incentive: '',
      paidFrom: '',
      note: '',
    }
  }

  function patchDraft(id, patch) {
    const person = staffMap.get(id) || { id }
    setDrafts((cur) => ({ ...cur, [id]: { ...draftFor(person), ...cur[id], ...patch } }))
  }

  function applyCalculatorToUnsentDrafts(nextDays = coveredDays, nextMode = calcMode) {
    const nextDrafts = { ...drafts }
    let updatedCount = 0
    for (const person of office) {
      const existing = slipByStaff.get(person.id)
      if (existing && existing.status !== 'sent' && !isOwner) continue
      if (!person.monthly_salary_minor) continue
      const suggested = computeSuggestedSalaryPesos(person, nextDays, nextMode)
      const autoNote =
        nextMode === 'prorated_days'
          ? `${nextDays}d pro-rated (${formatPesos(Math.round(person.monthly_salary_minor / 30))}/day)`
          : '50% semi-monthly cutoff'
      nextDrafts[person.id] = {
        ...draftFor(person),
        ...nextDrafts[person.id],
        salary: suggested,
        note: nextDrafts[person.id]?.note || autoNote,
      }
      updatedCount += 1
    }
    setDrafts(nextDrafts)
    toast.success(
      `Applied ${nextMode === 'prorated_days' ? `${nextDays}-day pro-rated formula` : '50% fixed quincena'} to ${updatedCount} staff row(s).`,
    )
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
      const updatedPerson = { ...editingBaseStaff, monthly_salary_minor: minor }
      setPeople((cur) => cur.map((p) => (p.id === editingBaseStaff.id ? updatedPerson : p)))
      patchDraft(editingBaseStaff.id, { salary: computeSuggestedSalaryPesos(updatedPerson) })
      setEditingBaseStaff(null)
    } catch (err) {
      toast.error(err.message || 'Could not update base monthly salary')
    } finally {
      setSavingBase(false)
    }
  }

  async function sendOne(person) {
    setFormError('')
    const targetBranch = branch === 'all' ? person.branch_slug || branches[0]?.slug || 'bacoor' : branch
    if (locked && !isOwner) {
      setFormError('This period is locked. Lucy or Owner can unlock it.')
      return false
    }
    if (!targetBranch || !period) {
      setFormError('Pick a branch and a payroll period.')
      return false
    }
    if (isDayCrewRole(person.role)) {
      setFormError('Crew are paid on the Daily Sheet.')
      return false
    }
    const existing = slipByStaff.get(person.id)
    const draft = draftFor(person)
    const salaryText = draft.salary || (existing ? pesos(existing.salary_minor) : '')
    const incentiveText =
      draft.incentive !== undefined && draft.incentive !== ''
        ? draft.incentive
        : existing
          ? pesos(existing.incentive_minor)
          : ''
    const minor = parsePesosToMinor(salaryText)
    if (minor == null || minor <= 0) {
      setFormError(`Enter a salary for ${person.full_name}.`)
      return false
    }
    const incentive = String(incentiveText).trim() ? parsePesosToMinor(incentiveText) : 0
    if (incentive == null || incentive < 0) {
      setFormError(`Incentive for ${person.full_name} must be zero or more.`)
      return false
    }
    const takeHome = payslipTakeHome(minor, incentive)
    const paidFrom = payrollPaidFrom(draft.paidFrom, existing?.paid_from)
    const note = (draft.note || existing?.note || '').trim()
    setBusyId(person.id)
    try {
      // If Owner is overriding a received/signed slip or locked period, use the Owner API seam
      if (isOwner && (locked || (existing && existing.status !== 'sent'))) {
        await callFinanceOwnerOps({
          action: 'upsert-payslip',
          id: existing?.id,
          staff_id: person.id,
          branch: targetBranch,
          period_start: period.start,
          period_end: period.end,
          salary_minor: minor,
          incentive_minor: incentive,
          paid_from: paidFrom,
          note: note || null,
        })
      } else {
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
                p_branch: targetBranch,
                p_start: period.start,
                p_end: period.end,
                p_salary: minor,
                p_incentive: incentive,
                p_paid_from: paidFrom,
                p_note: note || null,
              })
        if (error) throw error
      }
      toast.success(
        `${existing ? 'Saved' : 'Sent'} ${formatAccounting(takeHome)} for ${person.full_name}. Reflected to employee and Finance books.`,
      )
      await Promise.all([loadPeriod(), viewMode === 'history' ? loadHistory() : Promise.resolve()])
      onFinanceSync?.()
      return true
    } catch (err) {
      const message = err.message || 'Could not send the payslip'
      setFormError(message)
      toast.error(message)
      return false
    } finally {
      setBusyId('')
    }
  }

  async function handleBatchSendUnsent() {
    const readyList = filteredOffice.filter((person) => {
      const existing = slipByStaff.get(person.id)
      if (existing) return false
      const draft = draftFor(person)
      const minor = parsePesosToMinor(draft.salary)
      return minor != null && minor > 0
    })
    if (!readyList.length) {
      return toast.error('No unsent rows have a salary amount greater than ₱0.')
    }
    setBatchSending(true)
    let sent = 0
    let failed = 0
    try {
      for (const person of readyList) {
        const ok = await sendOne(person)
        if (ok) sent += 1
        else failed += 1
      }
      if (failed === 0) {
        toast.success(`Issued ${sent} payslip(s) and posted all to Finance Books.`)
      } else if (sent > 0) {
        toast.warning(`Issued ${sent} payslip(s); ${failed} failed. Check the error banner above.`)
      } else {
        toast.error(`All ${failed} payslip(s) failed to issue.`)
      }
    } finally {
      setBatchSending(false)
    }
  }

  async function toggleLock() {
    if (!period || !branch) return
    const next = !locked
    const verb = next ? 'Lock' : 'Unlock'
    setLocking(true)
    setFormError('')
    try {
      const { error } = await supabase.rpc('set_payroll_period_lock', {
        p_branch: branch === 'all' ? branches[0]?.slug || 'bacoor' : branch,
        p_start: period.start,
        p_end: period.end,
        p_lock: next,
      })
      if (error) throw error
      toast.success(next ? `${verb}ed period.` : 'Period unlocked.')
      await loadPeriod()
    } catch (err) {
      setFormError(err.message || 'Could not change the lock')
      toast.error(err.message || 'Could not change the lock')
    } finally {
      setLocking(false)
    }
  }

  function openEditHistoryModal(slip) {
    setEditingHistorySlip(slip)
    setHistoryEditForm({
      salary: pesos(slip.salary_minor),
      incentive: pesos(slip.incentive_minor || 0),
      paid_from: slip.paid_from === 'gcash' ? 'gcash' : 'cash',
      status: slip.status || 'sent',
      note: slip.note || '',
      period_start: slip.period_start,
      period_end: slip.period_end,
      branch: slip.branch,
    })
  }

  async function saveHistorySlipEdit(event) {
    event.preventDefault()
    if (!editingHistorySlip) return
    const salMinor = parsePesosToMinor(historyEditForm.salary)
    const incMinor = String(historyEditForm.incentive || '').trim()
      ? parsePesosToMinor(historyEditForm.incentive)
      : 0
    if (salMinor == null || salMinor <= 0) {
      return toast.error('Enter a valid salary amount greater than ₱0.')
    }
    if (incMinor == null || incMinor < 0) {
      return toast.error('Incentive must be ₱0 or greater.')
    }
    setSavingHistorySlip(true)
    try {
      await callFinanceOwnerOps({
        action: 'upsert-payslip',
        id: editingHistorySlip.id,
        staff_id: editingHistorySlip.staff_id,
        branch: historyEditForm.branch || editingHistorySlip.branch,
        period_start: historyEditForm.period_start || editingHistorySlip.period_start,
        period_end: historyEditForm.period_end || editingHistorySlip.period_end,
        salary_minor: salMinor,
        incentive_minor: incMinor,
        paid_from: historyEditForm.paid_from,
        status: historyEditForm.status,
        note: historyEditForm.note,
      })
      toast.success('Payslip updated and synced with Finance Books (Account 14).')
      setEditingHistorySlip(null)
      await Promise.all([loadHistory(), loadPeriod()])
      onFinanceSync?.()
    } catch (err) {
      toast.error(err.message || 'Could not update historical payslip')
    } finally {
      setSavingHistorySlip(false)
    }
  }

  async function confirmDeleteHistorySlip() {
    if (!deleteSlipTarget) return
    if (!isOwner) return toast.error('Only Owner (BossMich) can delete a payslip.')
    setDeletingSlip(true)
    try {
      await callFinanceOwnerOps({
        action: 'delete-payslip',
        id: deleteSlipTarget.id,
      })
      toast.success('Payslip deleted and removed from Finance Books.')
      setDeleteSlipTarget(null)
      await Promise.all([loadHistory(), loadPeriod()])
      onFinanceSync?.()
    } catch (err) {
      toast.error(err.message || 'Could not delete payslip')
    } finally {
      setDeletingSlip(false)
    }
  }

  const filteredOffice = useMemo(() => {
    return office.filter((person) => {
      const slip = slipByStaff.get(person.id)
      if (runRoleFilter !== 'all' && person.role !== runRoleFilter) return false
      if (runStatusFilter === 'unsent' && slip) return false
      if (runStatusFilter !== 'all' && runStatusFilter !== 'unsent' && slip?.status !== runStatusFilter) return false
      if (runSearch.trim()) {
        const q = runSearch.trim().toLowerCase()
        const name = String(person.full_name || '').toLowerCase()
        const rLabel = roleLabel(person.role).toLowerCase()
        const note = String(slip?.note || drafts[person.id]?.note || '').toLowerCase()
        if (!name.includes(q) && !rLabel.includes(q) && !note.includes(q)) return false
      }
      return true
    })
  }, [office, slipByStaff, runRoleFilter, runStatusFilter, runSearch, drafts])

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
        const note = String(slip.note || '').toLowerCase()
        const q = historySearch.toLowerCase()
        if (!name.includes(q) && !role.includes(q) && !note.includes(q)) return false
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

  const inner = (
    <>
      <div className="flex flex-col gap-5">
        {/* View Mode Switcher */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          <Tabs value={viewMode} onValueChange={setViewMode} className="w-full sm:w-auto">
            <TabsList className="grid w-full grid-cols-2 sm:w-96">
              <TabsTrigger value="run" className="gap-2">
                <DollarSign className="size-4" aria-hidden />
                Payroll Run Wizard
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="size-4" aria-hidden />
                History &amp; Editable Ledger
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
             VIEW MODE: RUN PAYROLL WIZARD & TABLE
             ========================================================================= */
          <div className="flex flex-col gap-4">
            {/* Quick Period Tabs & Jump to Cutoff */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Tabs value={period?.start || ''} onValueChange={selectPeriod} className="flex-1 overflow-x-auto">
                <OpsTabList aria-label="Payroll periods" tabs={tabs} />
              </Tabs>

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

            {/* 3-Step Cutoff Readiness & Pro-Rated Salary Calculator Wizard */}
            <section className="rounded-2xl border border-border bg-card p-4 shadow-xs" aria-label="Payroll calculation wizard">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Step 1: Cutoff Status Check */}
                <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-muted/20 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Step 1 · Half-Month Check
                      </span>
                      <h3 className="text-sm font-bold text-foreground mt-0.5">
                        {period ? `${period.label} (${readiness.periodDays} calendar days)` : 'Select period'}
                      </h3>
                    </div>
                    <Badge
                      variant={
                        readiness.isComplete ? 'default' : readiness.isDelayed ? 'destructive' : 'secondary'
                      }
                    >
                      {readiness.statusLabel}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    {latestPriorEnd ? (
                      <p>
                        Last completed cutoff ended <strong className="text-foreground">{latestPriorEnd}</strong>{' '}
                        ({readiness.elapsedDays} days elapsed to {period?.end}).
                      </p>
                    ) : (
                      <p>Standard semi-monthly window: {period?.start} to {period?.end}.</p>
                    )}
                    {readiness.isDelayed ? (
                      <p className="text-amber-700 dark:text-amber-300 font-medium">
                        <Clock className="inline size-3.5 mr-1" aria-hidden />
                        +{readiness.delayExtraDays} extra day(s) since last payroll — you can pro-rate for {readiness.elapsedDays} days below.
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Step 2: Pro-Rata vs Fixed Quincena Formula */}
                <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-muted/20 p-3.5">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Step 2 · Computation Formula
                    </span>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <select
                        value={calcMode}
                        onChange={(e) => {
                          const nextMode = e.target.value
                          setCalcMode(nextMode)
                          applyCalculatorToUnsentDrafts(coveredDays, nextMode)
                        }}
                        className="min-h-9 rounded-lg border border-input bg-background px-2.5 text-xs font-semibold"
                        aria-label="Payroll computation mode"
                      >
                        <option value="prorated_days">Pro-Rated by Days ((Monthly ÷ 30) × Days)</option>
                        <option value="fixed_half">Fixed 50% Quincena (Monthly ÷ 2)</option>
                      </select>
                      {calcMode === 'prorated_days' ? (
                        <div className="flex items-center gap-1.5">
                          <Label htmlFor="mp-covered-days" className="text-xs font-medium">Days:</Label>
                          <Input
                            id="mp-covered-days"
                            type="number"
                            min="1"
                            max="62"
                            value={coveredDays}
                            onChange={(e) => setCoveredDays(Math.max(1, Math.min(62, Number(e.target.value) || 15)))}
                            className="h-9 w-16 text-center tabular-nums font-bold text-xs"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Example on ₱30,000/mo (₱1,000/day): 15d = <strong className="text-foreground">₱15,000</strong> · 16d ={' '}
                    <strong className="text-foreground">₱16,000</strong> · 31d = <strong className="text-foreground">₱31,000</strong>.
                  </p>
                </div>

                {/* Step 3: Apply Formula & Batch Issue */}
                <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-muted/20 p-3.5">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Step 3 · Apply &amp; Issue
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {readiness.isComplete
                        ? `All ${readiness.totalStaff} office staff have payslips issued for this cutoff.`
                        : `${readiness.pendingCount} staff member(s) ready to issue for ${period?.label || 'this cutoff'}.`}
                    </p>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-9 gap-1.5 text-xs"
                      onClick={() => applyCalculatorToUnsentDrafts(coveredDays, calcMode)}
                    >
                      <Calculator className="size-3.5" aria-hidden />
                      Apply {calcMode === 'prorated_days' ? `${coveredDays}d Pro-Rata` : '50% Quincena'}
                    </Button>
                    {readiness.elapsedDays && readiness.elapsedDays !== coveredDays ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="min-h-9 text-xs"
                        onClick={() => {
                          setCoveredDays(readiness.elapsedDays)
                          setCalcMode('prorated_days')
                          applyCalculatorToUnsentDrafts(readiness.elapsedDays, 'prorated_days')
                        }}
                      >
                        Use {readiness.elapsedDays}d elapsed
                      </Button>
                    ) : null}
                    {readiness.pendingCount > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-9 gap-1.5 text-xs"
                        disabled={batchSending || (locked && !isOwner)}
                        onClick={handleBatchSendUnsent}
                      >
                        <Send className="size-3.5" aria-hidden />
                        {batchSending ? 'Issuing…' : `Issue Ready (${readiness.pendingCount})`}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

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

            {/* Period Details, Filter Bar & Payroll Run Data Table */}
            <section className="rounded-2xl border border-border bg-card overflow-hidden" aria-labelledby="mp-period-heading">
              <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id="mp-period-heading" className="text-lg font-bold text-pretty text-foreground">
                      {period ? period.label : 'Payroll period'}
                    </h2>
                    <Badge variant={locked ? 'destructive' : 'secondary'} className="font-semibold text-xs">
                      {locked ? 'Locked' : 'Open'}
                    </Badge>
                    {readiness.isComplete ? (
                      <Badge variant="default" className="gap-1 text-xs">
                        <CheckCircle2 className="size-3" aria-hidden /> All Sent
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {locked
                      ? 'Locked period. Owner (BossMich) can still override any row or unlock the period.'
                      : 'Fixed cutoff: 1st–15th or 16th–end of month. Every issued or edited slip automatically posts to Finance Books (Account 14).'}
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

              {/* Table Filter Bar */}
              <div className="grid grid-cols-1 gap-3 border-b border-border bg-muted/20 p-3.5 sm:grid-cols-3">
                <div className="relative">
                  <Search className="size-4 absolute left-3 top-3.5 text-muted-foreground" aria-hidden />
                  <Input
                    placeholder="Smart search staff name, role, or remarks…"
                    value={runSearch}
                    onChange={(e) => setRunSearch(e.target.value)}
                    className="min-h-10 pl-9 bg-background"
                  />
                </div>
                <select
                  value={runRoleFilter}
                  onChange={(e) => setRunRoleFilter(e.target.value)}
                  className="min-h-10 rounded-xl border border-input bg-background px-3 text-sm"
                  aria-label="Filter by role"
                >
                  <option value="all">All office roles</option>
                  <option value="BossMich">Owner</option>
                  <option value="assistant_super_admin">General Admin (ASA)</option>
                  <option value="admin">Branch Admin</option>
                  <option value="operations_lead">Operations Lead</option>
                  <option value="sales">Sales</option>
                  <option value="marketing">Marketing</option>
                  <option value="video_editor">Video Editor</option>
                </select>
                <select
                  value={runStatusFilter}
                  onChange={(e) => setRunStatusFilter(e.target.value)}
                  className="min-h-10 rounded-xl border border-input bg-background px-3 text-sm"
                  aria-label="Filter by payslip status"
                >
                  <option value="all">All statuses ({office.length})</option>
                  <option value="unsent">Draft / Not yet sent ({readiness.pendingCount})</option>
                  <option value="sent">Sent</option>
                  <option value="received">Received</option>
                  <option value="signed">Signed</option>
                </select>
              </div>

              {formError ? (
                <p className="mx-4 mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}

              {filteredOffice.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[210px]">Employee &amp; Base Rate</TableHead>
                        <TableHead className="w-36 text-right">Cutoff Salary (₱)</TableHead>
                        <TableHead className="w-32 text-right">Incentive (₱)</TableHead>
                        <TableHead className="w-32 text-right">Take-Home</TableHead>
                        <TableHead className="w-32">Paid With</TableHead>
                        <TableHead className="min-w-[180px]">Note / Formula</TableHead>
                        <TableHead className="w-28">Status</TableHead>
                        <TableHead className="w-36 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOffice.map((person) => {
                        const slip = slipByStaff.get(person.id)
                        const draft = draftFor(person)
                        const salaryText = draft.salary !== undefined ? draft.salary : slip ? pesos(slip.salary_minor) : ''
                        const incentiveText =
                          draft.incentive !== undefined ? draft.incentive : slip ? pesos(slip.incentive_minor) : ''
                        const salaryMinor = parsePesosToMinor(salaryText)
                        const incentiveMinor = String(incentiveText).trim() ? parsePesosToMinor(incentiveText) : 0
                        const takeHome =
                          salaryMinor != null && incentiveMinor != null ? payslipTakeHome(salaryMinor, incentiveMinor) : null
                        const frozen = !isOwner && (locked || (slip && slip.status !== 'sent'))
                        const dailyRateMinor = person.monthly_salary_minor ? Math.round(person.monthly_salary_minor / 30) : 0

                        return (
                          <TableRow key={person.id} className="align-middle">
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-semibold text-foreground">{person.full_name}</span>
                                  <Badge variant="outline" className="text-[11px]">
                                    {roleLabel(person.role)}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                  {person.monthly_salary_minor > 0 ? (
                                    <span>
                                      {formatPesos(person.monthly_salary_minor)}/mo ·{' '}
                                      <strong className="text-foreground">{formatPesos(dailyRateMinor)}/d</strong>
                                    </span>
                                  ) : (
                                    <span className="text-amber-600 dark:text-amber-400">No base monthly set</span>
                                  )}
                                  {isManager && (!locked || isOwner) ? (
                                    <button
                                      type="button"
                                      className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                                      onClick={() => openEditBaseSalary(person)}
                                    >
                                      <Pencil className="size-3 mr-0.5" /> Set base
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                id={`mp-salary-${person.id}`}
                                name={`salary-${person.id}`}
                                className="min-h-10 text-right tabular-nums font-medium"
                                inputMode="decimal"
                                autoComplete="off"
                                disabled={frozen}
                                placeholder="0.00"
                                value={salaryText}
                                onChange={(e) => patchDraft(person.id, { salary: e.target.value })}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                id={`mp-incentive-${person.id}`}
                                name={`incentive-${person.id}`}
                                className="min-h-10 text-right tabular-nums"
                                inputMode="decimal"
                                autoComplete="off"
                                disabled={frozen}
                                placeholder="0.00"
                                value={incentiveText}
                                onChange={(e) => patchDraft(person.id, { incentive: e.target.value })}
                              />
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-bold text-primary whitespace-nowrap">
                              {takeHome == null ? '—' : formatAccounting(takeHome)}
                            </TableCell>
                            <TableCell>
                              <NamedSelect
                                id={`mp-paid-${person.id}`}
                                name={`paid-${person.id}`}
                                className="min-h-10"
                                disabled={frozen}
                                value={payrollPaidFrom(frozen ? slip?.paid_from : draft.paidFrom, slip?.paid_from)}
                                onChange={(value) => patchDraft(person.id, { paidFrom: value })}
                                options={[
                                  { value: 'cash', label: 'Cash' },
                                  { value: 'gcash', label: 'GCash' },
                                ]}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                id={`mp-note-${person.id}`}
                                name={`note-${person.id}`}
                                className="min-h-10 text-xs"
                                autoComplete="off"
                                disabled={frozen}
                                placeholder={
                                  calcMode === 'prorated_days'
                                    ? `${coveredDays}d pro-rated cutoff`
                                    : 'Regular half-month cutoff'
                                }
                                value={frozen && slip ? slip.note || '' : draft.note ?? slip?.note ?? ''}
                                onChange={(e) => patchDraft(person.id, { note: e.target.value })}
                              />
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {slip ? (
                                <div className="flex flex-col gap-0.5">
                                  <Badge
                                    variant={slip.status === 'signed' ? 'default' : slip.status === 'received' ? 'secondary' : 'outline'}
                                    className="text-xs w-fit"
                                  >
                                    {payslipStatusLabel(slip.status)}
                                  </Badge>
                                  {slip.signed_name ? (
                                    <span className="text-[11px] text-muted-foreground truncate max-w-[110px]">
                                      {slip.signed_name}
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  Draft
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <Button
                                type="button"
                                size="sm"
                                variant={slip ? 'outline' : 'default'}
                                className="min-h-10"
                                disabled={frozen || busyId === person.id}
                                onClick={() => sendOne(person)}
                              >
                                {busyId === person.id
                                  ? 'Saving…'
                                  : slip
                                    ? isOwner && slip.status !== 'sent'
                                      ? 'Override & Sync'
                                      : 'Save changes'
                                    : 'Send payslip'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="p-6 text-sm text-muted-foreground text-center">
                  No office or admin staff match the current filter. Day crew are paid on the Daily Sheet.
                </p>
              )}
            </section>
          </div>
        ) : (
          /* =========================================================================
             VIEW MODE: PAYROLL HISTORY & EDITABLE FINANCE-SYNCED LEDGER
             ========================================================================= */
          <div className="flex flex-col gap-4">
            {/* Filter Bar */}
            <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Payroll History &amp; Editable Ledger</h2>
                  <p className="text-sm text-muted-foreground">
                    Filter historical payslips by year, month, cutoff, branch, or employee. Any Owner edit or delete automatically updates Finance Books (Account 14).
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
                    <option value="all">All years</option>
                    {Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() + 1 - i)).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
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
                      placeholder="Search name, role, or note…"
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
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((s) => {
                      const staff = staffMap.get(s.staff_id)
                      const takeHome = payslipTakeHome(s.salary_minor, s.incentive_minor)
                      const canEditRow = isOwner || (canWrite && s.status === 'sent')
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {rangeLabel(s.period_start, s.period_end)}
                            <span className="block text-xs text-muted-foreground font-normal">
                              {s.period_start} to {s.period_end} ({daysBetweenInclusive(s.period_start, s.period_end)}d)
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
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex justify-end gap-1">
                              {canEditRow ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="min-h-9 gap-1"
                                  onClick={() => openEditHistoryModal(s)}
                                >
                                  <Pencil className="size-3.5" aria-hidden />
                                  Edit
                                </Button>
                              ) : null}
                              {isOwner ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="min-h-9 text-destructive hover:text-destructive"
                                  disabled={deletingSlip || busyId === s.id}
                                  onClick={() => setDeleteSlipTarget(s)}
                                  aria-label="Delete payslip"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {!filteredHistory.length && (
                      <TableRow>
                        <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
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
              Used for both 50% semi-monthly cutoffs and daily pro-rata calculations (Monthly ÷ 30 × Covered Days).
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
                placeholder="30000.00"
                value={baseSalaryInput}
                onChange={(e) => setBaseSalaryInput(e.target.value)}
              />
              {baseSalaryInput && Number(baseSalaryInput) > 0 ? (
                <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border space-y-1">
                  <p>
                    50% Quincena (15d):{' '}
                    <strong className="text-foreground">
                      {formatPesos(Math.round((Number(baseSalaryInput) / 2) * 100))}
                    </strong>
                  </p>
                  <p>
                    Daily Pro-Rata Rate (÷ 30):{' '}
                    <strong className="text-foreground">
                      {formatPesos(Math.round((Number(baseSalaryInput) / 30) * 100))}/day
                    </strong>{' '}
                    (16d = {formatPesos(Math.round(((Number(baseSalaryInput) * 16) / 30) * 100))})
                  </p>
                </div>
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

      {/* Edit / Override Historical Payslip Dialog (Syncs with Finance Expenses) */}
      <Dialog open={!!editingHistorySlip} onOpenChange={(open) => !open && setEditingHistorySlip(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Payslip &amp; Sync Finance Books</DialogTitle>
            <DialogDescription>
              Updating this payslip for{' '}
              <strong>{staffMap.get(editingHistorySlip?.staff_id)?.full_name || 'Employee'}</strong> automatically updates
              the corresponding paid salary expense in Finance Books (Account 14 · P&amp;L &amp; Bills).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveHistorySlipEdit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hist-edit-salary">Salary (₱)</Label>
              <Input
                id="hist-edit-salary"
                required
                inputMode="decimal"
                className="min-h-11 text-right tabular-nums font-semibold"
                value={historyEditForm.salary}
                onChange={(e) => setHistoryEditForm((f) => ({ ...f, salary: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hist-edit-inc">Incentive / Adj (₱)</Label>
              <Input
                id="hist-edit-inc"
                inputMode="decimal"
                className="min-h-11 text-right tabular-nums"
                value={historyEditForm.incentive}
                onChange={(e) => setHistoryEditForm((f) => ({ ...f, incentive: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hist-edit-method">Payment Method</Label>
              <select
                id="hist-edit-method"
                value={historyEditForm.paid_from}
                onChange={(e) => setHistoryEditForm((f) => ({ ...f, paid_from: e.target.value }))}
                className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hist-edit-status">Status</Label>
              <select
                id="hist-edit-status"
                value={historyEditForm.status}
                disabled={!isOwner}
                onChange={(e) => setHistoryEditForm((f) => ({ ...f, status: e.target.value }))}
                className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="sent">Sent</option>
                <option value="received">Received</option>
                <option value="signed">Signed</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="hist-edit-note">Remarks / Formula Note</Label>
              <Input
                id="hist-edit-note"
                className="min-h-11"
                placeholder="e.g. 16d pro-rated adjustment"
                value={historyEditForm.note}
                onChange={(e) => setHistoryEditForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditingHistorySlip(null)}>
                Cancel
              </Button>
              <Button type="submit" className="min-h-11" disabled={savingHistorySlip}>
                {savingHistorySlip ? 'Syncing…' : 'Save & Sync to Finance'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Payslip & Sync Finance Dialog */}
      <Dialog open={Boolean(deleteSlipTarget)} onOpenChange={(open) => !open && setDeleteSlipTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete payslip &amp; remove from Finance?</DialogTitle>
            <DialogDescription>
              This permanently removes the payslip for{' '}
              <strong>{staffMap.get(deleteSlipTarget?.staff_id)?.full_name || 'this employee'}</strong> (
              {deleteSlipTarget ? rangeLabel(deleteSlipTarget.period_start, deleteSlipTarget.period_end) : ''}) and deletes its linked{' '}
              <strong>Account 14</strong> salary expense from Finance Books &amp; P&amp;L.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setDeleteSlipTarget(null)} disabled={deletingSlip}>
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-11 bg-rose-600 text-white hover:bg-rose-700"
              disabled={deletingSlip}
              onClick={confirmDeleteHistorySlip}
            >
              {deletingSlip ? 'Deleting…' : 'Delete & Sync Books'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )

  return inner
}
