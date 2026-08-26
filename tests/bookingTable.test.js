import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BOOKING_TABLE_DEFAULT_PAGE_SIZE,
  QUEUE_LANE_PAGE_SIZE,
  bookingCarPlateLine,
  bookingCarText,
  bookingDetailingTypeText,
  bookingPayKind,
  bookingPlateText,
  bookingServiceText,
  bookingVehicleText,
  compareBookingTableRows,
  filterBookingList,
  paginateBookingTableRows,
  paginateRows,
  sortBookingTableRows,
} from '../src/lib/bookingTable.js'
import { isBookingBoardRow } from '../src/lib/serviceKinds.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const ana = {
  id: '1',
  customer_name: 'Ana Cruz',
  scheduled_start: '2026-08-17T02:00:00+08:00',
  branch: 'batangas',
  status: 'waiting',
  vehicle_plate: 'TGD213',
  vehicle_make: 'Honda',
  vehicle_model: 'City',
  services: { name: 'Ceramic Coating', pay_category: 'detailing' },
}
const zed = {
  id: '2',
  customer_name: 'Zed Reyes',
  scheduled_start: '2026-08-18T09:00:00+08:00',
  branch: 'bacoor',
  status: 'pending',
  vehicle_plate: 'GN446J',
  vehicle_make: 'Toyota',
  vehicle_model: 'Vios',
  services: { name: 'Premium Car Wash', pay_category: 'wash' },
}

describe('booking table ledger', () => {
  it('sorts by shop pipeline, name, and start with known fixtures', () => {
    assert.ok(compareBookingTableRows(zed, ana, 'customer', 'asc') > 0)
    assert.equal(sortBookingTableRows([zed, ana], { key: 'customer', dir: 'asc' })[0].id, '1')
    assert.equal(sortBookingTableRows([zed, ana], { key: 'start', dir: 'asc' })[0].id, '1')
    assert.equal(sortBookingTableRows([zed, ana], { key: 'status', dir: 'asc' })[0].status, 'pending')
    assert.equal(bookingPlateText(zed), 'GN446J')
    assert.equal(bookingCarText(zed), 'Toyota Vios')
    assert.equal(bookingVehicleText(zed), 'GN446J · Toyota Vios')
    assert.equal(bookingCarPlateLine(zed), 'Toyota Vios - GN446J')
    assert.equal(bookingDetailingTypeText(ana), 'Ceramic Coating')
    assert.equal(bookingServiceText(ana), 'Ceramic Coating · Detailing')
    assert.equal(isBookingBoardRow(ana), true)
    assert.equal(isBookingBoardRow(zed), false)
  })

  it('pages 13 rows at 10 per page as 1-10 of 13', () => {
    const rows = Array.from({ length: 13 }, (_, i) => ({ id: String(i + 1) }))
    const page1 = paginateBookingTableRows(rows, { page: 1, pageSize: BOOKING_TABLE_DEFAULT_PAGE_SIZE })
    assert.equal(page1.from, 1)
    assert.equal(page1.to, 10)
    assert.equal(page1.total, 13)
    assert.equal(page1.totalPages, 2)
    assert.equal(page1.rows.length, 10)
    const page2 = paginateBookingTableRows(rows, { page: 2, pageSize: 10 })
    assert.equal(page2.from, 11)
    assert.equal(page2.to, 13)
    assert.equal(page2.rows.length, 3)
    const empty = paginateBookingTableRows([], { page: 4, pageSize: 10 })
    assert.equal(empty.from, 0)
    assert.equal(empty.to, 0)
    assert.equal(empty.page, 1)
  })

  it('pages a status lane at 8 cars so a full bay does not dump every card', () => {
    assert.equal(QUEUE_LANE_PAGE_SIZE, 8)
    const rows = Array.from({ length: 13 }, (_, i) => ({ id: String(i + 1) }))
    const page1 = paginateRows(rows, { page: 1, pageSize: QUEUE_LANE_PAGE_SIZE })
    assert.equal(page1.rows.length, 8)
    assert.equal(page1.from, 1)
    assert.equal(page1.to, 8)
    assert.equal(page1.totalPages, 2)
    const page2 = paginateRows(rows, { page: 2, pageSize: QUEUE_LANE_PAGE_SIZE })
    assert.equal(page2.rows.map((r) => r.id).join(','), '9,10,11,12,13')
    assert.equal(paginateRows(rows, { page: 99, pageSize: 8 }).page, 2)
  })

  it('filters the booking list by status and wash vs detailing', () => {
    assert.equal(bookingPayKind(zed), 'wash')
    assert.equal(bookingPayKind(ana), 'detailing')
    assert.equal(filterBookingList([ana, zed], { status: 'pending' }).map((r) => r.id).join(','), '2')
    assert.equal(filterBookingList([ana, zed], { kind: 'detailing' }).map((r) => r.id).join(','), '1')
    assert.equal(filterBookingList([ana, zed], { kind: 'wash', status: 'waiting' }).length, 0)
    assert.equal(filterBookingList([ana, zed], { status: 'all', kind: 'all' }).length, 2)
  })

  it('list/table kind filter is detailing-only on Bookings', () => {
    const page = readFileSync(join(root, 'src/pages/BookingBoardPage.jsx'), 'utf8')
    assert.match(page, /isBookingBoardRow/)
    assert.match(page, /filterFloorDetailingServices/)
    assert.doesNotMatch(page, /SelectItem value="wash"/)
    assert.match(page, /useState\('detailing'\)/)
  })

  it('list tab is a searchable roster, separate from the board kanban', () => {
    const page = readFileSync(join(root, 'src/pages/BookingBoardPage.jsx'), 'utf8')
    const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
    assert.match(page, /BOOKING_TABS = \['board', 'list', 'table', 'calendar'\]/)
    assert.match(page, /TabsTrigger value="list"/)
    const boardBlock = page.slice(
      page.indexOf('TabsContent value="board"'),
      page.indexOf('TabsContent value="list"'),
    )
    const listBlock = page.slice(
      page.indexOf('TabsContent value="list"'),
      page.indexOf('TabsContent value="table"'),
    )
    assert.match(boardBlock, /booking-lane-board/)
    assert.doesNotMatch(boardBlock, /className="bk-card-list"/)
    assert.match(listBlock, /className="bk-list"/)
    assert.match(listBlock, /className="bk-card-list"/)
    assert.match(listBlock, /id="bk-list-search"/)
    assert.match(listBlock, /id="bk-list-status"/)
    assert.match(listBlock, /id="bk-list-kind"/)
    assert.match(page, /filterBookingList/)
    assert.match(css, /\.bk-list\s*\{[^}]*container-name:\s*bk-list/s)
    assert.match(css, /\.bk-list-search[^{]*\{[^}]*min-height:\s*2\.75rem/)
    assert.match(css, /\.bk-list-search[^{]*\{[^}]*font-size:\s*1rem/)
    assert.match(css, /\.booking-lane-board\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s)
    assert.match(css, /@container bk-board \(max-width: 43\.99rem\)[\s\S]*?\.bk-lane-dimmed/)
    assert.doesNotMatch(css, /\.booking-lane-board\s*\{[^}]*display:\s*none/s)
  })

  it('table tab is a Hakum data grid, not stacked cards', () => {
    const page = readFileSync(join(root, 'src/pages/BookingBoardPage.jsx'), 'utf8')
    const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
    assert.match(page, /className="bk-table"/)
    assert.match(page, /bk-data-grid/)
    assert.match(page, /bk-table-pager/)
    assert.match(page, /sortBookingTableRows/)
    assert.match(page, /paginateBookingTableRows/)
    assert.match(page, /aria-sort/)
    assert.doesNotMatch(page, /bk-table-cards md:hidden/)
    assert.doesNotMatch(page, /hidden overflow-x-auto md:block/)
    assert.match(css, /\.bk-table\s*\{[^}]*container-name:\s*bk-table/s)
    assert.match(css, /\.bk-data-grid[^{]*\{[^}]*min-width:\s*56rem/s)
    assert.match(css, /\.bk-data-grid thead th[^{]*\{[^}]*#052699/s)
    assert.match(css, /\.bk-th-sort\[aria-sort="ascending"\],\s*\.bk-th-sort\[aria-sort="descending"\]\s*\{[^}]*#c4a35a/)
  })
})
