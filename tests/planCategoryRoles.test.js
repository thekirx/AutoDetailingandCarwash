import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  PLAN_CATEGORY_ROLE_OPTIONS,
  categoryVisibleToRole,
  filterCategoriesForRole,
  normalizeVisibleRoles,
} from '../src/lib/planCategoryRoles.js'

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
    assert.match(board, /filterCategoriesForRole/)
    assert.match(board, /visibleCategories/)
    assert.match(migration, /visible_roles text\[]/)
  })
})
