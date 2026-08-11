/**
 * Planning UI regressions: NamedSelect labels + Button asChild polyfill.
 * Run: node tests/planningUi.test.js
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const button = readFileSync(join(root, 'src/components/ui/button.jsx'), 'utf8')
const forms = readFileSync(join(root, 'src/pages/planning/PlanningFormsSmartPanel.jsx'), 'utf8')
const board = readFileSync(join(root, 'src/pages/PlanningBoardPage.jsx'), 'utf8')
const named = readFileSync(join(root, 'src/components/ui/named-select.jsx'), 'utf8')

assert.match(button, /asChild\s*=\s*false/)
assert.match(button, /cloneElement/)
assert.doesNotMatch(button, /{\.\.\.props}\s*\/>\s*$/m)

assert.match(named, /function NamedSelect/)
assert.match(forms, />Forms</)
assert.match(forms, /staff-fill-form/)
assert.match(forms, /staff-fill-list/)
assert.match(forms, /label: f\.name/)
assert.match(forms, /label: l\.title/)
assert.match(forms, /formQrImageUrl/)
assert.doesNotMatch(forms, /New form/)
assert.doesNotMatch(forms, /openCreate/)

assert.match(board, /planning-tabs-list/)
assert.match(board, /planning-tab-hint/)
assert.match(board, /assigneeNames/)
assert.match(board, /planning-cal-filters/)
assert.match(board, /planning-cal-filter/)
assert.match(board, /planner-board-filter/)
assert.match(board, /planning-title/)
assert.match(board, /PLANNER_TABS/)
assert.match(board, /planner-board-filter/)
assert.doesNotMatch(board, /Hakum Planner/)
assert.doesNotMatch(board, /Complaints</)
assert.doesNotMatch(board, /bg-\[#111820\]/)
assert.doesNotMatch(board, /text-slate-300 uppercase/)

const branded = readFileSync(join(root, 'src/components/BrandedOpsForm.jsx'), 'utf8')
const publicForm = readFileSync(join(root, 'src/pages/PublicFormPage.jsx'), 'utf8')
assert.match(branded, /hakum-form-shell/)
assert.match(branded, /hakum-form-logo/)
assert.match(branded, /Customer preview/)
assert.match(publicForm, /BrandedOpsForm/)
assert.match(publicForm, /notify-ops-form/)
assert.match(forms, /setPreviewForm/)
assert.match(forms, /BrandedOpsForm/)

console.log('planningUi: ok')
