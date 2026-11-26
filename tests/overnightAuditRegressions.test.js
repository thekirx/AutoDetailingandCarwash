import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { effectiveCeramicToggles } from '../src/lib/compensation.js'
import { normalizeReferralCode } from '../src/lib/referral.js'
import { buildHandoffCartLine } from '../src/lib/posSale.js'
import { canViewRedoLane, ROLES } from '../src/auth/permissions.js'

describe('2026-11-26 overnight full-system audit regressions', () => {
  it('effectiveCeramicToggles treats debit and card variants as cardPayment', () => {
    for (const m of ['card', 'credit', 'credit_card', 'debit', 'debit_card', 'credit/debit']) {
      assert.equal(effectiveCeramicToggles({}, m).cardPayment, true, m)
    }
    assert.equal(effectiveCeramicToggles({}, 'cash').cardPayment, false)
  })

  it('normalizeReferralCode supports both NAME-XXX and HKxxxxxx formats', () => {
    assert.equal(normalizeReferralCode('anna-7q2'), 'ANNA-7Q2')
    assert.equal(normalizeReferralCode('HKABC123'), 'HKABC123')
    assert.equal(normalizeReferralCode('KIRK-0O1'), '')
  })

  it('buildHandoffCartLine retains booking_id for multi-line ticket voucher targeting', () => {
    const line = buildHandoffCartLine({
      handoff: { id: 'h-1', amount_minor: 50000, bookings: { id: 'b-1', service_id: 's-1', vehicle_plate: 'ABC 123' } },
      services: [{ id: 's-1', name: 'Wash', pay_category: 'wash' }],
    })
    assert.equal(line.booking_id, 'b-1')
  })

  it('canViewRedoLane includes operations_lead', () => {
    assert.equal(canViewRedoLane({ role: ROLES.OPERATIONS_LEAD }), true)
  })

  it('server/financeOwnerOps.mjs no longer selects nonexistent payment_parts column', () => {
    const src = readFileSync(new URL('../server/financeOwnerOps.mjs', import.meta.url), 'utf8')
    assert.doesNotMatch(src, /payment_parts/)
    assert.match(src, /saleMoneySelect/)
  })

  it('StampTrack does not cap card slots below DB 30', () => {
    const src = readFileSync(new URL('../src/components/customer/StampTrack.jsx', import.meta.url), 'utf8')
    assert.doesNotMatch(src, /Math\.min\(24/)
  })

  it('DailySheetRulesPage returns to valid finance?tab=sheets', () => {
    const src = readFileSync(new URL('../src/pages/settings/DailySheetRulesPage.jsx', import.meta.url), 'utf8')
    assert.match(src, /tab=sheets/)
    assert.doesNotMatch(src, /tab=daily_sheets/)
  })

  it('migration 20261126223000 fixes review_daily_sheet, daily_sheet_server_totals, booking_payable_minor, and cash_advance_ledger', () => {
    const sql = readFileSync(
      new URL('../supabase/migrations/20261126223000_audit_money_referral_fixes.sql', import.meta.url),
      'utf8',
    )
    assert.match(sql, /create or replace function public\.review_daily_sheet/)
    assert.match(sql, /create or replace function public\.daily_sheet_server_totals/)
    assert.match(sql, /create or replace view public\.daily_sales_summary/)
    assert.match(sql, /create or replace function public\.booking_payable_minor/)
    assert.match(sql, /create or replace function public\.bookings_friend_referral_before/)
    assert.match(sql, /create or replace function public\.send_payslip/)
    assert.match(sql, /create or replace function public\.cash_advance_ledger/)
  })
})
