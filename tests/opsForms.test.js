import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  FIXED_FORM_TEMPLATES,
  FORM_KINDS,
  extractCalendarAt,
  extractComplaintBranch,
  formQrImageUrl,
  normalizeFields,
  shareFormUrl,
  slugifyFormName,
  submissionTitle,
  templateFields,
  validatePayload,
} from '../src/lib/opsForms.js'
import {
  buildComplaintNotifyCopy,
  buildComplaintPushTargets,
} from '../server/notifyOpsForm.mjs'

describe('opsForms smart builder', () => {
  it('locks to four fixed kinds', () => {
    assert.equal(FORM_KINDS.length, 4)
    assert.deepEqual(FORM_KINDS.map((k) => k.value).sort(), [
      'cash_advance',
      'complaint',
      'equipment_repair',
      'event',
    ])
    assert.equal(FIXED_FORM_TEMPLATES.length, 4)
  })

  it('normalizes fields and select options', () => {
    const fields = normalizeFields([
      { label: 'Branch', type: 'select', required: true, optionsCsv: 'bacoor|batangas' },
    ])
    assert.equal(fields[0].key, 'branch')
    assert.deepEqual(fields[0].options, ['bacoor', 'batangas'])
  })

  it('validates required complaint payload', () => {
    const fields = templateFields('complaint')
    const errs = validatePayload(fields, { customer_name: 'Ana' })
    assert.ok(errs.some((e) => /Branch|Category|Description/i.test(e)))
    assert.equal(validatePayload(fields, {
      customer_name: 'Ana',
      branch: 'bacoor',
      category: 'Wait time',
      description: 'Long wait',
    }).length, 0)
  })

  it('extracts calendar date from event fields', () => {
    const fields = templateFields('cash_advance')
    const iso = extractCalendarAt(fields, { needed_by: '2026-07-28' })
    assert.ok(iso)
    assert.match(iso, /^2026-07-28/)
  })

  it('builds share URL, QR, and submission titles', () => {
    assert.equal(shareFormUrl('customer-complaints', 'https://hakum.test'), 'https://hakum.test/f/customer-complaints')
    assert.match(formQrImageUrl('https://hakum.test/f/customer-complaints'), /qrserver\.com/)
    assert.match(slugifyFormName('My Form!', 'aaaaaaaa-bbbb'), /^my-form-aaaaaaaa$/)
    assert.match(submissionTitle({ kind: 'complaint', name: 'C' }, { customer_name: 'Jo' }), /Complaint: Jo/)
    assert.equal(extractComplaintBranch({ branch: 'Bacoor' }), 'bacoor')
  })
})

describe('complaint notify targets', () => {
  it('targets SA + ASA globally and branch admin by branch', () => {
    const targets = buildComplaintPushTargets('bacoor')
    assert.deepEqual(targets[0].roles, ['BossMich', 'assistant_super_admin'])
    assert.equal(targets[1].roles[0], 'admin')
    assert.equal(targets[1].branchId, 'bacoor')
    const copy = buildComplaintNotifyCopy({
      payload: { customer_name: 'Ana', branch: 'bacoor', category: 'Damage' },
      submissionId: 'sub-1',
    })
    assert.equal(copy.kind, 'ops_complaint')
    assert.match(copy.body, /Ana @ bacoor/)
  })
})
