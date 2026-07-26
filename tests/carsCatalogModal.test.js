/**
 * Cars catalog edit must open in a Dialog modal (not inline form).
 * Run: node tests/carsCatalogModal.test.js
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dir = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(dir, '../src/pages/CarsCatalogPage.jsx'), 'utf8')

assert.match(src, /from '@\/components\/ui\/dialog'/)
assert.match(src, /function openEdit\(/)
assert.match(src, /<Dialog open=\{Boolean\(editing\)/)
assert.match(src, /DialogTitle>Edit make \/ model/)
assert.doesNotMatch(src, /editingId \? 'Edit make/)
assert.ok(!src.includes("CardTitle>{editingId ? 'Edit make"), 'edit must not reuse the page add form title')

console.log('carsCatalogModal: ok')
