import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FLOOR_DETAILING_SERVICE_SLUGS,
  filterFloorDetailingServices,
  serviceKindFromPayCategory,
} from '../src/lib/serviceKinds.js'
import { crewRequiredForPayCategory } from '../src/queue/queueLogic.js'
import { getTeamLeadDock, ROLES } from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('TL floor + detailing catalog', () => {
  it('exposes the floor detailing SKUs and requires crew', () => {
    assert.deepEqual(FLOOR_DETAILING_SERVICE_SLUGS, [
      'ceramic-coating',
      'paint-maintenance',
      'nano-ceramic-tint',
      'paint-protection-film',
    ])
    for (const slug of FLOOR_DETAILING_SERVICE_SLUGS) {
      assert.equal(serviceKindFromPayCategory('detailing'), 'detailing')
      assert.equal(crewRequiredForPayCategory('detailing'), true, slug)
    }
    assert.equal(crewRequiredForPayCategory('package'), false)
    assert.equal(crewRequiredForPayCategory('ppf'), false)
  })

  it('filters form catalog to preferred detailing rows in slug order', () => {
    const rows = [
      { id: 'x', slug: 'premium-car-wash', pay_category: 'general', name: 'Wash' },
      { id: '3', slug: 'paint-protection-film', pay_category: 'detailing', name: 'PPF' },
      { id: '1', slug: 'ceramic-coating', pay_category: 'detailing', name: 'Ceramic' },
      { id: '4', slug: 'paint-maintenance', pay_category: 'detailing', name: 'Paint Maint' },
      { id: '2', slug: 'nano-ceramic-tint', pay_category: 'detailing', name: 'Tint' },
    ]
    assert.deepEqual(
      filterFloorDetailingServices(rows).map((r) => r.slug),
      FLOOR_DETAILING_SERVICE_SLUGS,
    )
  })

  it('TL dock uses Floor label — bookings stay Sales/Marketing', () => {
    const dock = getTeamLeadDock({ role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' })
    assert.ok(dock.some((i) => i.label === 'Floor' && i.to === '/operations/dashboard'))
    assert.equal(dock.some((i) => i.to === '/operations/bookings'), false)
    assert.ok(dock.some((i) => i.to === '/operations/queue'))
  })

  it('TL dashboard stays queue summary + branch sales only', () => {
    const page = readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8')
    assert.match(page, /isTeamLeadFloor/)
    assert.match(page, /Jobs on your branch/)
    assert.match(page, /Sales total/)
    assert.match(page, /Paid sales ·/)
    assert.match(page, /!isTeamLeadFloor \? \(/)
    assert.match(page, /Crew Availability/)
    assert.match(page, /Queue Activity Logs/)
  })

  it('bookings form validates detailing catalog for TL/Sales', () => {
    const page = readFileSync(join(root, 'src/pages/BookingBoardPage.jsx'), 'utf8')
    assert.match(page, /filterFloorDetailingServices/)
    assert.match(page, /Ceramic, Paint Maintenance, Tint, or PPF/)
    assert.match(page, /Select at least one present crew member who is not busy/)
    assert.match(page, /service_pay_category: crewDialog\.services\?\.pay_category/)
  })

  it('seed + migration keep detailing rows and crew present on branch', () => {
    const seed = readFileSync(join(root, 'scripts/seed-floor-accounts.mjs'), 'utf8')
    const migration = readFileSync(
      join(root, 'supabase/migrations/20260808210000_floor_detailing_services.sql'),
      'utf8',
    )
    assert.match(seed, /seedFloorDetailingServices/)
    assert.match(seed, /ceramic-coating/)
    assert.match(seed, /paint-maintenance/)
    assert.match(seed, /markPresent/)
    assert.match(seed, /Crew One/)
    assert.match(migration, /pay_category.*detailing|detailing/)
    assert.match(migration, /paint-protection-film/)
  })
})
