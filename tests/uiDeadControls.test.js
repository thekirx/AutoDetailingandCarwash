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

  it('labels final check without implying payment handoff', () => {
    assert.equal(finalCheckActionLabel(false), 'Final check')
    assert.equal(finalCheckActionLabel(true), 'Final check')
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

describe('P0 residual fixes (full-system 2026-08-01)', () => {
  it('App.jsx uses React.lazy for heavy routes (PERF-P0-1)', () => {
    const src = readFileSync(join(root, 'src/App.jsx'), 'utf8')
    assert.match(src, /lazy\(/)
    assert.match(src, /Suspense/)
    assert.match(src, /PublicLandingPage/)
  })

  it('public book uses getAccessTokenFresh (AUTH-P0-1)', () => {
    const src = readFileSync(join(root, 'src/pages/PublicUtilityPage.jsx'), 'utf8')
    assert.match(src, /getAccessTokenFresh/)
    assert.doesNotMatch(src, /getSession\(\)/)
  })

  it('ReportsPage toasts expenses/crew/comps/books errors (RPT-P0-1)', () => {
    const src = readFileSync(join(root, 'src/pages/ReportsPage.jsx'), 'utf8')
    assert.match(src, /toast\.error\(err\.message\)/)
    assert.match(src, /sales\.error/)
    assert.match(src, /crew\.error/)
    assert.match(src, /comps\.error/)
    assert.match(src, /books\.error/)
    assert.match(src, /from\('sales'\)\.select\('id'\)\.eq\('status', 'paid'\)/)
  })

  it('Memberships hides Save for non-SA (OPS-M7)', () => {
    const src = readFileSync(join(root, 'src/pages/MembershipsPage.jsx'), 'utf8')
    assert.match(src, /superAdmin \?/)
    assert.match(src, /saveServiceWeight/)
    assert.doesNotMatch(src, /disabled=\{!superAdmin\} onClick=\{\(\) => saveServiceWeight/)
  })

  it('Memberships Program tab exposes SA loyalty kill-switches', () => {
    const src = readFileSync(join(root, 'src/pages/MembershipsPage.jsx'), 'utf8')
    assert.match(src, /TabsTrigger value="program"/)
    assert.match(src, /stamps_enabled/)
    assert.match(src, /stamp_earn_mode/)
    assert.match(src, /pay_categories/)
    assert.match(src, /revokeCustomerMembership/)
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
