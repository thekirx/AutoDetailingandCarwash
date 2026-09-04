/**
 * Planning UI regressions: NamedSelect labels + Button asChild polyfill.
 * Run: node tests/planningUi.test.js
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
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

assert.match(board, /plannerTabsForAccess\(\{ canEdit, role/)
const plannerBoard = readFileSync(join(root, 'src/lib/plannerBoard.js'), 'utf8')
assert.match(plannerBoard, /export const PLANNER_TABS/)
assert.match(board, /PLAN_BOARDS_LIST_SELECT/)
assert.match(board, /PLAN_BOARD_DETAIL_SELECT/)
assert.match(board, /visiblePlannerBoards|pickPlannerBoard/)
assert.match(board, /b\.name/)
assert.doesNotMatch(board, /title, kind, position/)
assert.doesNotMatch(board, /b\.kind/)
assert.doesNotMatch(board, /b\.title/)
assert.match(board, /planner-v2/)
assert.match(board, /TaskModal/)
assert.match(board, /PlanningReviewPanel/)
assert.match(board, /PlanningConfigurePanel/)
assert.doesNotMatch(board, /PlanningCategoryDrawer/)
assert.match(board, /Any list/)
assert.match(board, /Settings2/)
assert.equal(existsSync(join(root, 'src/pages/planning/PlanningCategoryDrawer.jsx')), false)

const configure = readFileSync(join(root, 'src/pages/planning/PlanningConfigurePanel.jsx'), 'utf8')
assert.match(configure, /Add list/)
assert.match(configure, /Add category/)
assert.match(configure, /Save template/)
assert.match(configure, /Create board/)
assert.match(configure, /PLANNER_SWATCHES/)
assert.match(configure, /Task progress/)
assert.match(configure, /planner-configure-field/)
assert.match(configure, /reorderPlanRows/)
assert.match(configure, /nextPlanListPosition\(categories\)/)
assert.doesNotMatch(configure, /todo.*in_progress.*custom/)
assert.doesNotMatch(board, /Hakum Planner/)
assert.match(board, /planner-cal-filters/)
assert.match(board, /--planning-list-cols/)
assert.match(board, /New task/)
assert.match(board, /scheduled_start/)
assert.match(board, /cardsFromAssigneeRows/)
assert.match(board, /reviewItemsFromAssigneeRows/)
assert.doesNotMatch(board, /Hakum Planner/)
assert.doesNotMatch(board, /Complaints</)
assert.doesNotMatch(board, /PlanningSettingsPanel/)
assert.doesNotMatch(board, /bg-\[#111820\]/)
assert.doesNotMatch(board, /text-slate-300 uppercase/)

assert.match(board, /planner-skel/)
assert.match(board, /planner-ticket/)
assert.match(board, /is-today/)
assert.match(forms, /planner-forms/)
assert.match(forms, /planner-ticket/)
assert.match(
  readFileSync(join(root, 'src/pages/planning/PlanningPart6Panels.jsx'), 'utf8'),
  /planner-events/,
)
assert.match(
  readFileSync(join(root, 'src/pages/PosPage.jsx'), 'utf8'),
  /hakum-pos/,
)
assert.match(
  readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8'),
  /planner-ticket/,
)

const styles = readFileSync(join(root, 'src/styles.css'), 'utf8')
assert.match(styles, /--planner-stub:\s*#c4a35a/)
assert.match(styles, /\.planner-ticket/)
assert.match(styles, /\.planner-skel/)
assert.match(styles, /\.planner-configure/)
assert.match(styles, /\.planner-swatch/)
assert.match(styles, /\.hakum-pos/)
assert.match(styles, /prefers-reduced-motion[\s\S]*\.planner-skel/)
assert.match(styles, /\.command-shell \.ops-page-chrome[\s\S]*max-width:\s*min\(1400px,\s*100%\)/)
assert.match(styles, /\.command-shell \.ops-page-chrome[\s\S]*overflow-x:\s*hidden/)
assert.match(styles, /\.planning-lane-board[\s\S]*minmax\(0,\s*1fr\)/)
assert.match(styles, /\.planning-lane-board-scroll/)
assert.match(
  readFileSync(join(root, 'src/layouts/OperationsLayout.jsx'), 'utf8'),
  /SidebarInset className="min-w-0 overflow-x-hidden"/,
)

const branded = readFileSync(join(root, 'src/components/BrandedOpsForm.jsx'), 'utf8')
const publicForm = readFileSync(join(root, 'src/pages/PublicFormPage.jsx'), 'utf8')
assert.match(branded, /hakum-form-shell/)
assert.match(branded, /hakum-form-logo/)
assert.match(branded, /Customer preview/)
assert.match(publicForm, /BrandedOpsForm/)
assert.match(publicForm, /notify-ops-form/)
assert.match(forms, /setPreviewForm/)
assert.match(forms, /BrandedOpsForm/)

assert.match(
  readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8'),
  /planProofObjectPath/,
)
assert.match(
  readFileSync(join(root, 'src/pages/planning/TaskModal.jsx'), 'utf8'),
  /planProofObjectPath/,
)
const modal = readFileSync(join(root, 'src/pages/planning/TaskModal.jsx'), 'utf8')
assert.match(modal, /defaultPlanListId/)
assert.match(modal, /nextPlanCardPosition/)
assert.match(modal, /plannerListOptions/)
assert.match(modal, /isoToDatetimeLocalValue/)
assert.match(modal, /datetimeLocalToIso/)
assert.doesNotMatch(modal, /due_at \? String\(card\.due_at\)\.slice\(0, 16\)/)
assert.match(modal, /This board has no list/)
assert.match(modal, /planner-task-sheet/)
assert.doesNotMatch(modal, /isCreate && lists\.length > 0/)
assert.doesNotMatch(modal, /Save the task first/)
assert.doesNotMatch(modal, /from\('user_notifications'\)/)
assert.doesNotMatch(modal, /setCreatedId/)
assert.match(modal, /Assign to me/)
assert.match(modal, /Photo submission required/)
assert.match(modal, /\/api\/notify-planner/)
assert.match(modal, /toast\.success\('Task created'\)[\s\S]{0,180}onClose\(\)/)
assert.match(styles, /\.planner-task-sheet/)
assert.match(styles, /safe-area-inset-bottom/)
assert.match(
  readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8'),
  /Photo \(required\)/,
)
assert.match(
  readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8'),
  /proof_required/,
)

console.log('planningUi: ok')
