import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { countBranchRows, filterBranchRows } from '../src/lib/branchListFilter.js'

const rows = [
  { slug: 'bacoor', name: 'Hakum Auto Care Bacoor', code: 'BCR', address: 'Molino Blvd, Bacoor', is_active: true },
  { slug: 'dasmarinas', name: 'Hakum Dasmariñas', code: 'DSM', address: 'Aguinaldo Hwy', is_active: true, coming_soon: true },
  { slug: 'hq', name: 'Head office', code: 'HQ', address: '', is_active: false },
  { slug: 'crudtest-abc', name: 'CRUD Test', code: 'CKAB', address: 'Updated', is_archived: true },
]

describe('branch list filter', () => {
  it('hides archived by default and filters by status', () => {
    assert.deepEqual(filterBranchRows(rows).map((r) => r.slug), ['bacoor', 'dasmarinas', 'hq'])
    assert.deepEqual(filterBranchRows(rows, { status: 'archived' }).map((r) => r.slug), ['crudtest-abc'])
    assert.deepEqual(filterBranchRows(rows, { status: 'active' }).map((r) => r.slug), ['bacoor'])
    assert.deepEqual(filterBranchRows(rows, { status: 'coming_soon' }).map((r) => r.slug), ['dasmarinas'])
    assert.equal(filterBranchRows(rows, { status: 'all' }).length, 4)
  })

  it('searches name, slug, code, and address with every term', () => {
    assert.deepEqual(filterBranchRows(rows, { q: 'molino' }).map((r) => r.slug), ['bacoor'])
    assert.deepEqual(filterBranchRows(rows, { q: 'dsm' }).map((r) => r.slug), ['dasmarinas'])
    assert.deepEqual(filterBranchRows(rows, { q: 'hakum bacoor' }).map((r) => r.slug), ['bacoor'])
    assert.equal(filterBranchRows(rows, { q: 'crud' }).length, 0)
    assert.equal(filterBranchRows(rows, { q: 'crud', status: 'all' }).length, 1)
  })

  it('counts every chip', () => {
    assert.deepEqual(countBranchRows(rows), { current: 3, active: 1, coming_soon: 1, inactive: 1, archived: 1, all: 4 })
  })

  it('page opens create/edit in a modal instead of an always-open form', () => {
    const page = readFileSync(new URL('../src/pages/BranchesManagePage.jsx', import.meta.url), 'utf8')
    assert.match(page, /<Dialog open=\{formOpen\}/)
    assert.match(page, /onClick=\{openCreate\}/)
    assert.match(page, /filterBranchRows/)
    assert.doesNotMatch(page, /xl:grid-cols-\[minmax\(0,420px\)_1fr\]/)
  })
})
