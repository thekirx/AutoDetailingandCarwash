/**
 * Regression guards for the Deep System Frontend Audit (all 13 roles).
 * Covers P0/P1/P2 invariants verified across Customer App, Auth, Public System pages,
 * FloorAppShell, CommandShell, Finance, Planning, Notifications, Payroll, Inventory, and Bookings.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPublicInquiryRow } from '../server/publicInquiry.mjs'
import {
  getDetailerMore,
  getMarketingMore,
  getSalesMore,
  getVideoEditorMore,
} from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

test('Routing & Shell Boundaries: /operations/* and /account/* 404s + OpsErrorBoundary + /shop BREDESIGN', () => {
  const app = read('src/App.jsx')
  assert.match(app, /<Route path="\/account\/pickup" element=\{<Navigate to="\/account" replace \/>\} \/>/)
  assert.match(app, /<Route path="\/account\/\*" element=\{<CustomerNotFoundPage \/>\} \/>/)
  assert.match(app, /<Route path="\*" element=\{<OpsNotFoundPage \/>\} \/>/)
  assert.equal(app.includes('operations/console'), false, 'src/App.jsx must never include legacy operations/console path')

  const layout = read('src/layouts/OperationsLayout.jsx')
  const boundaryMatches = layout.match(/<OpsErrorBoundary\b/g) || []
  assert.equal(boundaryMatches.length, 2, 'Both FloorAppShell and CommandShell must wrap <Outlet /> in OpsErrorBoundary')

  const pubLayout = read('src/layouts/PublicLayout.jsx')
  assert.match(pubLayout, /'\/shop'/, 'PublicLayout BREDESIGN_ROUTES must include /shop')
})

test('FloorAppShell More menus expose Payslips and Attendance for Sales, Marketing, Detailer, Video Editor', () => {
  assert.ok(getSalesMore().some((i) => i.to === '/operations/payslips'))
  assert.ok(getMarketingMore({ role: 'marketing' }).some((i) => i.to === '/operations/payslips'))
  assert.ok(getDetailerMore().some((i) => i.to === '/operations/payslips'))
  assert.ok(getVideoEditorMore().some((i) => i.to === '/operations/attendance'))
  assert.ok(getVideoEditorMore().some((i) => i.to === '/operations/payslips'))
})

test('Complaint builder requires valid PH mobile number and embeds contact safely in description', () => {
  const missingPhone = buildPublicInquiryRow('complaint', {
    customerName: 'Juan Dela Cruz',
    category: 'Service quality',
    description: 'Missing phone check',
  })
  assert.match(missingPhone.error || '', /mobile number/i)

  const shortPhone = buildPublicInquiryRow('complaint', {
    customerName: 'Juan Dela Cruz',
    customerPhone: '0917',
    category: 'Service quality',
    description: 'Too short',
  })
  assert.match(shortPhone.error || '', /valid Philippine mobile/i)

  const valid = buildPublicInquiryRow('complaint', {
    customerName: 'Juan Dela Cruz',
    customerPhone: '09171234567',
    customerEmail: 'juan@example.com',
    branch: 'bacoor',
    category: 'Service quality',
    description: 'Swirl marks noticed after wash',
  })
  assert.equal(valid.table, 'complaints')
  assert.match(valid.row.description, /^\[Contact: 09171234567 · juan@example\.com\]/)
  assert.match(valid.row.description, /Swirl marks noticed after wash/)
})

test('Finance uses NamedSelect instead of raw <Select><option> and deduplicates pinned More tabs', () => {
  for (const rel of [
    'src/pages/finance/FinanceCategoriesTab.jsx',
    'src/pages/finance/FinanceAccountDialog.jsx',
    'src/pages/finance/FinancePurchasesTab.jsx',
  ]) {
    const src = read(rel)
    assert.match(src, /NamedSelect/, `${rel} should use NamedSelect`)
    assert.doesNotMatch(src, /<Select\b[^>]*>[\s\S]*?<option\b/, `${rel} must not nest <option> inside Base-UI <Select>`)
  }
  const finPage = read('src/pages/FinancePage.jsx')
  assert.match(finPage, /PINNED_MORE_IDS\s*=\s*new Set\(\['categories', 'salaries', 'approvals'\]\)/)
  assert.match(finPage, /if\s*\(error\)\s*throw error/)
})

test('Customer App & Auth regressions stay fixed (.capp-vote-btn, returnPath, timers cleanup, retry)', () => {
  const custAcc = read('src/pages/CustomerAccountPage.jsx')
  assert.doesNotMatch(custAcc, /["'\s]capp-thumb["'\s]/, 'CustomerAccountPage must use .capp-vote-btn instead of .capp-thumb collision')
  assert.match(custAcc, /capp-vote-btn/)
  assert.match(custAcc, /pendingPickups/)

  const signIn = read('src/pages/CustomerSignInPage.jsx')
  assert.match(signIn, /<Navigate to=\{returnPath\} replace \/>/)
  assert.match(signIn, /justSignedUp/)

  const setPw = read('src/pages/CustomerSetPasswordPage.jsx')
  assert.match(setPw, /timersRef\.current/)
  assert.match(setPw, /clearTimeout/)
})

test('Planning, Inventory, Payroll, Bookings, and Ops ConfirmDialog regressions stay fixed', () => {
  const part6 = read('src/pages/planning/PlanningPart6Panels.jsx')
  assert.match(part6, /initialValue=\{studioDraft\}/)
  assert.match(part6, /forms=\{opsForms\}/)

  const inv = read('src/pages/InventoryPage.jsx')
  assert.match(inv, /useState\(true\)\s*\/\/\s*fail-closed|const \[crudLocked, setCrudLocked\] = useState\(true\)/)

  const prod = read('src/pages/ProductsManagePage.jsx')
  assert.match(prod, /const rawQty = String\(branchQtyDraft\[dk\] \?\? ''\)\.trim\(\)/)

  const booking = read('src/pages/BookingBoardPage.jsx')
  assert.match(booking, /canAdvanceStatus/)
  assert.match(booking, /ConfirmDialog/)

  const notifSettings = read('src/pages/notifications/NotificationSettingsPanel.jsx')
  assert.match(notifSettings, /disabled=\{runningJob !== null \|\| !canEdit\}/)
  assert.match(notifSettings, /ConfirmDialog/)

  const notifTemplates = read('src/pages/notifications/NotificationTemplatesPanel.jsx')
  assert.match(notifTemplates, /id: 'other', label: 'Other'/)

  const emptyState = read('src/components/ops/OpsEmptyState.jsx')
  assert.match(emptyState, /\{action \|\| \(onAction && actionLabel\) \?/)

  const dataTable = read('src/components/ops/DataTable.jsx')
  assert.match(dataTable, /loading = false/)
  assert.match(dataTable, /<Skeleton\b/)

  const auditLog = read('src/pages/AuditLogPage.jsx')
  assert.match(auditLog, /loading=\{loading\}/)
  assert.match(auditLog, /loadError/)

  const dataCenter = read('src/pages/DataCenterPage.jsx')
  assert.match(dataCenter, /setPurgeConfirm\(''\)/)
  assert.match(dataCenter, /loadError/)

  const chatbotSettings = read('src/pages/settings/ChatbotSettingsPage.jsx')
  assert.match(chatbotSettings, /syncFromSettings\(previous\)/)

  const vouchers = read('src/pages/VouchersPage.jsx')
  assert.match(vouchers, /\.eq\('is_archived', false\)/)

  const customerMore = read('src/pages/CustomerMorePage.jsx')
  assert.doesNotMatch(customerMore, /phone number and PIN/i)
  assert.match(customerMore, /const \[removing, setRemoving\] = useState\(false\)/)

  const systemOpsFiles = [
    'src/pages/BookingBoardPage.jsx',
    'src/pages/PosPage.jsx',
    'src/pages/OperationsPages.jsx',
    'src/pages/PeopleManagePage.jsx',
    'src/pages/BranchesManagePage.jsx',
    'src/pages/SmsPage.jsx',
    'src/pages/NotificationsPage.jsx',
    'src/pages/notifications/NotificationSettingsPanel.jsx',
    'src/pages/notifications/NotificationTemplatesPanel.jsx',
    'src/pages/planning/PlanningConfigurePanel.jsx',
    'src/pages/planning/TaskModal.jsx',
    'src/pages/MembershipsPage.jsx',
    'src/components/content/ContentStudioModal.jsx',
    'src/lib/maintenanceSchedulesClient.js',
  ]
  for (const rel of systemOpsFiles) {
    const src = read(rel)
    assert.doesNotMatch(src, /window\.confirm/, `${rel} must use ConfirmDialog rather than window.confirm`)
  }
})
