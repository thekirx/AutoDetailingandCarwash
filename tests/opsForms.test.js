import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  extractCalendarAt,
  normalizeFields,
  shareFormUrl,
  slugifyFormName,
  submissionTitle,
  templateFields,
  validatePayload,
} from '../src/lib/opsForms.js'

describe('opsForms smart builder', () => {
  it('normalizes fields and select options', () => {
    const fields = normalizeFields([
      { label: 'Branch', type: 'select', required: true, optionsCsv: 'bacoor|batangas' },
    ])
    assert.equal(fields[0].key, 'branch')
    assert.deepEqual(fields[0].options, ['bacoor', 'batangas'])
  })

  it('validates required payload', () => {
    const fields = templateFields('booking')
    const errs = validatePayload(fields, { customer_name: 'Ana' })
    assert.ok(errs.some((e) => /Phone|Preferred|Service/i.test(e)))
    assert.equal(validatePayload(fields, {
      customer_name: 'Ana',
      phone: '09171234567',
      preferred_at: '2026-07-28T10:00',
      service: 'Wash',
    }).length, 0)
  })

  it('extracts calendar date from datetime fields', () => {
    const fields = templateFields('booking')
    const iso = extractCalendarAt(fields, { preferred_at: '2026-07-28T10:00' })
    assert.ok(iso)
    assert.match(iso, /^2026-07-28/)
  })

  it('builds share URL and submission titles', () => {
    assert.equal(shareFormUrl('customer-complaint-abc', 'https://hakum.test'), 'https://hakum.test/f/customer-complaint-abc')
    assert.match(slugifyFormName('My Form!', 'aaaaaaaa-bbbb'), /^my-form-aaaaaaaa$/)
    assert.match(submissionTitle({ kind: 'complaint', name: 'C' }, { customer_name: 'Jo' }), /Complaint: Jo/)
  })
})
