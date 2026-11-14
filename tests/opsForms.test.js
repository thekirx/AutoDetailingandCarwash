import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  FIXED_FORM_TEMPLATES,
  FORM_KINDS,
  extractCalendarAt,
  extractComplaintBranch,
  extractSubmissionBranch,
  filterFormBranchSlugs,
  filterSubmissionsByBranchScope,
  formatBranchSlugLabel,
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
  thumbDownComplaintPayload,
  validatePayload,
  withLiveBranchOptions,
} from '../src/lib/opsForms.js'
import { buildComplaintNotifyCopy } from '../server/notifyOpsForm.mjs'
import { NOTIFY_EVENTS, planStaffRecipients } from '../src/lib/notifyRouting.js'

describe('opsForms smart builder', () => {
  it('lists fixed company kinds plus detailing CRUD kind', () => {
    assert.equal(FORM_KINDS.length, 6)
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

  it('upgrades legacy text branch fields to select with live operational branch slugs and filters out coming_soon/hq/archived branches', () => {
    const rawBranches = [
      { slug: 'bacoor', name: 'Hakum Auto Care Bacoor', is_active: true, is_archived: false, coming_soon: false, is_public: true },
      { slug: 'batangas', name: 'Hakum Auto Care Batangas', is_active: true, is_archived: false, coming_soon: false, is_public: true },
      { slug: 'dasmarinas', name: 'Hakum Auto Care Dasmariñas', is_active: false, is_archived: false, coming_soon: true, is_public: true },
      { slug: 'imus', name: 'Hakum Auto Care Imus', is_active: true, is_archived: false, coming_soon: true, is_public: true },
      { slug: 'hq', name: 'Hakum HQ / Office', is_active: true, is_archived: false, coming_soon: false, is_public: false },
      { slug: 'crudtest-1', name: 'CRUD Test', is_active: false, is_archived: true, coming_soon: false, is_public: false },
    ]
    const slugs = filterFormBranchSlugs(rawBranches)
    assert.deepEqual(slugs, ['bacoor', 'batangas'])

    const legacyComplaintFields = [
      { key: 'customer_name', type: 'text', label: 'Customer name', required: true },
      { key: 'branch', type: 'text', label: 'Branch', required: true },
    ]
    const upgraded = withLiveBranchOptions(legacyComplaintFields, slugs)
    const branchField = upgraded.find((f) => f.key === 'branch')
    assert.equal(branchField.type, 'select')
    assert.deepEqual(branchField.options, ['bacoor', 'batangas'])

    const eventFields = templateFields('event', { branchSlugs: slugs })
    const eventBranch = eventFields.find((f) => f.key === 'branch')
    assert.ok(eventBranch)
    assert.equal(eventBranch.type, 'select')
    assert.equal(eventBranch.required, false)
    assert.deepEqual(eventBranch.options, ['bacoor', 'batangas'])
  })

  it('extracts and filters form submissions by branch filter and admin branch scope list', () => {
    const submissions = [
      { id: 's1', form_id: 'f1', payload: { customer_name: 'Ana', branch: 'bacoor' } },
      { id: 's2', form_id: 'f1', payload: { customer_name: 'Ben', branch: 'Hakum Auto Care Batangas' } },
      { id: 's3', form_id: 'f2', payload: { name: 'Guest RSVP' } },
    ]
    assert.equal(extractSubmissionBranch(submissions[0]), 'bacoor')
    assert.equal(extractSubmissionBranch(submissions[1]), 'batangas')
    assert.equal(extractSubmissionBranch(submissions[2]), null)

    assert.equal(formatBranchSlugLabel('bacoor'), 'Bacoor')
    assert.equal(formatBranchSlugLabel('batangas'), 'Batangas')

    // Super admin (scopeList: null) with 'all' sees all 3
    assert.deepEqual(
      filterSubmissionsByBranchScope(submissions, { branchFilter: 'all', scopeList: null }).map((s) => s.id),
      ['s1', 's2', 's3'],
    )
    // Filter by 'bacoor' -> only s1
    assert.deepEqual(
      filterSubmissionsByBranchScope(submissions, { branchFilter: 'bacoor', scopeList: null }).map((s) => s.id),
      ['s1'],
    )
    // Filter by 'batangas' -> only s2
    assert.deepEqual(
      filterSubmissionsByBranchScope(submissions, { branchFilter: 'batangas', scopeList: null }).map((s) => s.id),
      ['s2'],
    )
    // Batangas-only site admin (scopeList: ['batangas']) with 'all' sees Batangas + unscoped RSVP, never Bacoor complaint
    assert.deepEqual(
      filterSubmissionsByBranchScope(submissions, { branchFilter: 'all', scopeList: ['batangas'] }).map((s) => s.id),
      ['s2', 's3'],
    )
  })
})

describe('thumbs down complaint', () => {
  it('builds the customer-complaints payload or refuses a blank', () => {
    assert.equal(
      thumbDownComplaintPayload({ name: 'Ana', branch: 'bacoor', category: 'Nope', description: 'Waited' }),
      null,
    )
    assert.equal(thumbDownComplaintPayload({ name: 'Ana', branch: 'bacoor', category: 'Wait time', description: '  ' }), null)
    assert.deepEqual(
      thumbDownComplaintPayload({
        name: ' Ana ',
        phone: '0917',
        branch: 'bacoor',
        category: 'Wait time',
        description: ' Too long ',
        bookingId: 'bk-1',
      }),
      {
        customer_name: 'Ana',
        phone: '0917',
        branch: 'bacoor',
        category: 'Wait time',
        description: 'Too long',
        booking_id: 'bk-1',
      },
    )
    const portal = readFileSync(new URL('../server/customerPortal.mjs', import.meta.url), 'utf8')
    const home = readFileSync(new URL('../src/pages/CustomerAccountPage.jsx', import.meta.url), 'utf8')
    assert.match(portal, /submit_public_ops_form/)
    assert.match(portal, /customer-complaints/)
    assert.match(home, /Send complaint/)
    assert.match(home, /COMPLAINT_CATEGORIES/)
    assert.equal(NOTIFY_EVENTS.review.urls[0], '/operations/planning?tab=forms')
  })
})

describe('complaint notify targets', () => {
  it('targets SA + ASA globally and branch admin by branch', () => {
    const people = [
      { id: 'sa', role: 'BossMich' },
      { id: 'asa', role: 'assistant_super_admin' },
      { id: 'ba-bacoor', role: 'admin', branch_slug: 'bacoor' },
      { id: 'ba-batangas', role: 'admin', branch_slug: 'batangas' },
      { id: 'tl', role: 'team_lead', branch_slug: 'bacoor' },
    ]
    const got = planStaffRecipients(people, { ...NOTIFY_EVENTS.complaint, branch: 'bacoor' }).map((r) => r.id)
    assert.deepEqual(got, ['sa', 'asa', 'ba-bacoor'])
    const copy = buildComplaintNotifyCopy({
      payload: { customer_name: 'Ana', branch: 'bacoor', category: 'Damage' },
      submissionId: 'sub-1',
    })
    assert.equal(copy.kind, 'ops_complaint')
    assert.match(copy.body, /Ana @ bacoor/)
  })
})
