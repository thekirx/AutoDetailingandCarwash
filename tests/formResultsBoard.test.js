import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  DETAILING_RESULT_COLUMNS,
  FORM_RESULT_KIND_TABS,
  bookingStatusToSubmissionStatus,
  buildSubmissionAnswerRows,
  filterFormResultItems,
  formResultStatusLabel,
  groupResultsByStatus,
  matchesDateRange,
  normalizeSubmissionItem,
  permanentFormResultsPath,
  resolveFormResultTarget,
} from '../src/lib/formResults.js'
import { FORM_KINDS } from '../src/lib/opsForms.js'
import { canEditDeleteFormResults, ROLES } from '../src/auth/permissions.js'
import { opsRouteKeyFromPath } from '../src/auth/authRedirect.js'

const sampleForms = [
  {
    id: 'form-detailing-1',
    name: 'Detailing Inquiry',
    kind: 'detailing',
    slug: 'detailing-inquiry',
    fields: [
      { key: 'customer_name', label: 'Full name', type: 'text', required: true },
      { key: 'plate', label: 'Plate number', type: 'text', required: true },
      { key: 'service', label: 'Detailing service', type: 'select', required: true, options: ['Ceramic Coating', 'PPF'] },
      { key: 'branch', label: 'Preferred branch', type: 'branch', required: true },
      { key: 'notes', label: 'Build notes', type: 'textarea', required: false },
    ],
  },
  {
    id: 'form-feedback-1',
    name: 'Bay Feedback Survey',
    kind: 'complaint',
    slug: 'bay-feedback',
    fields: [
      { key: 'customer_name', label: 'Customer name', type: 'text', required: true },
      { key: 'rating', label: 'Rating', type: 'select', options: ['5', '4', '3'] },
    ],
  },
  {
    id: 'form-repair-1',
    name: 'Pressure Washer Repair',
    kind: 'equipment_repair',
    slug: 'pressure-washer-repair',
    fields: [{ key: 'equipment', label: 'Equipment', type: 'text', required: true }],
  },
]

const sampleEvents = [
  {
    id: 'ev-1',
    title: 'Ceramic Demo Day',
    slug: 'ceramic-demo-day',
    branch: 'batangas',
    starts_at: '2026-11-25T10:00:00.000Z',
    form_id: null,
  },
]

describe('form results board helpers', () => {
  it('exposes sub-tabs for All forms and every active form kind without Events RSVP', () => {
    const tabIds = FORM_RESULT_KIND_TABS.map((t) => t.id)
    assert.equal(tabIds[0], 'all')
    assert.equal(tabIds.includes('event'), false, 'Events RSVP must be retired')
    for (const kind of FORM_KINDS) {
      assert.ok(tabIds.includes(kind.value), `missing sub-tab for ${kind.value}`)
    }
  })

  it('builds permanent form results routes and resolves form slugs', () => {
    assert.equal(permanentFormResultsPath(), '/operations/forms/results')
    assert.equal(
      permanentFormResultsPath('detailing-inquiry'),
      '/operations/forms/results/detailing-inquiry',
    )

    const byForm = resolveFormResultTarget('detailing-inquiry', {
      forms: sampleForms,
      events: sampleEvents,
    })
    assert.equal(byForm.formKey, 'detailing-inquiry')
    assert.equal(byForm.kindTab, 'detailing')
    assert.equal(byForm.form?.id, 'form-detailing-1')
  })

  it('matches date presets and custom local-day From/To date ranges', () => {
    const now = new Date(2026, 10, 15, 14, 0, 0) // 2026-11-15 local
    const todayIso = new Date(2026, 10, 15, 9, 30, 0).toISOString()
    const fiveDaysAgoIso = new Date(2026, 10, 10, 12, 0, 0).toISOString()
    const twentyDaysAgoIso = new Date(2026, 9, 26, 12, 0, 0).toISOString()
    const fortyDaysAgoIso = new Date(2026, 9, 5, 12, 0, 0).toISOString()

    assert.equal(matchesDateRange(todayIso, { datePreset: 'today' }, now), true)
    assert.equal(matchesDateRange(fiveDaysAgoIso, { datePreset: 'today' }, now), false)
    assert.equal(matchesDateRange(fiveDaysAgoIso, { datePreset: '7d' }, now), true)
    assert.equal(matchesDateRange(twentyDaysAgoIso, { datePreset: '7d' }, now), false)
    assert.equal(matchesDateRange(twentyDaysAgoIso, { datePreset: '30d' }, now), true)
    assert.equal(matchesDateRange(fortyDaysAgoIso, { datePreset: '30d' }, now), false)
    assert.equal(matchesDateRange(todayIso, { datePreset: 'month' }, now), true)
    assert.equal(matchesDateRange(twentyDaysAgoIso, { datePreset: 'month' }, now), false)

    // Custom From..To (including reversed inputs)
    assert.equal(
      matchesDateRange(fiveDaysAgoIso, { dateFrom: '2026-11-09', dateTo: '2026-11-11' }, now),
      true,
    )
    assert.equal(
      matchesDateRange(todayIso, { dateFrom: '2026-11-09', dateTo: '2026-11-11' }, now),
      false,
    )
    assert.equal(
      matchesDateRange(fiveDaysAgoIso, { dateFrom: '2026-11-11', dateTo: '2026-11-09' }, now),
      true,
    )
  })

  it('maps detailing submissions directly into Booking Placeholder and mirrors Detailing Schedule lanes', () => {
    const formsById = new Map(sampleForms.map((f) => [f.id, f]))

    const detNew = normalizeSubmissionItem(
      {
        id: 'sub-1',
        form_id: 'form-detailing-1',
        status: 'new',
        source: 'public',
        respondent_label: 'Carlo Mendoza',
        created_at: '2026-11-15T06:00:00.000Z',
        calendar_at: '2026-11-22T18:00:00.000Z',
        booking_id: 'bk-1',
        linked_booking: { id: 'bk-1', status: 'pending', branch: 'bacoor' },
        payload: {
          customer_name: 'Carlo Mendoza',
          plate: 'ABC-1234',
          service: 'Ceramic Coating',
          branch: 'bacoor',
          notes: 'Supra MK5 midnight silver',
          utm_source: 'fb',
        },
      },
      { formsById },
    )
    assert.equal(detNew.status, 'pending')
    assert.equal(detNew.submissionStatus, 'new')
    assert.equal(formResultStatusLabel(detNew.status, detNew.formKind), 'Booking Placeholder')

    const detProgress = normalizeSubmissionItem(
      {
        id: 'sub-2',
        form_id: 'form-detailing-1',
        status: 'in_review',
        source: 'public',
        respondent_label: 'Marco Santos',
        created_at: '2026-11-15T07:00:00.000Z',
        linked_booking: { id: 'bk-2', status: 'in_progress', branch: 'batangas' },
        payload: { customer_name: 'Marco Santos', plate: 'XYZ-888', branch: 'batangas' },
      },
      { formsById },
    )
    assert.equal(detProgress.status, 'in_progress')
    assert.equal(detProgress.submissionStatus, 'in_review')
    assert.equal(bookingStatusToSubmissionStatus('completed'), 'resolved')

    const fbResolved = normalizeSubmissionItem(
      {
        id: 'sub-3',
        form_id: 'form-feedback-1',
        status: 'resolved',
        source: 'staff',
        respondent_label: 'Ana Reyes',
        created_at: '2026-11-14T10:00:00.000Z',
        payload: { customer_name: 'Ana Reyes', rating: '5', branch: 'dasma' },
      },
      { formsById },
    )

    const all = [detNew, detProgress, fbResolved]
    const detailingOnly = filterFormResultItems(all, { kindTab: 'detailing' })
    assert.equal(detailingOnly.length, 2)

    const detailingCols = groupResultsByStatus(detailingOnly, { mode: 'detailing' })
    assert.deepEqual(
      detailingCols.map((c) => c.id),
      DETAILING_RESULT_COLUMNS.map((c) => c.id),
    )
    assert.equal(detailingCols.find((c) => c.id === 'pending')?.items.length, 1)
    assert.equal(detailingCols.find((c) => c.id === 'in_progress')?.items.length, 1)

    const searchSupra = filterFormResultItems(all, { query: 'supra abc-1234' })
    assert.deepEqual(searchSupra.map((x) => x.id), ['sub-1'])

    const lanes = groupResultsByStatus(all)
    assert.deepEqual(
      lanes.map((c) => [c.id, c.items.length]),
      [
        ['new', 1],
        ['in_review', 1],
        ['resolved', 1],
        ['archived', 0],
      ],
    )

    const fullRows = buildSubmissionAnswerRows(detNew)
    assert.deepEqual(
      fullRows.map((r) => [r.key, r.displayValue, r.required]),
      [
        ['customer_name', 'Carlo Mendoza', true],
        ['plate', 'ABC-1234', true],
        ['service', 'Ceramic Coating', true],
        ['branch', 'bacoor', true],
        ['notes', 'Supra MK5 midnight silver', false],
        ['utm_source', 'fb', false],
      ],
    )
  })
})

describe('form results RBAC and route wiring', () => {
  it('allows edit/delete exclusively for Owner (BossMich)', () => {
    assert.equal(canEditDeleteFormResults({ role: ROLES.SUPER_ADMIN }), true)
    for (const role of [
      ROLES.ASSISTANT_SUPER_ADMIN,
      ROLES.ADMIN,
      ROLES.OPERATIONS_LEAD,
      ROLES.MARKETING,
      ROLES.TEAM_LEAD,
      ROLES.DETAILER,
      ROLES.CUSTOMER,
      'other',
    ]) {
      assert.equal(canEditDeleteFormResults({ role }), false, `${role} must not edit/delete results`)
    }
    assert.equal(canEditDeleteFormResults(null), false)
  })

  it('routes /operations/forms/results under planning auth gate', () => {
    assert.equal(opsRouteKeyFromPath('/operations/forms/results'), 'planning')
    assert.equal(opsRouteKeyFromPath('/operations/forms/results/sunday-meet'), 'planning')
  })

  it('enforces ownerOnly on server mutations, retires Events RSVP, and syncs detailing bookings', () => {
    const gatewaySrc = readFileSync(new URL('../server/provisionStaff.mjs', import.meta.url), 'utf8')
    assert.match(gatewaySrc, /handleFormResultsAction/)
    const serverSrc = readFileSync(new URL('../server/formResultsStore.mjs', import.meta.url), 'utf8')
    for (const action of [
      "action === 'list-form-results'",
      "action === 'update-form-submission'",
      "action === 'delete-form-submission'",
    ]) {
      assert.ok(serverSrc.includes(action), `missing server action ${action}`)
    }
    assert.match(serverSrc, /status:\s*410/)
    assert.match(serverSrc, /if \(ownerOnly\) \{[\s\S]*staff\.role !== SUPER/)
    assert.match(serverSrc, /parseOptionalIsoDate/)
    assert.match(serverSrc, /buildBookingSyncPatch/)

    const appSrc = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
    assert.ok(appSrc.includes('path="forms/results"'))
    assert.ok(appSrc.includes('path="forms/results/:formSlug"'))

    for (const rel of [
      '../src/pages/FormResultsBoardPage.jsx',
      '../src/pages/PlanningBoardPage.jsx',
      '../src/pages/InquiriesPage.jsx',
      '../src/pages/planning/PlanningFormsSmartPanel.jsx',
      '../src/pages/planning/PlanningPart6Panels.jsx',
      '../src/pages/ContentAdminPage.jsx',
      '../src/pages/EventsPage.jsx',
      '../src/pages/EventSharePage.jsx',
    ]) {
      const src = readFileSync(new URL(rel, import.meta.url), 'utf8')
      assert.ok(
        src.includes('forms/results') || src.includes('permanentFormResultsPath') || src.includes('FormResultsBoardPage'),
        `${rel} should wire Form Results`,
      )
    }
  })
})
