import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canViewQueueBoard,
  getOperationsNav,
  groupOperationsNav,
  ROLES,
} from '../src/auth/permissions.js'
import { catalogLineKind } from '../src/lib/serviceKinds.js'
import { matchServiceIdByPrefillName } from '../src/lib/uiDeadControls.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('UAT regression fixes: nav grouping & queue board access', () => {
  it('coalesces groupOperationsNav so no role produces duplicate group IDs', () => {
    const rolesToCheck = [
      ROLES.SUPER_ADMIN,
      ROLES.ASSISTANT_SUPER_ADMIN,
      ROLES.ADMIN,
      ROLES.OPERATIONS_LEAD,
      ROLES.TEAM_LEAD,
      ROLES.SALES,
      ROLES.MARKETING,
      ROLES.INVESTOR,
      ROLES.STAFF,
    ]
    for (const role of rolesToCheck) {
      const profile = {
        role,
        branch_slug: 'bacoor',
        branch_slugs: ['bacoor', 'batangas'],
      }
      const nav = getOperationsNav(profile)
      const groups = groupOperationsNav(nav)
      const ids = groups.map((g) => g.id)
      assert.equal(new Set(ids).size, ids.length, `duplicate group id for role=${role}: ${ids.join(', ')}`)
      assert.equal(groups.reduce((n, g) => n + g.items.length, 0), nav.length)
    }
  })

  it('allows Marketing and Investor onto the read-only Queue Board view', () => {
    assert.equal(canViewQueueBoard({ role: ROLES.MARKETING }), true)
    assert.equal(canViewQueueBoard({ role: ROLES.INVESTOR }), true)
  })
})

describe('Services, packages & detailing backend parity', () => {
  it('classifies all real PPF packages as ppf and real Ceramic/Tint as detailing', () => {
    for (const slug of [
      'ppf-high-impact',
      'ppf-basic',
      'ppf-ultimate',
      'ppf-platinum',
      'colored-ppf-package',
      'satin-matte-ppf-package',
    ]) {
      assert.equal(catalogLineKind({ itemType: 'service', payCategory: 'detailing', slug }), 'ppf', slug)
    }
    for (const slug of [
      'ultimate-ceramic-coating',
      'platinum-ceramic-coating',
      'ceramic-paint-maintenance',
      'nano-ceramic-tint',
      'nano-ceramic-pro-tint',
      'nano-ceramic-pro-black-series-tint',
    ]) {
      assert.equal(catalogLineKind({ itemType: 'service', payCategory: 'detailing', slug }), 'detailing', slug)
      assert.equal(catalogLineKind({ itemType: 'service', payCategory: 'general', slug }), 'detailing', `${slug} general fallback`)
    }
    assert.equal(catalogLineKind({ itemType: 'service', payCategory: 'package', slug: 'paint-refresh-package' }), 'package')
  })

  it('matches active PPF and Ceramic packages from landing CTA prefill state', () => {
    const parents = [
      { id: 'u1', slug: 'ultimate-ceramic-coating', name: 'Ultimate Ceramic Coating' },
      { id: 'p1', slug: 'ppf-high-impact', name: 'Front PPF + Coating Package' },
      { id: 'p2', slug: 'ppf-basic', name: 'Basic PPF Package' },
      { id: 'p3', slug: 'ppf-platinum', name: 'Platinum PPF Package' },
    ]
    assert.equal(matchServiceIdByPrefillName(parents, 'Paint Protection Film', 'basic'), 'p2')
    assert.equal(matchServiceIdByPrefillName(parents, 'Paint Protection Film', 'high-impact'), 'p1')
    assert.equal(matchServiceIdByPrefillName(parents, 'Paint Protection Film', 'platinum'), 'p3')
    assert.equal(matchServiceIdByPrefillName(parents, 'Ceramic Coating'), 'u1')
  })

  it('hardens paint-refresh-package XL pricing, catalog_line_kind order, and package hierarchy guards in SQL + server', () => {
    const mig = readFileSync(
      join(root, 'supabase/migrations/20261115223000_services_packages_detailing_backend_hardening.sql'),
      'utf8',
    )
    assert.match(mig, /paint-refresh-package/)
    assert.match(mig, /650000/)
    assert.match(mig, /services_parent_service_id_idx/)
    assert.match(mig, /validate_service_package_links/)
    assert.match(mig, /services_no_self_parent/)
    assert.match(mig, /s\.is_active\s+AND NOT s\.is_archived/)

    const publicBook = readFileSync(join(root, 'server/publicBook.mjs'), 'utf8')
    assert.match(publicBook, /is_archived.*parent_service_id/s)
    assert.match(publicBook, /svc\.is_archived === true/)

    const portal = readFileSync(join(root, 'server/customerPortal.mjs'), 'utf8')
    assert.match(portal, /svc\.is_archived === true/)
    assert.match(portal, /parent_service_id/)
  })
})
