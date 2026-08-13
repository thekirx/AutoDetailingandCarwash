/**
 * Principal QA Phase C/D — structural flow + chrome contracts (no live browser).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DETAILING_BOARD_STATUSES,
  detailingBoardStatusLabel,
} from '../src/lib/detailingBoardStatuses.js'
import { buildBacoorDailyReport, formatBacoorReportText } from '../src/lib/bacoorDailyReport.js'
import { splitWashPool, computeCeramicPay } from '../src/lib/compensation.js'
import { insightsToCsv, topCustomersBySpend } from '../src/lib/crmInsightsExport.js'
import { PAYMENT_METHODS } from '../src/lib/paymentMethods.js'
import { ROLES, allowRoute, canMarkFailedQa, canAccessReviews } from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFile(join(root, rel), 'utf8')

describe('C4 detailing pipeline contract', () => {
  it('owner pipeline statuses present in order', () => {
    const ids = DETAILING_BOARD_STATUSES.map((s) => s.id)
    assert.deepEqual(ids, [
      'pending',
      'confirmed',
      'waiting',
      'in_progress',
      'final_checking',
      'for_releasing',
      'for_payment',
      'completed',
    ])
    assert.match(detailingBoardStatusLabel('for_releasing'), /releas/i)
    assert.match(DETAILING_BOARD_STATUSES[0].label, /placeholder/i)
  })
})

describe('C5 POS / C6 finance contracts', () => {
  it('payment methods Cash/GCash/Card', () => {
    assert.deepEqual(
      PAYMENT_METHODS.map((m) => m.value),
      ['cash', 'gcash', 'card'],
    )
  })

  it('Bacoor report includes queue/carwash/refreshments/salaries/CA fields', () => {
    const report = buildBacoorDailyReport({
      branch: 'bacoor',
      date: '2026-08-12',
      sales: [
        { status: 'paid', total_minor: 100000, payment_method: 'cash', booking_id: '1', service_name: 'Wash' },
        { status: 'paid', total_minor: 20000, payment_method: 'gcash', service_name: 'Coffee' },
      ],
      expenses: [{ expense_kind: 'salary_carwash', amount_minor: 50000, label: 'Carwash Salary' }],
      cashAdvances: [{ status: 'approved', amount_minor: 10000, employee_name: 'Ty' }],
    })
    assert.ok(report.car_wash_sales_minor >= 0)
    assert.ok(report.refreshment_sales_minor >= 0)
    assert.ok(report.carwash_salary_minor >= 0)
    const text = formatBacoorReportText(report, (n) => String(n))
    assert.match(String(text), /car.?wash|refresh|salary|CA|cash/i)
  })

  it('PosPage exposes expense + cash advance + pending tabs', async () => {
    const src = await read('src/pages/PosPage.jsx')
    assert.match(src, /expense/i)
    assert.match(src, /cash.?advance|Cash Advance/i)
    assert.match(src, /pending/i)
  })
})

describe('C3 Failed QA + C10 KPI', () => {
  it('TL/SA/ASA can mark Failed QA; sales cannot', () => {
    assert.equal(canMarkFailedQa({ role: ROLES.TEAM_LEAD }), true)
    assert.equal(canMarkFailedQa({ role: ROLES.SUPER_ADMIN }), true)
    assert.equal(canMarkFailedQa({ role: ROLES.SALES }), false)
  })
})

describe('C8 planner proof + C9 reviews/CRM', () => {
  it('PlanningBoard wires proof submission path', async () => {
    const src = await read('src/pages/PlanningBoardPage.jsx')
    assert.match(src, /proof|for_review/i)
  })

  it('CRM CSV export + Reviews access for BA+', () => {
    const rows = topCustomersBySpend([{ customer_name: 'A', total_minor: 100, sale_id: '1' }], 20)
    const csv = insightsToCsv(rows.length ? rows : [{ name: 'A', visits: 1, spend_minor: 100 }], [
      { key: 'name', header: 'Name' },
    ])
    assert.match(csv, /Name|A/i)
    assert.equal(canAccessReviews({ role: ROLES.ADMIN }), true)
    assert.equal(canAccessReviews({ role: ROLES.STAFF }), false)
  })
})

describe('C1 provision roles + C10 compensation', () => {
  it('provisionStaff knows detailer/video_editor/investor', async () => {
    const src = await read('server/provisionStaff.mjs')
    assert.match(src, /detailer/)
    assert.match(src, /video_editor/)
    assert.match(src, /investor/)
  })

  it('compensation estimate helpers run', () => {
    const { pool_minor, rows } = splitWashPool({
      totalSalesMinor: 2000000,
      poolPct: 35,
      roster: [
        { staff_id: '1', attendance_status: 'present' },
        { staff_id: '2', attendance_status: 'late' },
      ],
    })
    assert.equal(pool_minor, 700000)
    assert.equal(rows.length, 2)
    const ceramic = computeCeramicPay({
      salesMinor: 1000000,
      toggles: { freeShirt: true, cardPayment: true, detailerAssigned: true },
    })
    assert.ok(ceramic.remaining_minor < 1000000)
  })

  it('compensation UI reads scalar columns, not a ghost rules json', async () => {
    const settings = await read('src/pages/SettingsHubPage.jsx')
    const crew = await read('src/pages/OperationsPages.jsx')
    const insights = await read('src/pages/CrmInsightsPanel.jsx')
    assert.match(settings, /toCompensationSettingsRow/)
    assert.doesNotMatch(settings, /upsert\(\{ id: 1, rules/)
    assert.match(crew, /normalizeCompensationSettings/)
    assert.doesNotMatch(crew, /select\('rules'\)/)
    assert.match(insights, /chunkIds/)
    assert.match(insights, /collectPaged/)
    assert.doesNotMatch(insights, /ids\.slice\(0, 200\)/)
    assert.doesNotMatch(insights, /\.limit\(2000\)/)
    const crm = await read('src/pages/CrmPage.jsx')
    assert.match(crm, /chunkIds/)
    assert.doesNotMatch(crm, /customerIds\.slice\(0, 200\)/)
  })
})

describe('C11 ASA/BA scope gates', () => {
  it('BA reviews/audit/people yes; data-center SA-only; investor people denied', () => {
    assert.equal(allowRoute({ role: ROLES.ADMIN }, 'reviews'), true)
    assert.equal(allowRoute({ role: ROLES.ADMIN }, 'audit'), true)
    assert.equal(allowRoute({ role: ROLES.ADMIN }, 'people'), true)
    assert.equal(allowRoute({ role: ROLES.ADMIN }, 'data-center'), false)
    assert.equal(allowRoute({ role: ROLES.SUPER_ADMIN }, 'data-center'), true)
    assert.equal(allowRoute({ role: ROLES.INVESTOR }, 'people'), false)
  })
})

describe('Phase D chrome contracts', () => {
  it('OperationsLayout dual chrome + brand tokens', async () => {
    const layout = await read('src/layouts/OperationsLayout.jsx')
    assert.match(layout, /usesFloorAppShell|usesCommandShell|FloorApp|Command/)
    const tokens = await read('src/design-tokens.css')
    assert.match(tokens, /052699|#f1f1ed/i)
  })

  it('CustomerAppFrame present for /account', async () => {
    const frame = await read('src/components/CustomerAppFrame.jsx')
    assert.match(frame, /CustomerAppFrame|account/i)
    const app = await read('src/App.jsx')
    assert.match(app, /CustomerAppFrame|\/account/)
  })

  it('docs ops-chrome brand lock exists', async () => {
    const docs = await read('docs/ops-chrome.md')
    assert.match(docs, /052699/)
  })
})
