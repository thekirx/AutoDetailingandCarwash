import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  ROLES,
  allowRoute,
  allowedBookingViews,
  canAccessFloorBoard,
  getOperationsNav,
  getTeamLeadDock,
} from '../src/auth/permissions.js'
import { groupServicesByKind } from '../src/lib/serviceKinds.js'
import { applyPlateSuggestion, clearPlateMatch } from '../src/lib/plateSuggest.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tl = { role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' }
const ALL_VIEWS = ['board', 'list', 'table', 'calendar', 'maintenance'].map((id) => ({ id }))

describe('TL has no Floor Board', () => {
  it('route, dock and nav hide /operations/dashboard for TL only', () => {
    assert.equal(canAccessFloorBoard(tl), false)
    assert.equal(allowRoute(tl, 'dashboard'), false)
    assert.equal(allowRoute(tl, 'queue'), true)
    assert.equal(getTeamLeadDock(tl).some((i) => i.to === '/operations/dashboard'), false)
    assert.equal(getOperationsNav(tl).some((i) => i.to === '/operations/dashboard'), false)
  })

  it('owner, crew and branch admin keep the Floor Board', () => {
    assert.equal(allowRoute({ role: ROLES.SUPER_ADMIN }, 'dashboard'), true)
    assert.equal(allowRoute({ role: ROLES.STAFF, branch_slug: 'bacoor' }, 'dashboard'), true)
    assert.equal(allowRoute({ role: ROLES.ADMIN, branch_slug: 'bacoor' }, 'dashboard'), true)
  })
})

describe('TL Bookings views', () => {
  it('TL sees only Board and Calendar', () => {
    assert.deepEqual(allowedBookingViews(tl, ALL_VIEWS).map((v) => v.id), ['board', 'calendar'])
  })

  it('other roles keep every view', () => {
    assert.deepEqual(allowedBookingViews({ role: ROLES.SUPER_ADMIN }, ALL_VIEWS), ALL_VIEWS)
    assert.deepEqual(allowedBookingViews({ role: ROLES.MARKETING }, ALL_VIEWS), ALL_VIEWS)
  })
})

describe('combined service + package picker', () => {
  const catalog = [
    { id: 'w', name: 'Premium Wash', pay_category: 'wash' },
    { id: 'p', name: 'Wash + Wax Package', pay_category: 'package' },
    { id: 'a', name: 'Engine Wash', pay_category: 'addon' },
    { id: 'd', name: 'Ceramic Coating', pay_category: 'detailing' },
  ]

  it('groups services and packages in one list, skipping detailing', () => {
    const groups = groupServicesByKind(catalog, ['service', 'package'])
    assert.deepEqual(groups.map((g) => g.id), ['service', 'package'])
    assert.deepEqual(groups[0].rows.map((r) => r.id), ['w', 'a'])
    assert.deepEqual(groups[1].rows.map((r) => r.id), ['p'])
  })

  it('search filters across both kinds and drops empty groups', () => {
    const groups = groupServicesByKind(catalog, ['service', 'package'], 'wax')
    assert.deepEqual(groups.map((g) => g.id), ['package'])
    assert.deepEqual(groupServicesByKind(catalog, ['service', 'package'], 'zzz'), [])
  })
})

describe('plate autofill without name fields', () => {
  it('retyping the plate clears the previous match identity', () => {
    const matched = applyPlateSuggestion(
      { vehicle_plate: 'ABC', customer_phone: '' },
      { vehicle_id: 'v1', customer_id: 'c1', plate_number: 'ABC 1234', customer_name: 'Ana Cruz', customer_phone: '09171234567' },
    )
    const next = clearPlateMatch(matched)
    assert.equal(next.vehicle_id, '')
    assert.equal(next.customer_id, '')
    assert.equal(next.customer_name, '')
    assert.equal(next.customer_first_name, '')
    assert.equal(next.customer_last_name, '')
    assert.equal(next.customer_phone, '09171234567')
  })

  it('an unmatched form is returned unchanged', () => {
    const form = { vehicle_id: '', vehicle_plate: 'ABC1' }
    assert.equal(clearPlateMatch(form), form)
  })
})

describe('TL add-queue form contract', () => {
  const page = readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8')
  const start = page.indexOf('export function NewQueueTicketPage')
  const form = page.slice(start, page.indexOf('export function CrewPage'))
  const picker = readFileSync(join(root, 'src/components/ServiceKindPicker.jsx'), 'utf8')

  it('clears the match when the plate is retyped', () => {
    assert.match(form, /clearPlateMatch\(next\)/)
  })

  it('picker is one grouped list, not kind tabs', () => {
    assert.match(picker, /groupServicesByKind/)
    assert.doesNotMatch(picker, /role="tab"/)
  })
})
