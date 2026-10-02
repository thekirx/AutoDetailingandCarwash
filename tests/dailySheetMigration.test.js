import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Behaviour is exercised on PGlite by scripts/_daily-sheet-sql-check.mjs; this guards the contract in CI.
const sql = readFileSync(new URL('../supabase/migrations/20261001090000_daily_sheet.sql', import.meta.url), 'utf8')

test('daily sheet migration keeps RLS on and writes RPC-only', () => {
  assert.match(sql, /alter table public\.daily_sheets enable row level security/)
  assert.match(sql, /alter table public\.daily_sheet_lines enable row level security/)
  assert.doesNotMatch(sql, /disable row level security/i)
  assert.match(sql, /revoke insert, update, delete on public\.daily_sheets, public\.daily_sheet_lines from authenticated/)
  assert.match(sql, /unique \(branch, business_date\)/)
})

test('approve posts once per line and only SA / ASA finance_view review', () => {
  assert.match(sql, /expenses_daily_sheet_line_key on public\.expenses \(daily_sheet_line_id\)/)
  assert.match(sql, /on conflict \(daily_sheet_line_id\)[^;]*do nothing/)
  assert.match(sql, /asa_has_grant\('finance_view'\)/)
  assert.match(sql, /Only Super Admin may reopen/)
  assert.match(sql, /kind in \('expense', 'salary'\)/, 'cash advances never post to expenses')
})

test('payroll is locked, not dropped', () => {
  assert.match(sql, /revoke execute on function public\.run_payroll\(jsonb\)/)
  assert.doesNotMatch(sql, /drop table/i)
})

test('Xero accounts 10–21 seeded', () => {
  for (let code = 10; code <= 21; code++) assert.match(sql, new RegExp(`'${code}', '`))
})
