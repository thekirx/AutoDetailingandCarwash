import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  FORM_RESULT_KIND_TABS,
  buildSubmissionAnswerRows,
  eventQuickResultsSlug,
  filterFormResultItems,
  groupResultsByStatus,
  matchesDateRange,
  normalizeEventRegistrationItem,
  normalizeSubmissionItem,
  permanentFormResultsPath,
  resolveFormResultTarget,
} from '../src/lib/formResults.js'
import { FORM_KINDS } from '../src/lib/opsForms.js'
import { canEditDeleteFormResults, ROLES } from '../src/auth/permissions.js'
import { opsRouteKeyFromPath } from '../src/auth/authRedirect.js'

const sampleForms = [
  {
    id: 'form-event-1',
    name: 'Sunday Midnight Meet RSVP',
    kind: 'event',
    slug: 'sunday-midnight-meet',
    event_id: 'ev-1',
    fields: [
      { key: 'full_name', label: 'Full name', type: 'text', required: true },
      { key: 'plate', label: 'Plate number', type: 'text', required: true },
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
    title: 'Sunday Midnight Meet',
    slug: 'sunday-meet',
    branch: 'bacoor',
    starts_at: '2026-11-22T18:00:00.000Z',
    form_id: 'form-event-1',
  },
  {
    id: 'ev-2',
    title: 'Ceramic Demo Day',
    slug: 'ceramic-demo-day',
    branch: 'batangas',
    starts_at: '2026-11-25T10:00:00.000Z',
    form_id: null,
  },
]

describe('form results board helpers', () => {
  it('exposes sub-tabs for All forms, Events RSVP, and every form kind', () => {
    const tabIds = FORM_RESULT_KIND_TABS.map((t) => t.id)
    assert.equal(tabIds[0], 'all')
    assert.equal(tabIds[1], 'event')
    for (const kind of FORM_KINDS) {
      assert.ok(tabIds.includes(kind.value), `missing sub-tab for ${kind.value}`)
    }
  })

  it('builds permanent form results routes and resolves attached forms and quick-RSVP events', () => {
    assert.equal(permanentFormResultsPath(), '/operations/forms/results')
    assert.equal(
      permanentFormResultsPath('sunday-midnight-meet'),
      '/operations/forms/results/sunday-midnight-meet',
    )
    const quickSlug = eventQuickResultsSlug(sampleEvents[1])
    assert.equal(quickSlug, 'event-ceramic-demo-day')

    const byForm = resolveFormResultTarget('sunday-midnight-meet', {
      forms: sampleForms,
      events: sampleEvents,
    })
    assert.equal(byForm.formKey, 'sunday-midnight-meet')
    assert.equal(byForm.kindTab, 'event')
    assert.equal(byForm.event?.id, 'ev-1')

    const byAttachedEvent = resolveFormResultTarget('event-sunday-meet', {
      forms: sampleForms,
      events: sampleEvents,
    })
    assert.equal(byAttachedEvent.formKey, 'sunday-midnight-meet')
    assert.equal(byAttachedEvent.kindTab, 'event')

    const byQuickEvent = resolveFormResultTarget(quickSlug, {
      forms: sampleForms,
      events: sampleEvents,
    })
    assert.equal(byQuickEvent.formKey, 'event-ceramic-demo-day')
    assert.equal(byQuickEvent.kindTab, 'event')
    assert.equal(byQuickEvent.event?.id, 'ev-2')
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

  it('normalizes submissions + quick registrations, filters by kind/search/date/branch, and groups into board lanes', () => {
    const formsById = new Map(sampleForms.map((f) => [f.id, f]))
    const eventsById = new Map(sampleEvents.map((e) => [e.id, e]))
    const eventsByFormId = new Map(sampleEvents.filter((e) => e.form_id).map((e) => [e.form_id, e]))

    const item1 = normalizeSubmissionItem(
      {
        id: 'sub-1',
        form_id: 'form-event-1',
        status: 'in_review',
        source: 'public',
        respondent_label: 'Carlo Mendoza',
        created_at: '2026-11-15T06:00:00.000Z',
        calendar_at: '2026-11-22T18:00:00.000Z',
        payload: {
          full_name: 'Carlo Mendoza',
          plate: 'ABC-1234',
          branch: 'bacoor',
          notes: 'Supra MK5 midnight silver',
          utm_source: 'fb',
        },
      },
      { formsById, eventsById, eventsByFormId },
    )
    const item2 = normalizeEventRegistrationItem(
      {
        id: 'reg-1',
        event_id: 'ev-2',
        name: 'Jules Santos',
        phone: '09171234567',
        email: 'jules@example.com',
        created_at: '2026-11-01T08:00:00.000Z',
      },
      { eventsById },
    )
    const item3 = normalizeSubmissionItem(
      {
        id: 'sub-2',
        form_id: 'form-feedback-1',
        status: 'resolved',
        source: 'staff',
        respondent_label: 'Ana Reyes',
        created_at: '2026-11-14T10:00:00.000Z',
        payload: { customer_name: 'Ana Reyes', rating: '5', branch: 'dasma' },
      },
      { formsById, eventsById, eventsByFormId },
    )

    const all = [item1, item2, item3]
    const eventOnly = filterFormResultItems(all, { kindTab: 'event' })
    assert.equal(eventOnly.length, 2)

    const searchSupra = filterFormResultItems(all, { query: 'supra abc-1234' })
    assert.deepEqual(searchSupra.map((x) => x.id), ['sub-1'])

    const calendarRange = filterFormResultItems(all, {
      dateField: 'calendar',
      dateFrom: '2026-11-24',
      dateTo: '2026-11-26',
    })
    assert.deepEqual(calendarRange.map((x) => x.id), ['reg-1'])

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

    const fullRows = buildSubmissionAnswerRows(item1)
    assert.deepEqual(
      fullRows.map((r) => [r.key, r.displayValue, r.required]),
      [
        ['full_name', 'Carlo Mendoza', true],
        ['plate', 'ABC-1234', true],
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

  it('enforces ownerOnly on server mutations and wires permanent links across planning and events', () => {
    const serverSrc = readFileSync(new URL('../server/provisionStaff.mjs', import.meta.url), 'utf8')
    for (const action of [
      "action === 'list-form-results'",
      "action === 'update-form-submission'",
      "action === 'delete-form-submission'",
      "action === 'update-event-registration'",
      "action === 'delete-event-registration'",
    ]) {
      assert.ok(serverSrc.includes(action), `missing server action ${action}`)
    }
    assert.match(serverSrc, /if \(ownerOnly\) \{[\s\S]*staff\.role !== SUPER/)

    const appSrc = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
    assert.ok(appSrc.includes('path="forms/results"'))
    assert.ok(appSrc.includes('path="forms/results/:formSlug"'))

    for (const rel of [
      '../src/pages/FormResultsBoardPage.jsx',
      '../src/pages/planning/PlanningFormsSmartPanel.jsx',
      '../src/pages/planning/PlanningPart6Panels.jsx',
      '../src/pages/ContentAdminPage.jsx',
      '../src/pages/EventsPage.jsx',
      '../src/pages/EventSharePage.jsx',
    ]) {
      const src = readFileSync(new URL(rel, import.meta.url), 'utf8')
      assert.ok(
        src.includes('forms/results') || src.includes('permanentFormResultsPath'),
        `${rel} should link to permanent form results`,
      )
    }
  })
})
