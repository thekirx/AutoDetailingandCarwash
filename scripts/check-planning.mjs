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
// The planning calendar is its own schedule list built from plannerCalendar,
// not the react-big-calendar grid the bookings board uses. This assertion used
// to require BigCalendar here and had been failing since that split, so it was
// never wired into a script and nobody saw it rot.
// Match the import specifier exactly: a bare /plannerCalendar/ also matches a
// longer identifier, so it would pass even if the module were renamed away.
assert.match(page, /from '@\/lib\/plannerCalendar'/, 'the planner calendar must still import plannerCalendar')
assert.match(page, /hrefForCalendarItem/, 'planner calendar rows must still deep-link')
// The video editor lands on ?tab=calendar, so that tab has to exist.
assert.match(page, /calendar/, 'the planner calendar tab must remain')
// plannerCalendar is the click-through layer: every calendar row must point at
// a real surface rather than dropping the user back on the calendar.
const plannerCalendar = read('src/lib/plannerCalendar.js')
for (const target of ['/operations/planning', '/operations/bookings']) {
  assert.match(plannerCalendar, new RegExp(target.replace(/\//g, '\\/')), `planner calendar must link to ${target}`)
}

const mig = read('supabase/migrations/20260726010000_planning_board.sql')
assert.match(mig, /is_super_admin/)
assert.match(mig, /plan_cards_due_at_idx/)

console.log('check-planning: ok')
