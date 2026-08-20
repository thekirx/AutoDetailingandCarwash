import { DETAILING_BOARD_STATUSES } from './detailingBoardStatuses.js'

export const BOOKING_TABLE_PAGE_SIZES = Object.freeze([10, 25, 50])
export const BOOKING_TABLE_DEFAULT_PAGE_SIZE = 10
export const QUEUE_LANE_PAGE_SIZE = 8

export function paginateRows(rows, { page = 1, pageSize = 10 } = {}) {
  const list = Array.isArray(rows) ? rows : []
  const size = Math.max(1, Number(pageSize) || 10)
  const total = list.length
  const totalPages = Math.max(1, Math.ceil(total / size) || 1)
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages)
  const start = (safePage - 1) * size
  const slice = list.slice(start, start + size)
  return {
    rows: slice,
    page: safePage,
    pageSize: size,
    total,
    totalPages,
    from: total ? start + 1 : 0,
    to: total ? start + slice.length : 0,
  }
}

const STATUS_ORDER = Object.freeze([...DETAILING_BOARD_STATUSES.map((s) => s.id), 'cancelled'])

export function bookingVehicleText(booking) {
  const car = [booking?.vehicle_make, booking?.vehicle_model].filter(Boolean).join(' ')
  if (booking?.vehicle_plate && car) return `${booking.vehicle_plate} · ${car}`
  return booking?.vehicle_plate || car || 'No vehicle details'
}

export function bookingServiceText(booking) {
  const name = booking?.services?.name || booking?.service_name
  const kind = booking?.services?.pay_category || booking?.service_pay_category
  if (!name && !kind) return null
  if (kind === 'detailing') return name ? `${name} · Detailing` : 'Detailing'
  return name || null
}

function sortText(row, key, branchNames = {}) {
  if (key === 'customer') return String(row?.customer_name || '')
  if (key === 'branch') return String(branchNames[row?.branch] || row?.branch || '')
  if (key === 'vehicle') return bookingVehicleText(row)
  if (key === 'service') return bookingServiceText(row) || ''
  return ''
}

export function compareBookingTableRows(a, b, key, dir = 'asc', branchNames = {}) {
  const mul = dir === 'desc' ? -1 : 1
  if (key === 'start') {
    const av = Date.parse(a?.scheduled_start) || 0
    const bv = Date.parse(b?.scheduled_start) || 0
    if (av === bv) return 0
    return (av < bv ? -1 : 1) * mul
  }
  if (key === 'status') {
    const av = STATUS_ORDER.indexOf(String(a?.status || ''))
    const bv = STATUS_ORDER.indexOf(String(b?.status || ''))
    const ai = av < 0 ? 99 : av
    const bi = bv < 0 ? 99 : bv
    if (ai === bi) return 0
    return (ai < bi ? -1 : 1) * mul
  }
  return sortText(a, key, branchNames).localeCompare(sortText(b, key, branchNames), undefined, {
    numeric: true,
    sensitivity: 'base',
  }) * mul
}

export function sortBookingTableRows(rows, { key = 'start', dir = 'asc', branchNames } = {}) {
  return [...(rows || [])].sort((a, b) => compareBookingTableRows(a, b, key, dir, branchNames))
}

export function paginateBookingTableRows(rows, { page = 1, pageSize = BOOKING_TABLE_DEFAULT_PAGE_SIZE } = {}) {
  const size = BOOKING_TABLE_PAGE_SIZES.includes(Number(pageSize))
    ? Number(pageSize)
    : BOOKING_TABLE_DEFAULT_PAGE_SIZE
  return paginateRows(rows, { page, pageSize: size })
}

/** Wash/packages vs multi-day detailing. Anything not detailing is same-day floor work. */
export function bookingPayKind(booking) {
  const kind = String(booking?.services?.pay_category || booking?.service_pay_category || '').toLowerCase()
  return kind === 'detailing' ? 'detailing' : 'wash'
}

export function filterBookingList(rows, { status = 'all', kind = 'all' } = {}) {
  return (rows || []).filter((row) => {
    if (status && status !== 'all' && row.status !== status) return false
    if (kind && kind !== 'all' && bookingPayKind(row) !== kind) return false
    return true
  })
}
