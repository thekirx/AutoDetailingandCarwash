/** CRUD create forms open from a button into a dialog — never an always-open card beside the list. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const PAGES = [
  ['src/pages/BranchesManagePage.jsx', 'formOpen', 'onSubmit'],
  ['src/pages/ProductsManagePage.jsx', 'createOpen', 'onCreate'],
  ['src/pages/CarsCatalogPage.jsx', 'addOpen', 'addRow'],
  ['src/pages/SmsPage.jsx', 'tplOpen', 'saveTemplate'],
  ['src/pages/MembershipsPage.jsx', "createOpen === 'tier'", 'onCreateTier'],
  ['src/pages/MembershipsPage.jsx', "createOpen === 'milestone'", 'onCreateMilestone'],
  ['src/pages/MembershipsPage.jsx', "createOpen === 'assign'", 'onAssignMembership'],
  ['src/pages/planning/PlanningPart6Panels.jsx', 'createOpen', 'createEvent'],
  ['src/pages/ServicesManagePage.jsx', 'createOpen', 'onCreate'],
  ['src/pages/finance/FinanceVendorsTab.jsx', 'createOpen', 'save'],
  ['src/pages/finance/FinanceCategoriesTab.jsx', 'createOpen', 'save'],
  ['src/pages/finance/FinanceCorporateTab.jsx', 'createOpen', 'saveBalance'],
  ['src/pages/finance/FinanceQuotesTab.jsx', 'createOpen', 'sendQuote'],
  ['src/pages/finance/FinanceExpenseReportsTab.jsx', 'createOpen', 'createAndAddLine'],
  ['src/pages/PeopleManagePage.jsx', 'roleOpen', null],
  ['src/pages/PeopleManagePage.jsx', 'tempTlOpen', 'createTempTl'],
  ['src/pages/NotificationsPage.jsx', 'ruleOpen', 'saveDraft'],
  ['src/pages/NotificationsPage.jsx', 'kindOpen', 'save'],
]

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

describe('CRUD create forms live in dialogs', () => {
  for (const [file, openExpr, handler] of PAGES) {
    it(`${file} → ${openExpr}`, () => {
      const src = read(file)
      const dialogAt = src.search(new RegExp(`<Dialog open=\\{${escape(openExpr)}\\}`))
      assert.ok(dialogAt >= 0, `${file}: create form must render inside <Dialog open={${openExpr}}>`)
      if (handler) {
        const formAt = src.indexOf(`onSubmit={${handler}}`, dialogAt)
        const closeAt = src.indexOf('</Dialog>', dialogAt)
        assert.ok(formAt > dialogAt && formAt < closeAt, `${file}: onSubmit={${handler}} must sit inside that dialog`)
      }
    })
  }
})
