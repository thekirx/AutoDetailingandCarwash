/**
 * Invariants for planning board wiring.
 * node scripts/check-planning.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

assert.equal(existsSync(join(root, 'src/pages/PlanningBoardPage.jsx')), true)
assert.equal(existsSync(join(root, 'supabase/migrations/20260726010000_planning_board.sql')), true)

const perms = read('src/auth/permissions.js')
assert.match(perms, /canViewPlanning/)
assert.match(perms, /canEditPlanning/)
assert.match(perms, /\/operations\/planning/)

const app = read('src/App.jsx')
assert.match(app, /PlanningBoardPage/)
assert.match(app, /path="planning"/)

const page = read('src/pages/PlanningBoardPage.jsx')
assert.match(page, /canEditPlanning/)
assert.match(page, /plan_boards/)
assert.match(page, /plan_checklist_items/)
assert.match(page, /BigCalendar/)

const mig = read('supabase/migrations/20260726010000_planning_board.sql')
assert.match(mig, /is_super_admin/)
assert.match(mig, /plan_cards_due_at_idx/)

console.log('check-planning: ok')
