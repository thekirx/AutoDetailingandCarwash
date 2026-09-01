/**
 * Persona coverage — every ROLES slug + customer has a documented home + story file.
 * Public seams: redirectForRole, resolveAppHome, docs/user-stories.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEPRECATED_ROLES, ROLES, redirectForRole } from '../src/auth/permissions.js'
import { resolveAppHome } from '../src/lib/appShell.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const storiesDir = join(root, 'docs/user-stories')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

const EXPECTED_HOMES = Object.freeze({
  [ROLES.SUPER_ADMIN]: '/operations/console',
  [ROLES.ASSISTANT_SUPER_ADMIN]: '/operations/console',
  [ROLES.ADMIN]: '/operations/pos',
  [ROLES.OPERATIONS_LEAD]: '/operations/roadmap',
  [ROLES.TEAM_LEAD]: '/operations/queue',
  [ROLES.STAFF]: '/operations/attendance',
  [ROLES.SALES]: '/operations/bookings',
  [ROLES.MARKETING]: '/operations/crm',
  [ROLES.VIDEO_EDITOR]: '/operations/planning?tab=calendar',
  [ROLES.DETAILER]: '/operations/bookings',
  [ROLES.INVESTOR]: '/operations/finance',
})

const PERSONA_FILES = [
  'roles-matrix.md',
  'epic-role-leadership.md',
  'epic-role-branch-admin.md',
  'epic-role-team-lead.md',
  'epic-role-crew.md',
  'epic-role-operations-lead.md',
  'epic-role-video-editor.md',
  'epic-roles-detailer-sales-marketing.md',
  'epic-customer-portal.md',
  'epic-remaining-ops-pages.md',
]

describe('role persona homes (every ROLES slug)', () => {
  it('redirectForRole matches the locked home for each role', () => {
    for (const [role, home] of Object.entries(EXPECTED_HOMES)) {
      assert.equal(redirectForRole(role), home, role)
    }
    assert.equal(redirectForRole(DEPRECATED_ROLES.CASHIER), '/operations/pos')
  })

  it('ROLES object has exactly the personas we document (no silent new roles)', () => {
    const slugs = Object.values(ROLES).sort()
    assert.deepEqual(slugs, Object.keys(EXPECTED_HOMES).sort())
  })

  it('customer portal home is /account, not ops', () => {
    assert.equal(resolveAppHome({ role: 'customer' }), '/account')
  })
})

describe('user-story docs include every persona', () => {
  it('persona epic files exist', () => {
    const files = new Set(readdirSync(storiesDir))
    for (const name of PERSONA_FILES) {
      assert.ok(files.has(name), `missing ${name}`)
    }
  })

  it('roles-matrix.md lists every role slug and customer', () => {
    const matrix = read('docs/user-stories/roles-matrix.md')
    for (const slug of Object.values(ROLES)) {
      assert.match(matrix, new RegExp(`\`${slug}\``), slug)
    }
    assert.match(matrix, /`customer`/)
    assert.match(matrix, /video_editor/)
    assert.match(matrix, /operations_lead/)
    assert.match(matrix, /team_lead/)
  })

  it('README links the roles matrix and persona epics', () => {
    const readme = read('docs/user-stories/README.md')
    assert.match(readme, /roles-matrix\.md/)
    assert.match(readme, /epic-role-team-lead/)
    assert.match(readme, /epic-role-video-editor/)
    assert.match(readme, /epic-role-operations-lead/)
    assert.match(readme, /epic-role-crew/)
    assert.match(readme, /epic-customer-portal/)
    assert.match(readme, /epic-remaining-ops-pages/)
  })

  it('remaining ops pages epic covers orphan Command surfaces', () => {
    const epic = read('docs/user-stories/epic-remaining-ops-pages.md')
    for (const needle of ['memberships', 'kpi', 'history', 'settings', 'audit', 'content', 'broadcast']) {
      assert.match(epic, new RegExp(needle, 'i'), needle)
    }
  })
})
