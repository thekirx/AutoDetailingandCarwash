import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyPublicBookPrefill,
  canOfferPasswordEmailReset,
  finalCheckActionLabel,
  matchServiceIdByPrefillName,
  seedBookingFromVehicle,
  showQueueRedoAction,
  showQueueTicketEditActions,
} from '../src/lib/uiDeadControls.js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('Queue ticket dead controls (OPS-H1/H2/H3)', () => {
  it('hides edit actions when cannot manage queue', () => {
    assert.equal(showQueueTicketEditActions(false), false)
    assert.equal(showQueueTicketEditActions(true), true)
  })

  it('hides redo unless redo lane allowed', () => {
    assert.equal(showQueueRedoAction(false), false)
    assert.equal(showQueueRedoAction(true), true)
  })

  it('labels final check without POS for non-POS roles', () => {
    assert.equal(finalCheckActionLabel(false), 'Move to final check')
    assert.equal(finalCheckActionLabel(true), 'Final check → POS')
  })
})

describe('Public book prefill (PUB-1)', () => {
  it('captures PPF package state for form seeding', () => {
    const next = applyPublicBookPrefill(
      { service_id: '' },
      { service: 'Paint Protection Film', package: 'Platinum', packageId: 'platinum', coverageType: 'Full', filmThickness: '8mil' },
    )
    assert.equal(next._prefServiceName, 'Paint Protection Film')
    assert.match(next._prefNotes, /Platinum/)
  })

  it('matches service id by prefill name', () => {
    const id = matchServiceIdByPrefillName(
      [{ id: 's1', name: 'Paint Protection Film' }, { id: 's2', name: 'Wash' }],
      'Paint Protection Film',
    )
    assert.equal(id, 's1')
  })
})

describe('Garage book seeds chosen vehicle (PUB-3)', () => {
  it('prefers the selected vehicle over vehicles[0]', () => {
    const seeded = seedBookingFromVehicle(
      { vehicle_plate: 'AAA' },
      { plate_number: 'BBB123', vehicle_make: 'Toyota', vehicle_model: 'Vios', vehicle_type: 'small' },
    )
    assert.equal(seeded.vehicle_plate, 'BBB123')
    assert.equal(seeded.vehicle_make, 'Toyota')
  })
})

describe('Password email reset offer (PUB-2)', () => {
  it('denies phone/plate/synthetic emails', () => {
    assert.equal(canOfferPasswordEmailReset('phone'), false)
    assert.equal(canOfferPasswordEmailReset('c0917@customers.hakumautocare.com'), false)
    assert.equal(canOfferPasswordEmailReset('you@email.com'), true)
  })
})

describe('CRM ticket link uses queue view capability (OPS-H4)', () => {
  it('CrmPage gates Ticket with canViewQueueOperations', () => {
    const src = readFileSync(join(root, 'src/pages/CrmPage.jsx'), 'utf8')
    assert.match(src, /canViewQueueOperations/)
    assert.doesNotMatch(src, /profile\?\.role === 'BossMich' \|\| profile\?\.role === 'team_lead' \|\| profile\?\.role === 'admin'/)
  })
})

describe('Orphan ops pages removed (OPS-M9)', () => {
  it('DashboardPage CalendarPage MasterlistPage AdminPages are gone', () => {
    const { existsSync } = awaitImportFs()
    assert.equal(existsSync(join(root, 'src/pages/DashboardPage.jsx')), false)
    assert.equal(existsSync(join(root, 'src/pages/CalendarPage.jsx')), false)
    assert.equal(existsSync(join(root, 'src/pages/MasterlistPage.jsx')), false)
    assert.equal(existsSync(join(root, 'src/pages/AdminPages.jsx')), false)
  })
})

function awaitImportFs() {
  return { existsSync: (p) => {
    try {
      readFileSync(p)
      return true
    } catch {
      return false
    }
  } }
}
