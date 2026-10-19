import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { PRICING_SIZES } from '../src/lib/servicePricing.js'
import { FORM_KINDS } from '../src/lib/opsForms.js'

describe('POS car size formatting', () => {
  it('uses short labels on the tile and keeps the full name', () => {
    assert.deepEqual(PRICING_SIZES.map((s) => s.short), ['S', 'M', 'L', 'XL'])
    assert.equal(PRICING_SIZES.find((s) => s.slug === 'extra_large').label, 'Extra Large')
    const pos = readFileSync('src/pages/PosPage.jsx', 'utf8')
    assert.match(pos, /sz\.short \|\| sz\.label/)
    assert.match(pos, /aria-label=\{sz\.label\}/)
  })
})

describe('planner card links a form', () => {
  it('stores form_id and opens that form’s results', () => {
    const sql = readFileSync('supabase/migrations/20261019190000_plan_card_form_link.sql', 'utf8')
    const modal = readFileSync('src/pages/planning/TaskModal.jsx', 'utf8')
    const select = readFileSync('src/lib/plannerBoard.js', 'utf8')
    assert.match(sql, /form_id uuid references public\.ops_forms/)
    assert.match(select, /form_id/)
    assert.match(select, /ops_forms \( id, name \)/)
    assert.match(modal, /form_id: formId \|\| null/)
    assert.match(modal, /tab=forms&results=\$\{formId\}/)
    assert.equal(FORM_KINDS.find((k) => k.value === 'complaint').label, 'Feedback')
  })
})
