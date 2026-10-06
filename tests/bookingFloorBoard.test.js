import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PAINT_MAINTENANCE_SERVICE_ID,
  buildMaintenanceArrivalBooking,
  openMaintenanceBookingForPlate,
} from '../src/lib/paintMaintenance.js'
import { canProcessMaintenanceArrival } from '../server/maintenanceSchedulesApi.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const service = {
  id: PAINT_MAINTENANCE_SERVICE_ID,
  price_minor: 350000,
  service_size_prices: [
    { size_slug: 'small', price_minor: 297500 },
    { size_slug: 'medium', price_minor: 350000 },
    { size_slug: 'extra_large', price_minor: 490000 },
  ],
}
const schedule = {
  id: 's1',
  plate_number: 'nka 9234',
  customer_name: 'Ana Cruz',
  customer_phone: '09171234567',
  customer_id: 'c1',
  vehicle_id: 'v1',
  branch_slug: 'bacoor',
}
const now = new Date('2026-10-06T02:00:00Z')

describe('maintenance arrival → Vehicle intake booking', () => {
  it('builds a waiting Paint Maintenance row priced by vehicle size', () => {
    const { row, error } = buildMaintenanceArrivalBooking({
      schedule,
      vehicle: { id: 'v1', vehicle_make: 'Toyota', vehicle_model: 'Hiace', vehicle_type: 'extra_large' },
      service,
      branch: 'bacoor',
      staff: { id: 'tl1', role: 'team_lead' },
      now,
    })
    assert.equal(error, undefined)
    assert.equal(row.status, 'waiting')
    assert.equal(row.waiting_at, now.toISOString())
    assert.equal(row.service_id, PAINT_MAINTENANCE_SERVICE_ID)
    assert.equal(row.vehicle_plate, 'NKA 9234')
    assert.equal(row.price_minor, 490000)
    assert.equal(row.final_price_minor, 490000)
    assert.equal(row.team_lead_id, 'tl1')
    assert.equal(row.created_by, 'tl1')
    assert.equal(row.customer_id, 'c1')
  })

  it('falls back to the last booking for car + contact; BA is not stamped as team lead', () => {
    const { row } = buildMaintenanceArrivalBooking({
      schedule: { ...schedule, customer_phone: null, customer_name: null, vehicle_id: null },
      lastBooking: { vehicle_make: 'Toyota', vehicle_model: 'Vios', vehicle_type: 'small', customer_phone: '0918', customer_name: 'Ben' },
      service,
      branch: 'bacoor',
      staff: { id: 'ba1', role: 'admin' },
      now,
    })
    assert.equal(row.vehicle_model, 'Vios')
    assert.equal(row.customer_phone, '0918')
    assert.equal(row.customer_name, 'Ben')
    assert.equal(row.price_minor, 297500)
    assert.equal(row.team_lead_id, null)
  })

  it('refuses rows the bookings table would reject (NOT NULL make/model/phone)', () => {
    const base = { schedule, service, branch: 'bacoor', staff: { id: 'x', role: 'team_lead' } }
    assert.match(buildMaintenanceArrivalBooking(base).error, /make\/model/)
    assert.match(
      buildMaintenanceArrivalBooking({
        ...base,
        schedule: { ...schedule, customer_phone: '' },
        vehicle: { vehicle_make: 'Toyota', vehicle_model: 'Vios' },
      }).error,
      /phone/,
    )
    assert.match(buildMaintenanceArrivalBooking({ ...base, branch: '' }).error, /branch/)
    assert.match(buildMaintenanceArrivalBooking({ ...base, service: null }).error, /catalog/)
  })

  it('detects a car already on the board by normalized plate (open Paint Maintenance only)', () => {
    const rows = [
      { id: 'done', vehicle_plate: 'NKA9234', status: 'completed', service_id: PAINT_MAINTENANCE_SERVICE_ID },
      { id: 'tint', vehicle_plate: 'NKA9234', status: 'waiting', service_id: 'other', services: { slug: 'nano-ceramic-tint' } },
      { id: 'open', vehicle_plate: 'NKA-9234', status: 'in_progress', services: { slug: 'paint-maintenance' } },
    ]
    assert.equal(openMaintenanceBookingForPlate(rows, 'nka 9234')?.id, 'open')
    assert.equal(openMaintenanceBookingForPlate(rows.slice(0, 2), 'NKA9234'), null)
    assert.equal(openMaintenanceBookingForPlate(rows, ''), null)
  })
})

describe('who may check a due car in', () => {
  it('TL and Branch Admin only at their own branch; SA/ASA/OL anywhere; Sales/Marketing never', () => {
    assert.equal(canProcessMaintenanceArrival({ role: 'team_lead', branch_slugs: ['bacoor'] }, 'bacoor'), true)
    assert.equal(canProcessMaintenanceArrival({ role: 'team_lead', branch_slugs: ['bacoor'] }, 'imus'), false)
    assert.equal(canProcessMaintenanceArrival({ role: 'admin', branch_slugs: ['imus', 'silang'] }, 'silang'), true)
    assert.equal(canProcessMaintenanceArrival({ role: 'admin', branch_slugs: ['imus'] }, 'bacoor'), false)
    assert.equal(canProcessMaintenanceArrival({ role: 'BossMich', branch_slugs: [] }, 'bacoor'), true)
    assert.equal(canProcessMaintenanceArrival({ role: 'operations_lead', branch_slugs: [] }, 'imus'), true)
    assert.equal(canProcessMaintenanceArrival({ role: 'sales', branch_slugs: [] }, 'bacoor'), false)
    assert.equal(canProcessMaintenanceArrival({ role: 'marketing', branch_slugs: [] }, 'bacoor'), false)
    assert.equal(canProcessMaintenanceArrival({ role: 'team_lead', branch_slugs: ['bacoor'] }, ''), false)
  })
})

describe('Bookings floor board wiring', () => {
  it('TL + Branch Admin get status cards, car cards and maintenance arrivals on the Board tab', () => {
    const page = read('src/pages/BookingBoardPage.jsx')
    const board = read('src/components/bookings/BookingFloorBoard.jsx')
    const client = read('src/lib/maintenanceSchedulesClient.js')
    assert.match(page, /const floorLayout = isTeamLead \|\| isBranchAdmin\(profile\)/)
    assert.match(page, /<BookingFloorBoard/)
    assert.match(page, /queue_number, services\(name, slug, pay_category\)/)
    assert.match(board, /qmgr-status-card/)
    assert.match(board, /MAINTENANCE_STAGE = 'maintenance'/)
    assert.match(board, /Car arrived · Start intake/)
    assert.match(client, /action: 'arrive'/)
    assert.match(client, /window\.confirm/)
    assert.match(board, /openMaintenanceBookingForPlate/)
  })

  it('TL card never offers the POS handoff or a close-out from For payment', () => {
    const page = read('src/pages/BookingBoardPage.jsx')
    assert.match(page, /isTeamLead && booking\.status === 'for_payment'\) return null/)
    assert.match(page, /isTeamLead && next === 'for_payment'\) return null/)
  })

  it('API: arrive is a floor-role action, branch-scoped, deduped, and lands on waiting', () => {
    const api = read('server/maintenanceSchedulesApi.mjs')
    assert.match(api, /ARRIVE_ROLES = new Set\(\['BossMich', 'assistant_super_admin', 'operations_lead', 'team_lead', 'admin'\]\)/)
    assert.match(api, /body\.action === 'arrive'/)
    assert.match(api, /already on the Bookings board/)
    assert.match(api, /notifyBookingStatus\(booking, 'waiting'\)/)
    assert.match(api, /canArrive: ARRIVE_ROLES\.has/)
    // Reminder POST is now branch-scoped too (BA can remind).
    assert.match(api, /if \(arriving\) \{[\s\S]*Outside your branch scope/)
  })

  it('Maintenance tab hides Ticket maintenance from roles that cannot create bookings', () => {
    const panel = read('src/components/DetailingMaintenancePanel.jsx')
    assert.match(panel, /canCreateBooking \? \(/)
    assert.match(panel, /canArrive \? \(/)
  })
})
