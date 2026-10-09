import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  CRM_SMART_GROUP_PRESETS,
  buildCustomerVisitStats,
  describeSmartFilter,
  filterCustomersBySmartGroup,
  normalizeSmartFilter,
  resolveSmartRange,
  smartRangeError,
  summarizeCustomerHistory,
  ticketNotesFromBookings,
} from '../src/lib/crmSmartGroups.js'

describe('CRM profile ticket notes (Team Lead New ticket form)', () => {
  it('one entry per visit, services merged, blanks skipped', () => {
    const tl = { team_lead_id: 'tl1', team_lead_name: 'Tess', branch: 'bacoor', created_at: '2026-10-09T01:00:00Z' }
    const notes = ticketNotesFromBookings([
      { ...tl, id: 'a', visit_group_id: 'g1', notes: ' Scratch on rear bumper ', services: { name: 'Wash' } },
      { ...tl, id: 'b', visit_group_id: 'g1', notes: 'Scratch on rear bumper', services: { name: 'Wax' } },
      { id: 'c', notes: '  ', services: { name: 'Wash' } },
      { id: 'd', notes: 'Call before pickup', team_lead_id: null },
    ])
    assert.equal(notes.length, 2)
    assert.deepEqual(notes[0].services, ['Wash', 'Wax'])
    assert.equal(notes[0].text, 'Scratch on rear bumper')
    assert.equal(notes[0].fromTeamLead, true)
    assert.equal(notes[0].author, 'Tess')
    assert.equal(notes[1].fromTeamLead, false)
  })

  it('profile loads bookings.notes and read-only roles get no guest-note form', () => {
    const src = readFileSync('src/pages/crm/CustomerProfileDialog.jsx', 'utf8')
    assert.match(src, /BOOKING_SELECT =[\s\S]*?notes, team_lead_id/)
    assert.match(src, /canWrite=\{canEditCrm\(profile\)\}/)
    assert.match(readFileSync('src/queue/queueApi.js', 'utf8'), /notes: form\.notes\?\.trim\(\) \|\| null/)
  })
})

const NOW = new Date(2026, 9, 9, 13, 0).getTime() // Oct 9 2026 13:00 local
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString()
const visit = (customer_id, days, extra = {}) => ({ customer_id, status: 'completed', completed_at: daysAgo(days), branch: 'bacoor', final_price_minor: 50000, ...extra })
const ids = (rows) => rows.map((r) => r.id).sort()
const run = (filter, customers, visits) => ids(filterCustomersBySmartGroup(customers, visits, filter, NOW))

const customers = [
  { id: 'new', phone: '09170000001', created_at: daysAgo(10) },
  { id: 'regular', phone: '09170000002', created_at: daysAgo(400) },
  { id: 'lapsed', phone: '', created_at: daysAgo(300) },
  { id: 'never', phone: '09170000004', created_at: daysAgo(5) },
  { id: 'muted', phone: '09170000005', notify_sms: false, created_at: daysAgo(200) },
]
const visits = [
  visit('new', 3),
  visit('regular', 2, { branch: 'batangas' }),
  visit('regular', 40),
  visit('regular', 200),
  visit('lapsed', 120),
  visit('lapsed', 150),
  visit('muted', 20),
  visit('never', 1, { status: 'cancelled' }),
  visit('never', 2, { status: 'no_show' }),
]

describe('CRM smart groups', () => {
  it('presets: visited / new / lapsed / never', () => {
    const p = (id) => CRM_SMART_GROUP_PRESETS.find((g) => g.id === id)
    assert.deepEqual(run(p('visited_7d'), customers, visits), ['new', 'regular'])
    assert.deepEqual(run(p('visited_30d'), customers, visits), ['muted', 'new', 'regular'])
    assert.deepEqual(run(p('new_30d'), customers, visits), ['muted', 'new'], 'regular first came 200 days ago, so is not new')
    assert.deepEqual(run(p('lapsed_90d'), customers, visits), ['lapsed'])
    assert.deepEqual(run(p('never'), customers, visits), ['never'], 'cancelled and no-show bookings are not visits')
  })

  it('custom ranges: weeks, months, between dates, month range, more-than-ago', () => {
    assert.deepEqual(run({ match: 'any', range: { kind: 'last', amount: 6, unit: 'weeks' } }, customers, visits), ['muted', 'new', 'regular'])
    assert.deepEqual(run({ match: 'any', range: { kind: 'last', amount: 5, unit: 'months' } }, customers, visits), ['lapsed', 'muted', 'new', 'regular'])
    assert.deepEqual(run({ match: 'any', range: { kind: 'between', from: '2026-08-25', to: '2026-09-05' } }, customers, visits), ['regular'], '40 days ago = Aug 30')
    assert.deepEqual(run({ match: 'last', range: { kind: 'months', from: '2026-05', to: '2026-06' } }, customers, visits), ['lapsed'], 'last visit Jun 11')
    assert.deepEqual(run({ match: 'any', range: { kind: 'before', amount: 100, unit: 'days' } }, customers, visits), ['lapsed', 'regular'])
    assert.deepEqual(run({ match: 'joined', range: { kind: 'last', amount: 14, unit: 'days' } }, customers, visits), ['never', 'new'])
  })

  it('refinements: visit count, spend, branch, SMS reachable', () => {
    const all = { kind: 'all' }
    assert.deepEqual(run({ match: 'any', range: all, minVisits: 2 }, customers, visits), ['lapsed', 'regular'])
    assert.deepEqual(run({ match: 'any', range: all, maxVisits: 1 }, customers, visits), ['muted', 'new'])
    assert.deepEqual(run({ match: 'any', range: all, minSpendMinor: 150000 }, customers, visits), ['regular'])
    assert.deepEqual(run({ match: 'any', range: all, branch: 'batangas' }, customers, visits), ['regular'])
    assert.deepEqual(run({ match: 'any', range: all, smsOnly: true }, customers, visits), ['new', 'regular'])
  })

  it('one trip with wash + detail is one visit; stats are attached', () => {
    const s = buildCustomerVisitStats([
      visit('x', 5, { visit_group_id: 'g1', final_price_minor: 30000 }),
      visit('x', 5, { visit_group_id: 'g1', final_price_minor: 70000 }),
      visit('x', 50, { id: 'b2', final_price_minor: null, price_minor: 20000 }),
    ]).get('x')
    assert.equal(s.visits, 2)
    assert.equal(s.spendMinor, 120000)
    const [row] = filterCustomersBySmartGroup([{ id: 'x' }], [visit('x', 5)], { match: 'any', range: { kind: 'all' } }, NOW)
    assert.equal(row.stats.visits, 1)
  })

  it('month ranges are whole calendar months; between dates include the end day', () => {
    const r = resolveSmartRange({ kind: 'months', from: '2026-02', to: '2026-02' })
    assert.equal(new Date(r.from).getDate(), 1)
    assert.equal(new Date(r.to).getMonth(), 2)
    const b = resolveSmartRange({ kind: 'between', from: '2026-10-01', to: '2026-10-01' })
    assert.equal(b.to - b.from, 86400000)
    assert.equal(smartRangeError({ kind: 'between', from: '2026-10-05', to: '2026-10-01' }), 'Start is after end.')
    assert.equal(smartRangeError({ kind: 'months' }), 'Pick a start or end date.')
    assert.equal(smartRangeError({ kind: 'last', amount: 3 }), '')
  })

  it('legacy saved groups { mode, days } still work', () => {
    assert.deepEqual(normalizeSmartFilter({ mode: 'lapsed', days: 60 }).range, { kind: 'before', amount: 60, unit: 'days', from: '', to: '' })
    assert.equal(normalizeSmartFilter({ mode: 'never' }).match, 'never')
    assert.deepEqual(run({ mode: 'visited', days: 7 }, customers, visits), ['new', 'regular'])
  })

  it('customer history summary: cadence, average ticket, top services, no-shows', () => {
    const h = summarizeCustomerHistory([
      visit('x', 70, { services: { name: 'Wash' } }),
      visit('x', 40, { services: { name: 'Wash' } }),
      visit('x', 10, { services: { name: 'Ceramic' }, final_price_minor: 200000 }),
      visit('x', 5, { status: 'no_show', services: { name: 'Wash' } }),
      visit('x', 3, { status: 'cancelled' }),
    ], NOW)
    assert.equal(h.visits, 3)
    assert.equal(h.spendMinor, 300000)
    assert.equal(h.avgTicketMinor, 100000)
    assert.equal(h.daysSinceLast, 10)
    assert.equal(h.cadenceDays, 30)
    assert.deepEqual(h.topServices, [{ name: 'Wash', count: 2 }, { name: 'Ceramic', count: 1 }])
    assert.equal(h.noShows, 1)
    assert.equal(h.cancelled, 1)
    assert.equal(summarizeCustomerHistory([], NOW).daysSinceLast, null)
  })

  it('describes the filter in one sentence', () => {
    assert.equal(
      describeSmartFilter({ match: 'first', range: { kind: 'last', amount: 2, unit: 'months' }, minVisits: 2, smsOnly: true }),
      'First visit in the last 2 months · 2+ visits · SMS reachable',
    )
    assert.equal(describeSmartFilter({ match: 'last', range: { kind: 'before', amount: 1, unit: 'weeks' } }), 'Last visit more than 1 week ago')
    assert.equal(describeSmartFilter({ match: 'never' }), 'Never visited')
    assert.match(describeSmartFilter({ match: 'any', range: { kind: 'months', from: '2026-08', to: '2026-10' } }), /^Visited from Aug 2026 to Oct 2026$/)
  })
})
