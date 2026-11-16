import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  PLAN_CATEGORY_ROLE_OPTIONS,
  categoryVisibleToRole,
  filterCategoriesForRole,
  formatRoleLabels,
  normalizeVisibleRoles,
  roleLabelForId,
} from '../src/lib/planCategoryRoles.js'
import { describeBoardVisibility } from '../src/lib/plannerBoard.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('plan category visible_roles (Michi C13)', () => {
  it('empty visible_roles means every role', () => {
    assert.equal(categoryVisibleToRole({ visible_roles: [] }, 'staff'), true)
    assert.equal(categoryVisibleToRole({ visible_roles: null }, 'team_lead'), true)
    assert.equal(categoryVisibleToRole({}, 'admin'), true)
  })

  it('restricts to listed roles only', () => {
    const cat = { id: '1', visible_roles: ['staff', 'team_lead'] }
    assert.equal(categoryVisibleToRole(cat, 'staff'), true)
    assert.equal(categoryVisibleToRole(cat, 'team_lead'), true)
    assert.equal(categoryVisibleToRole(cat, 'admin'), false)
    assert.equal(categoryVisibleToRole(cat, null), false)
    assert.deepEqual(
      filterCategoriesForRole([{ id: 'a', visible_roles: ['staff'] }, { id: 'b', visible_roles: [] }], 'staff').map(
        (c) => c.id,
      ),
      ['a', 'b'],
    )
  })

  it('normalizes unknown role ids out', () => {
    assert.deepEqual(normalizeVisibleRoles(['staff', 'nope', 'BossMich', 'staff']), ['staff', 'BossMich'])
    assert.ok(PLAN_CATEGORY_ROLE_OPTIONS.some((r) => r.id === 'operations_lead'))
  })

  it('configure panel and board filter use visible_roles', () => {
    const configure = readFileSync(join(root, 'src/pages/planning/PlanningConfigurePanel.jsx'), 'utf8')
    const board = readFileSync(join(root, 'src/pages/PlanningBoardPage.jsx'), 'utf8')
    const migration = readFileSync(
      join(root, 'supabase/migrations/20261019170000_plan_category_visible_roles.sql'),
      'utf8',
    )
    assert.match(configure, /visible_roles/)
    assert.match(configure, /RoleChecks/)
    assert.match(configure, /describeBoardVisibility/)
    assert.match(configure, /Unsaved changes/)
    assert.match(board, /filterCategoriesForRole/)
    assert.match(board, /visibleCategories/)
    assert.match(migration, /visible_roles text\[]/)
  })

  it('formats human role labels and accurately describes board visibility states', () => {
    assert.equal(roleLabelForId('BossMich'), 'Super Admin')
    assert.equal(roleLabelForId('assistant_super_admin'), 'ASA')
    assert.deepEqual(formatRoleLabels(['staff', 'BossMich']), ['Crew', 'Super Admin'])

    const openBoard = describeBoardVisibility({ id: '1', name: 'Planner', visible_roles: [] }, PLAN_CATEGORY_ROLE_OPTIONS)
    assert.equal(openBoard.mode, 'all')
    assert.equal(openBoard.isLegacyDefault, false)
    assert.equal(openBoard.effectiveRoleIds.length, PLAN_CATEGORY_ROLE_OPTIONS.length)

    const cashBoard = describeBoardVisibility(
      { id: '2', name: 'Employee Cash Advance', visible_roles: [] },
      PLAN_CATEGORY_ROLE_OPTIONS,
    )
    assert.equal(cashBoard.mode, 'legacy_cash_advance')
    assert.equal(cashBoard.isLegacyDefault, true)
    assert.ok(cashBoard.hiddenRoleIds.includes('team_lead'))
    assert.ok(!cashBoard.effectiveRoleIds.includes('team_lead'))
    assert.ok(cashBoard.effectiveRoleIds.includes('BossMich'))

    const restricted = describeBoardVisibility(
      { id: '3', name: 'Custom Board', visible_roles: ['BossMich', 'operations_lead'] },
      PLAN_CATEGORY_ROLE_OPTIONS,
    )
    assert.equal(restricted.mode, 'custom')
    assert.deepEqual(restricted.effectiveRoleIds, ['BossMich', 'operations_lead'])
    assert.ok(restricted.hiddenRoleIds.includes('staff'))
  })
})
