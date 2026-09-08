import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  FIXED_FORM_TEMPLATES,
  FORM_KINDS,
  extractCalendarAt,
  extractComplaintBranch,
  formQrDataUrl,
  formQrImageUrl,
  isDetailingFormKind,
  isFixedFormKind,
  isFormSlugLocked,
  normalizeFields,
  shareFormUrl,
  slugifyFormName,
  submissionTitle,
  templateFields,
  validatePayload,
  withLiveBranchOptions,
} from '../src/lib/opsForms.js'
import {
  buildComplaintNotifyCopy,
  buildComplaintPushTargets,
} from '../server/notifyOpsForm.mjs'

describe('opsForms smart builder', () => {
  it('lists fixed company kinds plus detailing CRUD kind', () => {
    assert.equal(FORM_KINDS.length, 5)
    assert.ok(FORM_KINDS.some((k) => k.value === 'detailing'))
    assert.equal(FIXED_FORM_TEMPLATES.length, 4)
    assert.equal(isFixedFormKind('complaint'), true)
    assert.equal(isFixedFormKind('detailing'), false)
    assert.equal(isDetailingFormKind('detailing'), true)
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

  it('builds share URL, QR, and submission titles', async () => {
    assert.equal(shareFormUrl('customer-complaints', 'https://hakum.test'), 'https://hakum.test/f/customer-complaints')
    assert.equal(shareFormUrl('detailing-inquiry', 'https://hakum.test'), 'https://hakum.test/f/detailing-inquiry')
    assert.match(formQrImageUrl('https://hakum.test/f/customer-complaints'), /qrserver\.com/)
    const dataUrl = await formQrDataUrl('https://hakum.test/f/detailing-inquiry', 128)
    assert.match(dataUrl, /^data:image\/png;base64,/)
    assert.match(slugifyFormName('My Form!', 'aaaaaaaa-bbbb'), /^my-form-aaaaaaaa$/)
    assert.match(submissionTitle({ kind: 'complaint', name: 'C' }, { customer_name: 'Jo' }), /Complaint: Jo/)
    assert.match(
      submissionTitle({ kind: 'detailing', name: 'D' }, { customer_name: 'Jo', service: 'Ceramic Coating' }),
      /Detailing: Ceramic Coating · Jo/,
    )
    assert.equal(extractComplaintBranch({ branch: 'Bacoor' }), 'bacoor')
    assert.equal(isFormSlugLocked({ status: 'published', public_enabled: true, slug: 'x' }), true)
    assert.equal(isFormSlugLocked({ status: 'draft', public_enabled: true, slug: 'x' }), false)
    const detailingFields = templateFields('detailing', { branchSlugs: ['bacoor'] })
    assert.ok(detailingFields.some((f) => f.key === 'service' && f.type === 'select'))
  })

  it('overlays live branch slugs onto empty branch selects (seed gap)', () => {
    const seeded = [
      { key: 'service', type: 'select', label: 'Service', options: ['Ceramic'], required: true },
      { key: 'branch', type: 'select', label: 'Preferred branch', options: [], required: true },
    ]
    const live = withLiveBranchOptions(seeded, ['bacoor', 'batangas'])
    assert.deepEqual(live.find((f) => f.key === 'branch').options, ['bacoor', 'batangas'])
    assert.deepEqual(live.find((f) => f.key === 'service').options, ['Ceramic'])
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
