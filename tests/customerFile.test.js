/**
 * Michi C14 / C19 — queue note author·date + CRM customer file (points, vouchers, notes, transactions).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachNoteAuthors, formatNoteAuthorDate } from '../src/lib/customerNoteDisplay.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('customer note author · date', () => {
  it('formats author and date for the queue panel', () => {
    assert.equal(formatNoteAuthorDate({ authorName: 'Ana TL', createdAt: '2026-10-18T08:00:00+08:00' }).includes('Ana TL'), true)
    assert.equal(formatNoteAuthorDate({ authorName: '', createdAt: null }), 'Staff')
    const withNames = attachNoteAuthors(
      [{ id: '1', created_by: 'u1', body: 'soft towels' }],
      [{ id: 'u1', full_name: 'Ana TL' }],
    )
    assert.equal(withNames[0].author_name, 'Ana TL')
  })

  it('CustomerNotesPanel selects created_by and shows author · date', () => {
    const panel = read('src/components/CustomerNotesPanel.jsx')
    assert.match(panel, /created_by/)
    assert.match(panel, /staff_display_names/)
    assert.match(panel, /formatNoteAuthorDate/)
    assert.match(panel, /note-author-date/)
  })
})

describe('CRM customer file (C19)', () => {
  it('CustomerProfileDialog loads points, vouchers, birthday perks, notes, and transactions', () => {
    const dialog = read('src/pages/crm/CustomerProfileDialog.jsx')
    assert.match(dialog, /loyalty_points/)
    assert.match(dialog, /promo_voucher_redemptions/)
    assert.match(dialog, /customer_birthday_perks/)
    assert.match(dialog, /CustomerNotesPanel/)
    assert.match(dialog, /TabsTrigger value="vouchers"/)
    assert.match(dialog, /TabsTrigger value="purchases"/)
    assert.match(dialog, /date_of_birth/)
  })
})
