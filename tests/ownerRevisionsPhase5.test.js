/**
 * Owner Revisions P5 — quote payload, vendor helpers, investor HQ filter.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CORPORATE_BRANCH_SLUG,
  buildFinanceQuotePayload,
  canAccessCorporateFinance,
  canManageFinanceVendors,
  filterFinanceBranchOptions,
  financeQuotePayloadErrors,
  isCorporateBranch,
  labelFinanceBranch,
  normalizeVendorPayload,
  rollupCorporatePeriod,
} from '../src/lib/financeCorporate.js'
import { ROLES } from '../src/auth/permissions.js'
import { FINANCE_TABS } from '../src/lib/financeData.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('vendor helpers', () => {
  it('normalizes vendor payload and rejects empty name', () => {
    assert.equal(normalizeVendorPayload({ name: '  ' }), null)
    assert.deepEqual(normalizeVendorPayload({ name: ' ChemCo ', contact: ' 0917 ', notes: '', is_active: false }), {
      name: 'ChemCo',
      contact: '0917',
      notes: null,
      is_active: false,
    })
  })
})

describe('quote payload', () => {
  it('builds sendFinanceQuote body from CRM customer + amount', () => {
    const payload = buildFinanceQuotePayload({
      customer: { id: 'c1', full_name: 'Ana Cruz', email: 'ana@example.com' },
      title: 'Ceramic package',
      amountPesos: '1500.50',
      notes: 'Valid 7 days',
      branch: 'bacoor',
    })
    assert.equal(payload.to, 'ana@example.com')
    assert.equal(payload.customer_id, 'c1')
    assert.equal(payload.amount_minor, 150050)
    assert.match(payload.amount_label, /₱/)
    assert.equal(payload.branch, 'bacoor')
    assert.equal(financeQuotePayloadErrors(payload).length, 0)
  })

  it('flags missing email / customer', () => {
    const bad = buildFinanceQuotePayload({
      customer: { id: null, email: '' },
      amountPesos: 100,
    })
    const errs = financeQuotePayloadErrors(bad)
    assert.ok(errs.some((e) => /email/i.test(e)))
    assert.ok(errs.some((e) => /customer/i.test(e)))
  })
})

describe('investor cannot see hq', () => {
  it('filterFinanceBranchOptions strips corporate/hq for investor', () => {
    const branches = [
      { slug: 'bacoor', name: 'Bacoor' },
      { slug: 'hq', name: 'Hakum HQ / Office' },
      { slug: 'imus', name: 'Imus' },
    ]
    const inv = filterFinanceBranchOptions(branches, { role: ROLES.INVESTOR, branch_slug: 'bacoor' })
    assert.deepEqual(
      inv.map((b) => b.slug),
      ['bacoor', 'imus'],
    )
    const sa = filterFinanceBranchOptions(branches, { role: ROLES.SUPER_ADMIN })
    assert.equal(sa.length, 3)
    assert.equal(isCorporateBranch('hq'), true)
    assert.equal(CORPORATE_BRANCH_SLUG, 'hq')
    assert.equal(labelFinanceBranch({ slug: 'hq', name: 'Hakum HQ / Office' }), 'Corporate (HQ)')
  })

  it('corporate access denied for investor; vendors write SA/ASA only', () => {
    assert.equal(canAccessCorporateFinance({ role: ROLES.INVESTOR }), false)
    assert.equal(canAccessCorporateFinance({ role: ROLES.SUPER_ADMIN }), true)
    assert.equal(canManageFinanceVendors({ role: ROLES.ADMIN, branch_slug: 'bacoor' }), false)
    assert.equal(canManageFinanceVendors({ role: ROLES.SUPER_ADMIN }), true)
    assert.equal(
      canManageFinanceVendors({ role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: { finance_write: true } }),
      true,
    )
  })
})

describe('corporate roll-up', () => {
  it('sums accepted branch closes and HQ expenses', () => {
    const rollup = rollupCorporatePeriod({
      closes: [
        {
          branch: 'bacoor',
          status: 'accepted',
          submitted: { total_sales_minor: 100000 },
        },
        {
          branch: 'hq',
          status: 'accepted',
          submitted: { total_sales_minor: 999 },
        },
        {
          branch: 'imus',
          status: 'submitted',
          submitted: { total_sales_minor: 50000 },
        },
      ],
      hqExpenses: [
        { branch: 'hq', status: 'paid', total_minor: 20000 },
        { branch: 'hq', status: 'draft', total_minor: 8000 },
        { branch: 'bacoor', status: 'paid', total_minor: 1000 },
      ],
    })
    assert.equal(rollup.closeCount, 1)
    assert.equal(rollup.closeSalesMinor, 100000)
    assert.equal(rollup.hqExpenseMinor, 20000)
    assert.equal(rollup.rollupNetMinor, 80000)
  })
})

describe('P5 source seams', () => {
  it('migration defines vendors, finance_quotes, corporate_balances, RLS', () => {
    const sql = read('supabase/migrations/20260827140000_finance_vendors_quotes_corporate.sql')
    assert.match(sql, /create table if not exists public\.vendors/)
    assert.match(sql, /finance_quotes/)
    assert.match(sql, /corporate_balances/)
    assert.match(sql, /vendor_id/)
    assert.match(sql, /corporate_balances_select/)
    assert.match(sql, /branch is distinct from 'hq'/)
    assert.match(sql, /asa_has_grant\('finance_write'\)/)
  })

  it('sendFinanceQuote persists quote + audit', () => {
    const src = read('server/sendFinanceQuote.mjs')
    assert.match(src, /finance_quotes/)
    assert.match(src, /finance\.quote_send/)
    assert.match(src, /audit_logs/)
  })

  it('Finance tabs include vendors, quotes, corporate; categories document POS source', () => {
    assert.ok(FINANCE_TABS.some((t) => t.id === 'vendors'))
    assert.ok(FINANCE_TABS.some((t) => t.id === 'quotes'))
    assert.ok(FINANCE_TABS.some((t) => t.id === 'corporate'))
    const cats = FINANCE_TABS.find((t) => t.id === 'categories')
    assert.match(cats.hint, /POS/)
    const page = read('src/pages/FinancePage.jsx')
    assert.match(page, /filterFinanceBranchOptions/)
    assert.match(page, /FinanceVendorsTab/)
    assert.match(page, /FinanceQuotesTab/)
    assert.match(page, /FinanceCorporateTab/)
    const pos = read('src/pages/PosPage.jsx')
    assert.match(pos, /expense_categories/)
    assert.match(pos, /source of truth/)
  })
})
