import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import { format, getDay, parse, startOfWeek } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useAuth } from '@/auth/AuthProvider'
import {
  canAccessBookingBoard,
  canCheckInFormBooking,
  canCreateBookings,
  canEditBookings,
  canModifyBookingServicePrice,
  canSeeAllBranches,
  getBranchScopeList,
  isFormBookingsOnlyRole,
  ROLES,
} from '@/auth/permissions'
import {
  DETAILING_BOARD_STATUSES,
  bookingLaneDomId,
  detailingBoardStatusLabel,
  isOpenBookingStatus,
  scrollBookingLaneIntoView,
} from '@/lib/detailingBoardStatuses'
import {
  BOOKING_TABLE_DEFAULT_PAGE_SIZE,
  BOOKING_TABLE_PAGE_SIZES,
  bookingCarPlateLine,
  bookingDetailingTypeText,
  bookingServiceText,
  bookingVehicleText,
  filterBookingList,
  paginateBookingTableRows,
  sortBookingTableRows,
} from '@/lib/bookingTable'
import { listBranches } from '@/lib/adminApi'
import { getAccessTokenFresh } from '@/lib/authToken'
import { applyBranchScope } from '@/lib/crmInsights'
import { supabase } from '@/lib/supabase'
import { plateValidationError, PLATE_FIELD_HINT } from '@/lib/customerAuth'
import {
  BOOKING_PRIMARY_ACTION_LABELS,
  getBookingBoardStatuses,
  getBookingPrimaryNextStatus,
  getDashboardDateRange,
  matchesBookingSmartSearch,
  requiresTeamLeadBranchSetup,
  resolveBranchFilter,
  filterBranchesForProfile,
  pickDefaultBranchSlug,
  STATUS_LABELS,
} from '@/queue/queueLogic'
import { assignStaff, fetchPresentAssignableStaff, fetchServices } from '@/queue/queueApi'
import { filterFloorDetailingServices, isBookingBoardRow } from '@/lib/serviceKinds'
import CancellationReasonDialog from '@/components/CancellationReasonDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { createCoalescedReload } from '@/lib/coalesceReload'
import { cn } from '@/lib/utils'
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

const BOOKING_TABS = ['board', 'list', 'table', 'calendar']
const COLUMNS = [
  ...DETAILING_BOARD_STATUSES.map((s) => ({
    id: s.id,
    label: s.label,
    shortLabel: s.shortLabel || s.label,
    tone: s.tone,
    hint: s.hint,
  })),
  { id: 'cancelled', label: 'Cancelled', shortLabel: 'Cancelled', tone: 'is-cancelled', hint: 'Cancelled with reason' },
]

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-US': enUS },
})

const emptyBooking = {
  customer_name: '',
  customer_phone: '',
  customer_id: null,
  branch: '',
  scheduled_start: '',
  service_id: '',
  vehicle_plate: '',
  vehicle_make: '',
  vehicle_model: '',
  notes: '',
  status: 'pending',
  price_pesos: '',
}

function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

function bookingTableWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function BookingPager({ slice, pageSize, onPageSize, onPage }) {
  return (
    <div className="bk-table-pager">
      <label className="bk-table-page-size">
        Rows per page
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          aria-label="Rows per page"
        >
          {BOOKING_TABLE_PAGE_SIZES.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      <p className="bk-table-page-range tabular-nums">
        {slice.from}-{slice.to} of {slice.total}
      </p>
      <div className="bk-table-page-nav">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 min-w-11 cursor-pointer px-0"
          disabled={slice.page <= 1}
          aria-label="First page"
          onClick={() => onPage(1)}
        >
          <ChevronsLeft size={16} strokeWidth={2} />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 min-w-11 cursor-pointer px-0"
          disabled={slice.page <= 1}
          aria-label="Previous page"
          onClick={() => onPage(Math.max(1, slice.page - 1))}
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 min-w-11 cursor-pointer px-0"
          disabled={slice.page >= slice.totalPages}
          aria-label="Next page"
          onClick={() => onPage(slice.page + 1)}
        >
          <ChevronRight size={16} strokeWidth={2} />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 min-w-11 cursor-pointer px-0"
          disabled={slice.page >= slice.totalPages}
          aria-label="Last page"
          onClick={() => onPage(slice.totalPages)}
        >
          <ChevronsRight size={16} strokeWidth={2} />
        </Button>
      </div>
    </div>
  )
}

function BookingTableSortButton({ label, column, sort, onSort }) {
  const active = sort.key === column
  return (
    <button
      type="button"
      className="bk-th-sort"
      aria-sort={active ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none'}
      onClick={() => onSort(column)}
    >
      <span>{label}</span>
      <ArrowUpDown size={14} strokeWidth={2} aria-hidden="true" />
    </button>
  )
}

function BookingStageTicket({
  booking,
  tone,
  variant,
  canOpen,
  onOpen,
}) {
  const isList = variant === 'list'
  const service = bookingDetailingTypeText(booking)
  const carPlate = bookingCarPlateLine(booking)
  const label = `${service}, ${carPlate}`
  const className = cn(
    isList ? 'bk-card bk-ticket-compact planner-ticket' : 'floor-ticket bk-ticket-compact planner-ticket',
    tone,
    canOpen && 'bk-ticket-openable',
  )

  const body = (
    <>
      <p className="bk-ticket-service">{service}</p>
      <p className="bk-ticket-car-plate">{carPlate}</p>
      {isList ? (
        <p className="bk-ticket-status">
          {detailingBoardStatusLabel(booking.status) || STATUS_LABELS[booking.status] || booking.status}
        </p>
      ) : null}
    </>
  )

  if (!canOpen) {
    return (
      <article className={className} aria-label={label}>
        {body}
      </article>
    )
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={`Open booking · ${label}`}
      onClick={() => onOpen(booking)}
    >
      {body}
    </button>
  )
}

/** Prefer live ops shops (Bacoor / Batangas) over test / Dasmarinas audit slugs. */
function preferredBranchSlug(branches = []) {
  const preferred = ['bacoor', 'batangas']
  for (const slug of preferred) {
    if (branches.some((b) => b.slug === slug)) return slug
  }
  return branches[0]?.slug || ''
}

function bookableBranches(branches = [], profile) {
  return filterBranchesForProfile(branches, profile).filter(
    (b) => b && !b.is_archived && b.is_active !== false && !b.coming_soon,
  )
}

function selectItems(options = []) {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

export default function BookingBoardPage() {
  const { profile } = useAuth()
  const canEdit = canEditBookings(profile)
  const canCreate = canCreateBookings(profile)
  const canEditServicePrice = canModifyBookingServicePrice(profile)
  const isMarketing = profile?.role === ROLES.MARKETING
  const formBookingsOnly = isFormBookingsOnlyRole(profile)
  const canCheckIn = canCheckInFormBooking(profile)
  const canAdvanceStatus = canEdit && !isMarketing
  const canCancelForm = canEdit
  const canSeePayment = false // Bookings board ends at Successful Release — POS is separate
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = BOOKING_TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'board'
  const [bookings, setBookings] = useState([])
  const [branches, setBranches] = useState([])
  const [services, setServices] = useState([])
  const [branchFilter, setBranchFilter] = useState(canSeeAllBranches(profile) ? 'all' : (getBranchScopeList(profile)?.[0] || 'all'))
  const [datePreset, setDatePreset] = useState('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState('detailing')
  const [tableSort, setTableSort] = useState({ key: 'start', dir: 'asc' })
  const [tablePage, setTablePage] = useState(1)
  const [tablePageSize, setTablePageSize] = useState(BOOKING_TABLE_DEFAULT_PAGE_SIZE)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyBooking)
  const [saving, setSaving] = useState(false)
  const [boardFilter, setBoardFilter] = useState('pending')
  const [crewDialog, setCrewDialog] = useState(null)
  const [crewOptions, setCrewOptions] = useState([])
  const [crewSelected, setCrewSelected] = useState([])
  const [crewLoading, setCrewLoading] = useState(false)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [customerLookup, setCustomerLookup] = useState({ loading: false, error: '', match: null })
  const [assignBranchDialog, setAssignBranchDialog] = useState(null)
  const [assignBranchSlug, setAssignBranchSlug] = useState('')
  const [assignBranchSaving, setAssignBranchSaving] = useState(false)
  const formServices = useMemo(() => filterFloorDetailingServices(services), [services])
  const boardStatuses = useMemo(() => getBookingBoardStatuses(profile), [profile])
  const visibleColumns = useMemo(
    () => COLUMNS.filter((c) => boardStatuses.includes(c.id)),
    [boardStatuses],
  )
  const focusedBoardStatus = visibleColumns.some((c) => c.id === boardFilter)
    ? boardFilter
    : (visibleColumns[0]?.id || 'pending')

  const range = useMemo(() => {
    if (datePreset === 'all' || datePreset === 'any') {
      return { start: null, end: null }
    }
    if (datePreset === 'today' || datePreset === 'day') {
      const d = todayISO()
      return { start: d, end: d }
    }
    const r = getDashboardDateRange(datePreset, customStart, customEnd)
    if (!r.start || !r.end) return { start: null, end: null }
    return {
      start: r.start.toLocaleDateString('en-CA'),
      end: r.end.toLocaleDateString('en-CA'),
    }
  }, [datePreset, customStart, customEnd])

  const branchScope = useMemo(() => resolveBranchFilter(profile, branchFilter), [profile, branchFilter])

  const load = useCallback(async () => {
    const select =
      'id, customer_name, customer_phone, branch, status, scheduled_start, scheduled_end, completed_at, created_at, updated_at, assigned_staff_id, notes, vehicle_make, vehicle_model, vehicle_plate, service_id, final_price_minor, price_minor, services(name, slug, pay_category)'
    // Open pipeline stays on board/calendar until released/cancelled — date filter only gates terminal rows.
    const openStatuses = boardStatuses.filter((s) => isOpenBookingStatus(s))
    const closedStatuses = boardStatuses.filter((s) => !isOpenBookingStatus(s))

    let openQ = supabase
      .from('bookings')
      .select(select)
      .eq('is_archived', false)
      .in('status', openStatuses.length ? openStatuses : ['pending'])
      .order('scheduled_start', { ascending: true })
      .limit(500)
    openQ = applyBranchScope(openQ, branchScope)

    let closedQ = null
    if (closedStatuses.length) {
      closedQ = supabase
        .from('bookings')
        .select(select)
        .eq('is_archived', false)
        .in('status', closedStatuses)
        .order('scheduled_start', { ascending: true })
        .limit(datePreset === 'all' ? 400 : 200)
      if (range.start && range.end) {
        closedQ = closedQ
          .gte('scheduled_start', `${range.start}T00:00:00+08:00`)
          .lte('scheduled_start', `${range.end}T23:59:59.999+08:00`)
      }
      closedQ = applyBranchScope(closedQ, branchScope)
    }

    const [openRes, closedRes] = await Promise.all([
      openQ,
      closedQ || Promise.resolve({ data: [], error: null }),
    ])
    if (openRes.error) toast.error(openRes.error.message)
    else if (closedRes.error) toast.error(closedRes.error.message)

    const byId = new Map()
    for (const row of [...(openRes.data || []), ...(closedRes.data || [])]) {
      if (!isBookingBoardRow(row)) continue
      byId.set(row.id, row)
    }
    setBookings(
      [...byId.values()].sort(
        (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
      ),
    )
  }, [branchScope, range.start, range.end, boardStatuses, datePreset])

  useEffect(() => {
    listBranches().then((rows) => {
      setBranches(rows || [])
      setForm((f) => {
        if (f.branch) return f
        const scoped = bookableBranches(rows || [], profile)
        return {
          ...f,
          branch: preferredBranchSlug(scoped) || pickDefaultBranchSlug(profile, scoped),
        }
      })
    }).catch(() => {})
    fetchServices()
      .then((rows) => setServices(rows || []))
      .catch(() => setServices([]))
  }, [profile])

  const formBranchOptions = useMemo(() => bookableBranches(branches, profile), [branches, profile])
  const branchNameBySlug = useMemo(
    () => Object.fromEntries((branches || []).map((b) => [b.slug, b.name || b.slug])),
    [branches],
  )
  const serviceSelectOptions = useMemo(() => {
    const base = formServices.map((s) => ({ value: s.id, label: s.name }))
    // Keep the current service visible when editing a non-detailing historical row.
    if (form.service_id && !base.some((s) => s.value === form.service_id)) {
      const orphan = services.find((s) => s.id === form.service_id)
      if (orphan) base.unshift({ value: orphan.id, label: orphan.name })
    }
    return base
  }, [formServices, form.service_id, services])
  const branchSelectOptions = useMemo(
    () => formBranchOptions.map((b) => ({ value: b.slug, label: b.name || b.slug })),
    [formBranchOptions],
  )
  const canAssignBranch =
    profile?.role === ROLES.SALES ||
    profile?.role === ROLES.SUPER_ADMIN ||
    profile?.role === ROLES.ASSISTANT_SUPER_ADMIN

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const loadRef = { current: load }
    loadRef.current = load
    const scheduleReload = createCoalescedReload(() => loadRef.current(), 450)
    const filter =
      typeof branchScope === 'string' && branchScope && branchScope !== 'all'
        ? `branch=eq.${branchScope}`
        : undefined
    const channel = supabase
      .channel(`booking-board-${JSON.stringify(branchScope)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', ...(filter ? { filter } : {}) },
        scheduleReload,
      )
      .subscribe()
    return () => {
      scheduleReload.cancel()
      supabase.removeChannel(channel)
    }
  }, [load, branchScope])

  const grouped = useMemo(() => {
    const map = Object.fromEntries(COLUMNS.map((c) => [c.id, []]))
    const source = searchQuery.trim()
      ? bookings.filter((b) =>
          matchesBookingSmartSearch(
            {
              ...b,
              status_label: detailingBoardStatusLabel(b.status) || STATUS_LABELS[b.status],
            },
            searchQuery,
            branchNameBySlug,
          ),
        )
      : bookings
    for (const booking of source) {
      const key = map[booking.status] ? booking.status : 'pending'
      map[key].push(booking)
    }
    return map
  }, [bookings, searchQuery, branchNameBySlug])

  const calendarEvents = useMemo(
    () =>
      bookings.map((b) => {
        const start = new Date(b.scheduled_start)
        const end = b.scheduled_end ? new Date(b.scheduled_end) : new Date(start.getTime() + 60 * 60_000)
        return {
          id: b.id,
          title: `${b.customer_name} · ${b.vehicle_plate || b.branch}`,
          start,
          end,
          resource: b,
        }
      }),
    [bookings],
  )

  const filteredBookings = useMemo(() => {
    const searched = searchQuery.trim()
      ? bookings.filter((b) =>
          matchesBookingSmartSearch(
            {
              ...b,
              status_label: detailingBoardStatusLabel(b.status) || STATUS_LABELS[b.status],
            },
            searchQuery,
            branchNameBySlug,
          ),
        )
      : bookings
    return filterBookingList(searched, { status: statusFilter, kind: kindFilter })
  }, [bookings, searchQuery, statusFilter, kindFilter, branchNameBySlug])

  const sortedBookings = useMemo(
    () => sortBookingTableRows(filteredBookings, { ...tableSort, branchNames: branchNameBySlug }),
    [filteredBookings, tableSort, branchNameBySlug],
  )
  const tableSlice = useMemo(
    () => paginateBookingTableRows(sortedBookings, { page: tablePage, pageSize: tablePageSize }),
    [sortedBookings, tablePage, tablePageSize],
  )

  useEffect(() => {
    setTablePage(1)
  }, [searchQuery, statusFilter, kindFilter, tablePageSize, datePreset, branchFilter])

  useEffect(() => {
    if (tableSlice.page !== tablePage) setTablePage(tableSlice.page)
  }, [tableSlice.page, tablePage])

  function toggleTableSort(column) {
    setTableSort((prev) => (
      prev.key === column
        ? { key: column, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key: column, dir: 'asc' }
    ))
  }

  async function move(booking, status) {
    if (!canAdvanceStatus) return
    // Sales assigns a concrete branch when leaving Booking Placeholder.
    if (status === 'confirmed' && canAssignBranch) {
      setAssignBranchSlug(booking.branch || preferredBranchSlug(formBranchOptions) || '')
      setAssignBranchDialog(booking)
      return
    }
    // Crew assignment on start stays on Queue for TL/Admin; Sales advances status only.
    if (status === 'in_progress' && !formBookingsOnly) {
      setCrewLoading(true)
      setCrewDialog(booking)
      setCrewSelected([])
      try {
        const rows = await fetchPresentAssignableStaff(profile, booking.branch)
        setCrewOptions(rows)
      } catch (err) {
        toast.error(err.message || 'Unable to load present crew')
        setCrewDialog(null)
      } finally {
        setCrewLoading(false)
      }
      return
    }
    await applyStatusMove(booking, status)
  }

  async function confirmAssignBranch() {
    if (!assignBranchDialog) return
    if (!assignBranchSlug) {
      toast.error('Pick a branch.')
      return
    }
    setAssignBranchSaving(true)
    try {
      const ok = await applyStatusMove(assignBranchDialog, 'confirmed', { branch: assignBranchSlug })
      if (ok) setAssignBranchDialog(null)
    } finally {
      setAssignBranchSaving(false)
    }
  }

  async function applyStatusMove(booking, status, extra = {}) {
    const token = await getAccessTokenFresh()
    if (!token) {
      toast.error('Sign in required')
      return
    }
    const res = await fetch('/api/booking-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ booking_id: booking.id, status, ...extra }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(body.error || 'Unable to update booking')
      return false
    }
    const label = detailingBoardStatusLabel(status) || STATUS_LABELS[status] || status
    toast.success(
      status === 'cancelled'
        ? 'Booking cancelled'
        : `Moved to ${label}${body.notify?.sms?.ok ? ' · SMS sent' : ''}`,
    )
    load()
    return true
  }

  async function confirmCrewStart() {
    if (!crewDialog) return
    const freeIds = crewSelected.filter((id) => {
      const row = crewOptions.find((m) => m.id === id)
      return row && !row.is_busy_today
    })
    if (!freeIds.length) {
      toast.error('Select at least one present crew member who is not busy.')
      return
    }
    setCrewLoading(true)
    try {
      await assignStaff(
        {
          booking_id: crewDialog.id,
          status: crewDialog.status,
          service_pay_category: crewDialog.services?.pay_category || 'detailing',
        },
        freeIds,
      )
      if (crewDialog.status !== 'waiting') {
        await applyStatusMove(crewDialog, 'in_progress')
      } else {
        toast.success('Crew assigned · service started')
        load()
      }
      setCrewDialog(null)
    } catch (err) {
      toast.error(err.message || 'Unable to assign crew')
    } finally {
      setCrewLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    const formBranches = formBranchOptions
    const defaultBranch =
      branchFilter !== 'all'
        ? branchFilter
        : preferredBranchSlug(formBranches) ||
          pickDefaultBranchSlug(profile, formBranches) ||
          formBranches[0]?.slug ||
          ''
    const defaultService =
      formServices[0]?.id || ''
    setForm({
      ...emptyBooking,
      branch: defaultBranch,
      service_id: defaultService,
      scheduled_start: `${todayISO()}T10:00`,
    })
    setCustomerLookup({ loading: false, error: '', match: null })
    setFormOpen(true)
  }

  async function lookupExistingCustomer(identifier) {
    const raw = String(identifier || '').trim()
    if (raw.length < 3) {
      setCustomerLookup({ loading: false, error: '', match: null })
      return
    }
    setCustomerLookup({ loading: true, error: '', match: null })
    try {
      const token = await getAccessTokenFresh()
      if (!token) {
        setCustomerLookup({ loading: false, error: 'Sign in required', match: null })
        return
      }
      const res = await fetch('/api/customer-auth-lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ identifier, action: 'lookup', site_origin: window.location.origin }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCustomerLookup({ loading: false, error: data.error || 'Lookup failed', match: null })
        return
      }
      const match = data.status === 'ready' || data.status === 'needs_password' ? data.customer || null : null
      setCustomerLookup({ loading: false, error: '', match })
      if (match) {
        setForm((f) => ({
          ...f,
          customer_id: match.id || null,
          customer_name: match.full_name || f.customer_name,
          customer_phone: match.phone || f.customer_phone,
        }))
      }
    } catch (err) {
      setCustomerLookup({ loading: false, error: String(err.message || err), match: null })
    }
  }

  function openEdit(booking) {
    setEditing(booking)
    setCustomerLookup({ loading: false, error: '', match: booking?.customer_id ? { id: booking.customer_id } : null })
    setForm({
      customer_name: booking.customer_name || '',
      customer_phone: booking.customer_phone || '',
      branch: booking.branch || '',
      scheduled_start: booking.scheduled_start ? booking.scheduled_start.slice(0, 16) : '',
      service_id: booking.service_id || '',
      vehicle_plate: booking.vehicle_plate || '',
      vehicle_make: booking.vehicle_make || '',
      vehicle_model: booking.vehicle_model || '',
      notes: booking.notes || '',
      status: booking.status || 'pending',
      price_pesos:
        booking.final_price_minor != null
          ? String(Number(booking.final_price_minor) / 100)
          : booking.price_minor != null
            ? String(Number(booking.price_minor) / 100)
            : '',
    })
    setFormOpen(true)
  }

  async function saveBooking(event) {
    event.preventDefault()
    if (editing ? !canEdit : !canCreate) return
    const make = form.vehicle_make.trim()
    const model = form.vehicle_model.trim()
    const serviceId = form.service_id
    if (!serviceId) {
      toast.error('Pick a detailing service.')
      return
    }
    if (!formServices.some((s) => s.id === serviceId)) {
      toast.error('Pick a detailing service: Ceramic, Paint Maintenance, Tint, or PPF.')
      return
    }
    if (!make || !model) {
      toast.error('Vehicle make and model are required.')
      return
    }
    const plateError = plateValidationError(form.vehicle_plate)
    if (plateError) {
      toast.error(plateError)
      return
    }
    if (!editing && formBookingsOnly && !['pending', 'confirmed'].includes(form.status)) {
      toast.error('New bookings start as Booking Placeholder or Assigned to Branch.')
      return
    }
    setSaving(true)
    const payload = {
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim() || null,
      customer_id: form.customer_id || null,
      branch: form.branch,
      scheduled_start: new Date(form.scheduled_start).toISOString(),
      service_id: serviceId,
      vehicle_plate: form.vehicle_plate.trim().toUpperCase() || null,
      vehicle_make: make,
      vehicle_model: model,
      notes: form.notes.trim() || null,
    }
    if (canEditServicePrice && form.price_pesos !== '') {
      const pesos = Number(String(form.price_pesos).replace(/,/g, ''))
      if (Number.isFinite(pesos) && pesos >= 0) {
        payload.final_price_minor = Math.round(pesos * 100)
      }
    }
    // Status changes write queue_events (can_manage_branch). Sales is not a queue manager —
    // create may set pending/confirmed; edits keep status and use board advance actions.
    if (!editing) payload.status = form.status
    const { error } = editing
      ? await supabase.from('bookings').update(payload).eq('id', editing.id).select('id').single()
      : await supabase.from('bookings').insert(payload).select('id').single()
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(editing ? 'Booking updated' : 'Booking created')
    setFormOpen(false)
    load()
  }

  async function archiveBooking(booking) {
    if (formBookingsOnly) {
      toast.error('Cancel with a reason — archive is Admin only.')
      return
    }
    if (!canEdit || !window.confirm('Archive this booking?')) return
    const { error } = await supabase.from('bookings').update({ is_archived: true }).eq('id', booking.id).select('id').single()
    if (error) toast.error(error.message)
    else {
      toast.success('Booking archived')
      load()
    }
  }

  if (!canAccessBookingBoard(profile)) return <Navigate to="/operations/access-denied" replace />
  if (requiresTeamLeadBranchSetup(profile)) {
    return (
      <section className="rounded-2xl border border-amber-600/30 bg-amber-500/10 p-6 text-amber-950 dark:text-amber-100" role="alert">
        Branch setup required before viewing bookings. Ask Super Admin to assign your branch.
      </section>
    )
  }

  const branchOptions = canSeeAllBranches(profile)
    ? [{ slug: 'all', name: 'All branches' }, ...formBranchOptions]
    : (getBranchScopeList(profile) || []).map((slug) => ({
        slug,
        name: branches.find((b) => b.slug === slug)?.name || slug,
      }))

  const filterBranchItems = selectItems(branchOptions.map((b) => ({ value: b.slug, label: b.name })))
  const formBranchItems = selectItems(branchSelectOptions)
  const formServiceItems = selectItems(serviceSelectOptions)
  const formStatusItems = selectItems(visibleColumns.map((c) => ({ value: c.id, label: c.label })))
  const datePresetItems = selectItems([
    { value: 'all', label: 'All dates' },
    { value: 'today', label: 'Today' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: 'year', label: 'This year' },
    { value: 'custom', label: 'Custom range' },
  ])
  const statusFilterItems = selectItems([
    { value: 'all', label: 'All statuses' },
    ...visibleColumns.map((c) => ({ value: c.id, label: c.label })),
  ])
  const kindFilterItems = selectItems([
    { value: 'detailing', label: 'Detailing (ceramic · tint · PPF)' },
  ])
  const editingNext = editing
    ? getBookingPrimaryNextStatus(editing.status, {
        canSeePayment,
        canCheckIn,
        detailingPipeline: true,
      })
    : null
  const rangeLabel =
    datePreset === 'all'
      ? 'All dates'
      : datePreset === 'upcoming'
        ? 'Upcoming'
        : !range.start || !range.end
          ? 'All dates'
          : range.start === range.end
            ? range.start
            : `${range.start} → ${range.end}`

  return (
    <section className="bk-page flex min-h-0 min-w-0 flex-col gap-4 sm:gap-5">
      <header className="bk-hero">
        <div className="bk-hero-brand">
          <img
            src="/branding/hakum-mark-blue.png"
            alt=""
            width={40}
            height={40}
            className="bk-hero-logo"
            decoding="async"
          />
          <div className="min-w-0">
            <p className="bk-hero-kicker">Hakum Auto Care</p>
            <h1 className="bk-hero-title">Bookings</h1>
            <p className="bk-hero-sub">
              {isMarketing
                ? 'Read-only detailing pipeline · ceramic · tint · PPF'
                : formBookingsOnly
                  ? 'Detailing pipeline · ceramic · tint · PPF · wash stays on Queue'
                  : `${rangeLabel} · detailing only`}
            </p>
          </div>
        </div>
        <div className="bk-hero-actions">
          {tab !== 'list' ? (
          <div className="bk-search-wrap">
            <Label htmlFor="bk-smart-search" className="sr-only">Search bookings</Label>
            <Input
              id="bk-smart-search"
              type="search"
              className="bk-smart-search min-h-11 w-full"
              placeholder="Search name, phone, plate, branch…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
          </div>
          ) : null}
          {(canSeeAllBranches(profile) || branchOptions.length > 1) && (
            <Select value={branchFilter} onValueChange={setBranchFilter} items={filterBranchItems}>
              <SelectTrigger className="min-h-11 w-full cursor-pointer sm:w-44" aria-label="Filter by branch">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                {branchOptions.map((b) => <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={datePreset} onValueChange={setDatePreset} items={datePresetItems}>
            <SelectTrigger className="min-h-11 w-full cursor-pointer sm:w-40" aria-label="Date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All dates</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="year">This year</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          {datePreset === 'custom' && (
            <>
              <Input type="date" className="min-h-11 w-full sm:w-36" aria-label="Start date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <Input type="date" className="min-h-11 w-full sm:w-36" aria-label="End date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </>
          )}
          {canCreate && (
            <Button type="button" className="min-h-11 w-full cursor-pointer sm:w-auto" onClick={openCreate}>
              New booking
            </Button>
          )}
        </div>
      </header>

      <Tabs value={tab} onValueChange={(next) => setSearchParams(next === 'board' ? {} : { tab: next }, { replace: true })} className="min-w-0">
        <TabsList className="bk-tabs flex h-auto w-full justify-stretch gap-1 p-1">
          <TabsTrigger value="board" className="min-h-11 flex-1 cursor-pointer">Board</TabsTrigger>
          <TabsTrigger value="list" className="min-h-11 flex-1 cursor-pointer">List</TabsTrigger>
          <TabsTrigger value="table" className="min-h-11 flex-1 cursor-pointer">Table</TabsTrigger>
          <TabsTrigger value="calendar" className="min-h-11 flex-1 cursor-pointer">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4 min-w-0">
          <div className="bk-board">
            <p className="bk-board-hint">Tap a card to open it. Tap a stage chip to jump columns.</p>
            <div className="bk-status-strip" role="toolbar" aria-label="Filter bookings by status">
              {visibleColumns.map((col) => {
                const active = focusedBoardStatus === col.id
                const n = grouped[col.id]?.length || 0
                return (
                  <button
                    key={col.id}
                    type="button"
                    className={cn('bk-status-chip', active && 'bk-status-chip-active')}
                    aria-pressed={active}
                    aria-controls={bookingLaneDomId(col.id)}
                    onClick={() => {
                      setBoardFilter(col.id)
                      scrollBookingLaneIntoView(col.id)
                    }}
                  >
                    <span>{col.shortLabel || col.label}</span>
                    <span className="bk-status-chip-count">{n}</span>
                  </button>
                )
              })}
            </div>

            <div className="booking-lane-board" role="region" aria-label="Booking columns">
              {visibleColumns.map((col) => {
                const laneFocused = col.id === focusedBoardStatus
                return (
                <section
                  key={col.id}
                  id={bookingLaneDomId(col.id)}
                  className={cn('floor-lane', laneFocused ? 'bk-lane-focused' : 'bk-lane-dimmed')}
                  aria-label={`${col.label} column`}
                  aria-current={laneFocused ? 'true' : undefined}
                >
                  <div className="mb-2 flex items-start justify-between gap-1">
                    <h2 className="floor-lane-title font-bold text-muted-foreground uppercase" title={col.label}>
                      {col.shortLabel || col.label}
                    </h2>
                    <Badge variant="secondary" className="shrink-0 tabular-nums text-[10px]">{grouped[col.id].length}</Badge>
                  </div>
                  <div className="floor-lane-body">
                    {grouped[col.id].map((booking) => (
                      <BookingStageTicket
                        key={booking.id}
                        booking={booking}
                        variant="lane"
                        tone={col.tone}
                        canOpen={canEdit || canEditServicePrice}
                        onOpen={openEdit}
                      />
                    ))}
                    {!grouped[col.id].length && (
                      <p className="rounded-xl border border-dashed border-border bg-background/50 p-3 text-center text-sm text-muted-foreground">
                        Empty
                      </p>
                    )}
                  </div>
                </section>
                )
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-4 min-w-0">
          <div className="bk-list">
            <div className="bk-list-toolbar">
              <div className="min-w-0">
                <p className="bk-table-count">
                  {tableSlice.total} booking{tableSlice.total === 1 ? '' : 's'}
                </p>
                <p className="bk-table-range">
                  {rangeLabel}
                  {searchQuery.trim() ? ` · “${searchQuery.trim()}”` : ''}
                </p>
              </div>
              <div className="bk-list-filters">
                <div className="bk-search-wrap">
                  <Label htmlFor="bk-list-search" className="sr-only">Search bookings</Label>
                  <Input
                    id="bk-list-search"
                    type="search"
                    className="bk-list-search min-h-11 w-full"
                    placeholder="Search name, phone, plate, branch…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter} items={statusFilterItems}>
                  <SelectTrigger id="bk-list-status" className="min-h-11 w-full cursor-pointer" aria-label="Filter by status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {visibleColumns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={kindFilter} onValueChange={setKindFilter} items={kindFilterItems}>
                  <SelectTrigger id="bk-list-kind" className="min-h-11 w-full cursor-pointer" aria-label="Service family">
                    <SelectValue placeholder="Detailing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="detailing">Detailing (ceramic · tint · PPF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bk-card-list" aria-label="Booking list">
              {tableSlice.rows.map((booking) => (
                <BookingStageTicket
                  key={booking.id}
                  booking={booking}
                  variant="list"
                  tone={visibleColumns.find((c) => c.id === booking.status)?.tone}
                  canOpen={canEdit || canEditServicePrice}
                  onOpen={openEdit}
                />
              ))}
              {!tableSlice.total ? (
                <p className="rounded-2xl border border-dashed border-border bg-background/60 p-6 text-center text-sm text-muted-foreground">
                  No bookings match this search and filters.
                </p>
              ) : null}
            </div>

            <BookingPager
              slice={tableSlice}
              pageSize={tablePageSize}
              onPageSize={setTablePageSize}
              onPage={setTablePage}
            />
          </div>
        </TabsContent>

        <TabsContent value="table" className="mt-4 min-w-0">
          <div className="bk-table">
            <div className="bk-table-toolbar">
              <div className="min-w-0">
                <p className="bk-table-count">
                  {tableSlice.total} booking{tableSlice.total === 1 ? '' : 's'}
                </p>
                <p className="bk-table-range">
                  {rangeLabel}
                  {searchQuery.trim() ? ` · “${searchQuery.trim()}”` : ''}
                </p>
              </div>
              <div className="bk-table-toolbar-filters">
                <Label htmlFor="bk-status-filter" className="sr-only">Status filter</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter} items={statusFilterItems}>
                  <SelectTrigger id="bk-status-filter" className="min-h-11 w-full cursor-pointer sm:w-48" aria-label="Filter by status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {visibleColumns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={kindFilter} onValueChange={setKindFilter} items={kindFilterItems}>
                  <SelectTrigger id="bk-table-kind" className="min-h-11 w-full cursor-pointer sm:w-44" aria-label="Service family">
                    <SelectValue placeholder="Detailing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="detailing">Detailing (ceramic · tint · PPF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Table className="bk-data-grid" aria-label="Bookings ledger">
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <BookingTableSortButton label="Customer" column="customer" sort={tableSort} onSort={toggleTableSort} />
                  </TableHead>
                  <TableHead>
                    <BookingTableSortButton label="Vehicle" column="vehicle" sort={tableSort} onSort={toggleTableSort} />
                  </TableHead>
                  <TableHead>
                    <BookingTableSortButton label="Service" column="service" sort={tableSort} onSort={toggleTableSort} />
                  </TableHead>
                  <TableHead>
                    <BookingTableSortButton label="Branch" column="branch" sort={tableSort} onSort={toggleTableSort} />
                  </TableHead>
                  <TableHead>
                    <BookingTableSortButton label="Start" column="start" sort={tableSort} onSort={toggleTableSort} />
                  </TableHead>
                  <TableHead>
                    <BookingTableSortButton label="Status" column="status" sort={tableSort} onSort={toggleTableSort} />
                  </TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableSlice.rows.map((b) => {
                  const next = getBookingPrimaryNextStatus(b.status, {
                    canSeePayment,
                    canCheckIn,
                    detailingPipeline: true,
                  })
                  const tone = visibleColumns.find((c) => c.id === b.status)?.tone
                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="font-semibold text-foreground">{b.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{b.customer_phone || 'No phone'}</div>
                      </TableCell>
                      <TableCell className="text-foreground">{bookingVehicleText(b)}</TableCell>
                      <TableCell className="font-medium text-primary">{bookingServiceText(b) || '—'}</TableCell>
                      <TableCell className="capitalize text-foreground">{branchNameBySlug[b.branch] || b.branch}</TableCell>
                      <TableCell className="tabular-nums text-foreground">{bookingTableWhen(b.scheduled_start)}</TableCell>
                      <TableCell>
                        <span className={cn('bk-status-pill', tone)}>
                          {detailingBoardStatusLabel(b.status) || STATUS_LABELS[b.status] || b.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="bk-table-actions">
                          {canAdvanceStatus && next ? (
                            <Button type="button" className="min-h-11 cursor-pointer" onClick={() => move(b, next)}>
                              {BOOKING_PRIMARY_ACTION_LABELS[next] || next}
                            </Button>
                          ) : null}
                          {canEditServicePrice ? (
                            <Button type="button" variant="outline" className="min-h-11 cursor-pointer" onClick={() => openEdit(b)}>
                              Edit
                            </Button>
                          ) : null}
                          {canEdit && !formBookingsOnly ? (
                            <Button type="button" variant="ghost" className="min-h-11 cursor-pointer" onClick={() => archiveBooking(b)}>
                              Archive
                            </Button>
                          ) : null}
                          {canCancelForm && b.status !== 'cancelled' && b.status !== 'completed' ? (
                            <Button type="button" variant="ghost" className="min-h-11 cursor-pointer text-destructive" onClick={() => setCancelTarget(b)}>
                              Cancel
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!tableSlice.total ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No bookings match this search and date range.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>

            <BookingPager
              slice={tableSlice}
              pageSize={tablePageSize}
              onPageSize={setTablePageSize}
              onPage={setTablePage}
            />
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4">
              <div className="booking-calendar planning-calendar min-h-[28rem] text-foreground [&_.rbc-toolbar]:mb-3 [&_.rbc-toolbar_button]:min-h-10 [&_.rbc-toolbar_button]:cursor-pointer [&_.rbc-toolbar_button]:rounded-md [&_.rbc-toolbar_button]:border [&_.rbc-toolbar_button]:border-border [&_.rbc-toolbar_button]:bg-background [&_.rbc-toolbar_button]:px-3 [&_.rbc-toolbar_button]:text-foreground [&_.rbc-month-view]:rounded-xl [&_.rbc-month-view]:border [&_.rbc-month-view]:border-border [&_.rbc-time-header]:min-h-12 [&_.rbc-time-header-content_.rbc-header]:min-h-11 [&_.rbc-time-header-content_.rbc-header]:flex [&_.rbc-time-header-content_.rbc-header]:items-center [&_.rbc-time-header-content_.rbc-header]:justify-center [&_.rbc-header]:border-border [&_.rbc-header]:bg-muted/50 [&_.rbc-header]:py-2 [&_.rbc-header]:text-xs [&_.rbc-header]:font-semibold [&_.rbc-header]:text-foreground [&_.rbc-off-range-bg]:bg-muted/30 [&_.rbc-today]:bg-primary/5 [&_.rbc-event]:border-0 [&_.rbc-event]:bg-primary [&_.rbc-event]:text-primary-foreground [&_.rbc-time-content]:border-border [&_.rbc-timeslot-group]:border-border [&_.rbc-day-bg]:border-border [&_.rbc-month-row]:border-border [&_.rbc-label]:text-muted-foreground">
                <BigCalendar
                  localizer={localizer}
                  events={calendarEvents}
                  defaultView={Views.WEEK}
                  views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
                  dayLayoutAlgorithm="no-overlap"
                  formats={{
                    dayFormat: (date, culture, loc) => loc.format(date, 'EEE M/d', culture),
                    dayHeaderFormat: (date, culture, loc) => loc.format(date, 'EEE MMM d', culture),
                  }}
                  style={{ minHeight: 420 }}
                  onSelectEvent={(ev) => canEdit && openEdit(ev.resource)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit booking' : 'New booking'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveBooking} className="grid gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bk-lookup">Find existing customer (phone, plate, or email)</Label>
              <Input
                id="bk-lookup"
                type="search"
                placeholder="Type to search existing customers"
                onChange={(e) => lookupExistingCustomer(e.target.value)}
                aria-describedby="bk-lookup-help"
              />
              <p id="bk-lookup-help" className="text-xs text-muted-foreground">
                {customerLookup.loading
                  ? 'Searching…'
                  : customerLookup.error
                    ? customerLookup.error
                    : customerLookup.match
                      ? `Linked: ${customerLookup.match.full_name || customerLookup.match.phone || customerLookup.match.id}`
                      : 'New customer — leave blank to create a fresh CRM row on save.'}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bk-name">Customer name</Label>
              <Input id="bk-name" required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bk-phone">Phone</Label>
              <Input id="bk-phone" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Branch</Label>
              <Select
                value={form.branch || undefined}
                onValueChange={(branch) => setForm({ ...form, branch })}
                items={formBranchItems}
              >
                <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Pick a branch" /></SelectTrigger>
                <SelectContent>
                  {branchSelectOptions.map((b) => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Service</Label>
              <Select
                value={form.service_id || undefined}
                onValueChange={(service_id) => setForm({ ...form, service_id })}
                items={formServiceItems}
              >
                <SelectTrigger className="cursor-pointer" aria-label="Service">
                  <SelectValue placeholder={formServices.length ? 'Select detailing service' : 'No detailing services loaded'} />
                </SelectTrigger>
                <SelectContent>
                  {serviceSelectOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(formBookingsOnly) ? (
                <p className="text-xs text-muted-foreground">
                  Detailing · Ceramic, Paint Maintenance, Tint, PPF — Ceramic/PPF start a 6‑month paint-maintenance reminder
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bk-start">Scheduled start</Label>
              <Input id="bk-start" type="datetime-local" required value={form.scheduled_start} onChange={(e) => setForm({ ...form, scheduled_start: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="bk-plate">Plate / sticker</Label>
                <Input id="bk-plate" required value={form.vehicle_plate} onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value.toUpperCase() })} placeholder="ABC 1234" />
                <p className="text-xs text-muted-foreground">{PLATE_FIELD_HINT}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bk-make">Make</Label>
                <Input id="bk-make" required value={form.vehicle_make} onChange={(e) => setForm({ ...form, vehicle_make: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bk-model">Model</Label>
                <Input id="bk-model" required value={form.vehicle_model} onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bk-price">Price (PHP)</Label>
              <Input
                id="bk-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price_pesos}
                onChange={(e) => setForm({ ...form, price_pesos: e.target.value })}
                placeholder="Optional · Sales overrides"
              />
              <p className="text-xs text-muted-foreground">Service and price changes stay with Sales.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              {editing && formBookingsOnly ? (
                <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                  {detailingBoardStatusLabel(form.status) || form.status}
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Use Advance below to move this booking. Additional services stay with Sales.
                  </span>
                </p>
              ) : (
                <Select value={form.status} onValueChange={(status) => setForm({ ...form, status })} items={formStatusItems}>
                  <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {visibleColumns.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bk-notes">Notes</Label>
              <Textarea id="bk-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {editing ? (
              <div className="bk-edit-stage-actions">
                {canAdvanceStatus && editingNext ? (
                  <Button
                    type="button"
                    className="min-h-11 w-full cursor-pointer sm:w-auto"
                    onClick={() => {
                      setFormOpen(false)
                      move(editing, editingNext)
                    }}
                  >
                    {BOOKING_PRIMARY_ACTION_LABELS[editingNext] || 'Advance'}
                  </Button>
                ) : null}
                {canCancelForm && editing.status !== 'cancelled' && editing.status !== 'completed' ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 w-full cursor-pointer text-destructive sm:w-auto"
                    onClick={() => {
                      setFormOpen(false)
                      setCancelTarget(editing)
                    }}
                  >
                    Cancel booking
                  </Button>
                ) : null}
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" className="cursor-pointer" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(assignBranchDialog)}
        onOpenChange={(open) => {
          if (!open) setAssignBranchDialog(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign to branch</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Send {assignBranchDialog?.customer_name || 'this booking'} to a shop. Team Lead for that branch will see it next.
          </p>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="assign-branch">Branch</Label>
            <Select
              value={assignBranchSlug || undefined}
              onValueChange={setAssignBranchSlug}
              items={formBranchItems}
            >
              <SelectTrigger id="assign-branch" className="min-h-11 w-full cursor-pointer">
                <SelectValue placeholder="Pick a branch" />
              </SelectTrigger>
              <SelectContent>
                {branchSelectOptions.map((b) => (
                  <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setAssignBranchDialog(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="cursor-pointer"
              disabled={assignBranchSaving || !assignBranchSlug}
              onClick={confirmAssignBranch}
            >
              {assignBranchSaving ? 'Assigning…' : 'Assign to branch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(crewDialog)} onOpenChange={(open) => !open && setCrewDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign present crew</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Start requires crew timed in today. Busy staff on another job stay locked.
          </p>
          {crewLoading && !crewOptions.length ? (
            <p className="py-6 text-sm text-muted-foreground">Loading present crew…</p>
          ) : (
            <div className="grid gap-2 py-2">
              {crewOptions.map((member) => {
                const checked = crewSelected.includes(member.id)
                const busy = Boolean(member.is_busy_today)
                return (
                  <label
                    key={member.id}
                    className={cn(
                      'flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 py-3',
                      checked ? 'border-primary/40 bg-primary/10' : 'border-border',
                      busy && 'opacity-55',
                    )}
                  >
                    <span>
                      <span className="block font-medium">{member.full_name}</span>
                      <span className="text-xs text-muted-foreground">{busy ? 'Busy on another job' : 'Present'}</span>
                    </span>
                    <input
                      type="checkbox"
                      className="size-5 accent-blue-600"
                      checked={checked}
                      disabled={busy || crewLoading}
                      onChange={(e) =>
                        setCrewSelected((cur) =>
                          e.target.checked ? [...cur, member.id] : cur.filter((id) => id !== member.id),
                        )
                      }
                    />
                  </label>
                )
              })}
              {!crewOptions.length ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No present crew. Have staff time in inside the 20m branch geofence first.
                </p>
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setCrewDialog(null)}>
              Cancel
            </Button>
            <Button type="button" className="cursor-pointer" disabled={crewLoading || !crewOptions.length} onClick={confirmCrewStart}>
              {crewLoading ? 'Starting…' : 'Assign & start'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CancellationReasonDialog
        open={Boolean(cancelTarget)}
        title="Cancel booking"
        loading={cancelLoading}
        onClose={() => setCancelTarget(null)}
        onConfirm={async (reason) => {
          if (!cancelTarget) return
          setCancelLoading(true)
          try {
            // Form editors (Sales/TL) cancel via booking-status API — client status
            // updates hit queue_events RLS (can_manage_branch), which Sales lacks.
            const ok = await applyStatusMove(cancelTarget, 'cancelled', {
              cancellation_reason: reason,
            })
            if (ok) setCancelTarget(null)
          } catch (err) {
            toast.error(err.message || 'Unable to cancel')
          } finally {
            setCancelLoading(false)
          }
        }}
      />
    </section>
  )
}
