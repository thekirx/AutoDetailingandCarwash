import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { activeAccounts, buildAccountRow, catalogWriteError, isSalaryAccount } from '../src/lib/financeBooks.js'

test('buildAccountRow trims, validates and forces approval for chemicals', () => {
  assert.equal(buildAccountRow({ name: '  ' }).error, 'Enter the account name.')
  assert.match(buildAccountRow({ name: 'x'.repeat(81) }).error, /too long/)
  assert.match(buildAccountRow({ name: 'Fuel', code: '12345678901' }).error, /Code is too long/)
  assert.deepEqual(buildAccountRow({ name: ' Fuel ', code: ' 22 ', kind: 'general' }).row, { name: 'Fuel', code: '22', kind: 'general', is_chemical: false })
  assert.equal(buildAccountRow({ name: 'Wax', kind: 'chemicals', is_chemical: false }).row.is_chemical, true)
  assert.equal(buildAccountRow({ name: 'Odd', kind: 'made-up' }).row.kind, 'general')
  assert.equal(buildAccountRow({ name: 'No code', code: '' }).row.code, null)
})

test('activeAccounts hides archived accounts unless already on the record, in code order', () => {
  const cats = [
    { id: 'b', name: 'Rent', code: '19' },
    { id: 'a', name: 'Meals', code: '10', is_archived: true },
    { id: 'c', name: 'Misc' },
    { id: 'd', name: 'Coffee', code: '13' },
  ]
  assert.deepEqual(activeAccounts(cats).map((c) => c.id), ['d', 'b', 'c'])
  assert.deepEqual(activeAccounts(cats, ['a', '', null]).map((c) => c.id), ['a', 'd', 'b', 'c'])
})

test('catalogWriteError explains duplicates, in-use deletes, the salary guard and missing access', () => {
  assert.match(catalogWriteError({ code: '23505', message: 'duplicate key value violates unique constraint "expense_categories_code_key"' }), /uses that code/)
  assert.match(catalogWriteError({ code: '23505', message: 'expense_categories_name_key' }), /already has that name/)
  assert.match(catalogWriteError({ code: '23503', message: 'fk' }), /Archive it/)
  assert.match(catalogWriteError({ code: '23514', message: 'Account 14 (salaries) must keep code 14' }), /Account 14/)
  assert.match(catalogWriteError({ code: '42501', message: 'new row violates row-level security policy' }, 'vendor'), /Finance write access to change vendors/)
  assert.ok(isSalaryAccount({ code: '14' }) && !isSalaryAccount({ code: '15' }))
})

test('migration keeps account 14 fixed, codes unique and adds archiving', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261009180000_expense_categories_crud.sql', import.meta.url), 'utf8')
  assert.match(sql, /add column if not exists is_archived boolean not null default false/)
  assert.match(sql, /create unique index if not exists expense_categories_code_key/)
  assert.match(sql, /before update or delete on public\.expense_categories/)
  assert.match(sql, /old\.code = '14' and \(new\.code is distinct from '14' or new\.kind <> 'payroll' or new\.is_archived\)/)
})
