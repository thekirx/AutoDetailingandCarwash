import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { cashAdvanceReleaseError, normalizeCashAdvanceCode } from '../src/lib/cashAdvanceCode.js'

const approved = {
  status: 'resolved',
  payload: { approval_code: 'CA7K2M', amount: 300, branch: 'bacoor' },
}

test('normalizeCashAdvanceCode uppercases and drops spaces', () => {
  assert.equal(normalizeCashAdvanceCode(' ca-7k2m '), 'CA7K2M')
})

test('a blank given-out line does not need a code yet', () => {
  assert.equal(cashAdvanceReleaseError({ kind: 'ca_release', amount_minor: 0, reason: '' }, []), null)
})

test('paid back does not need a code', () => {
  assert.equal(cashAdvanceReleaseError({ kind: 'ca_repay', amount_minor: 30000, reason: '' }, []), null)
})

test('cash leaving without a code is refused', () => {
  const err = cashAdvanceReleaseError({ kind: 'ca_release', amount_minor: 30000, reason: '' }, [approved], { branch: 'bacoor' })
  assert.equal(err, 'Type the approval code before cash leaves the drawer.')
})

test('the code must match an approved request for this branch and amount', () => {
  assert.equal(
    cashAdvanceReleaseError({ kind: 'ca_release', amount_minor: 30000, reason: 'ca7k2m' }, [approved], { branch: 'bacoor' }),
    null,
  )
  assert.equal(
    cashAdvanceReleaseError({ kind: 'ca_release', amount_minor: 10000, reason: 'CA7K2M' }, [approved], { branch: 'bacoor' }),
    'That approval code does not match an approved cash advance for this branch and amount.',
  )
  assert.equal(
    cashAdvanceReleaseError({ kind: 'ca_release', amount_minor: 30000, reason: 'CA7K2M' }, [approved], { branch: 'dasma' }),
    'That approval code does not match an approved cash advance for this branch and amount.',
  )
})

test('the same code cannot be given out twice on one sheet', () => {
  const line = { kind: 'ca_release', amount_minor: 30000, reason: 'CA7K2M' }
  const err = cashAdvanceReleaseError(line, [approved], {
    branch: 'bacoor',
    lines: [line, { kind: 'ca_release', amount_minor: 30000, reason: 'CA7K2M' }],
  })
  assert.equal(err, 'That approval code is already on this sheet.')
})

test('the database refuses a release that has no matching code', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261019090000_cash_advance_approval_code.sql', import.meta.url), 'utf8')
  assert.match(sql, /approve_cash_advance/)
  assert.match(sql, /Type the approval code before cash leaves the drawer/)
  assert.match(sql, /already used on another daily sheet/)
})
