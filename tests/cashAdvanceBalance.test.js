import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cashAdvanceBalanceLabel,
  cashAdvanceBalances,
  remainingForStaff,
  calculateProjectedCashAdvance,
} from '../src/lib/cashAdvanceBalance.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('remaining balance is given minus paid back, per person', () => {
  const rows = cashAdvanceBalances([
    { staff_id: 'a', full_name: 'Ana', kind: 'ca_release', amount_minor: 100000 },
    { staff_id: 'a', full_name: 'Ana', kind: 'ca_repay', amount_minor: 40000 },
    { staff_id: 'b', full_name: 'Ben', kind: 'ca_release', amount_minor: 20000 },
    { staff_id: 'c', full_name: 'Cara', kind: 'ca_repay', amount_minor: 500 },
  ])
  const ana = rows.find((row) => row.staffId === 'a')
  assert.equal(ana.remainingMinor, 60000)
  assert.equal(ana.givenMinor, 100000)
  assert.equal(ana.repaidMinor, 40000)
  assert.equal(rows.find((row) => row.staffId === 'b').remainingMinor, 20000)
  assert.equal(cashAdvanceBalanceLabel(ana), 'Still owes')
  assert.equal(cashAdvanceBalanceLabel({ givenMinor: 100, repaidMinor: 100, remainingMinor: 0 }), 'Paid up')
})

test('the open sheet replaces its saved lines so a payment is not counted twice', () => {
  const saved = [
    { staff_id: 'a', full_name: 'Ana', kind: 'ca_release', amount_minor: 100000, sheet_id: 'old' },
    { staff_id: 'a', full_name: 'Ana', kind: 'ca_release', amount_minor: 50000, sheet_id: 'today' },
  ]
  const editor = [{ staff_id: 'a', kind: 'ca_repay', amount_minor: 50000 }]
  const balance = remainingForStaff(saved, editor, 'a', 'today')
  assert.equal(balance.givenMinor, 100000)
  assert.equal(balance.repaidMinor, 50000)
  assert.equal(balance.remainingMinor, 50000)
})

test('the ledger function is the only read, and crew are limited to themselves', () => {
  const sql = readFileSync(join(root, 'supabase/migrations/20261026190000_cash_advance_ledger.sql'), 'utf8')
  assert.match(sql, /security definer/)
  assert.match(sql, /v_staff := auth.uid\(\)/)
  assert.match(sql, /ca_release/)
  assert.match(sql, /ca_repay/)
  assert.match(sql, /grant execute on function public.cash_advance_ledger/)
})

test('calculateProjectedCashAdvance computes additional payout or repayment', () => {
  // Existing debt of ₱2,000 (200,000 minor) + additional advance of ₱1,000 (100,000 minor)
  const advance = calculateProjectedCashAdvance(200000, 'ca_release', 100000)
  assert.equal(advance.priorRemainingMinor, 200000)
  assert.equal(advance.amountMinor, 100000)
  assert.equal(advance.newRemainingMinor, 300000)
  assert.equal(advance.isRelease, true)
  assert.equal(advance.label, 'Remaining debt')

  // Repayment of ₱500 (50,000 minor) against ₱2,000 debt
  const repay = calculateProjectedCashAdvance(200000, 'ca_repay', 50000)
  assert.equal(repay.priorRemainingMinor, 200000)
  assert.equal(repay.amountMinor, 50000)
  assert.equal(repay.newRemainingMinor, 150000)
  assert.equal(repay.isRelease, false)
  assert.equal(repay.label, 'Remaining debt')

  // Full repayment
  const full = calculateProjectedCashAdvance(200000, 'ca_repay', 200000)
  assert.equal(full.newRemainingMinor, 0)
  assert.equal(full.label, 'Paid up')
})
