import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

describe('Crew Floor branch data access', () => {
  it('adds branch-scoped read policies without granting write access', () => {
    const sql = read('supabase/migrations/20260912161238_crew_floor_read_access.sql')
    assert.match(sql, /current_user_role\(\) = 'staff'/)
    assert.match(sql, /user_has_branch_access\(branch\)/)
    assert.match(sql, /user_has_branch_access\(branch_slug\)/)
    assert.match(sql, /can_read_queue_assignment/)
    assert.doesNotMatch(sql, /for (insert|update|delete)/i)
  })

  it('does not request staff contact/login fields for a Crew observer', () => {
    const api = read('src/queue/queueApi.js')
    assert.match(api, /isCrewObserver/)
    assert.match(api, /CREW_OBSERVER_STAFF_SELECT/)
    assert.match(api, /id, full_name, role, branch_slug, is_active/)
  })

  it('does not expose sales cards or compensation to Crew', () => {
    const page = read('src/pages/OperationsPages.jsx')
    assert.match(page, /canViewFloorSales/)
    assert.match(page, /canViewCompensation/)
    const kpi = read('src/pages/KpiPage.jsx')
    assert.match(kpi, /isCrewKpi/)
    assert.match(kpi, /if \(isCrewKpi\) return/)
  })
})
