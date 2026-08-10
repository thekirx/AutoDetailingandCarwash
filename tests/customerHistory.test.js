import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildHistoryTimeline,
  classifyHistoryQuery,
  filterHistoryTimeline,
  normalizeHistoryPhone,
  normalizeHistoryPlate,
  phonesMatch,
  platesMatch,
} from '../src/lib/customerHistory.js'
import { canAccessHistory, getOperationsNav, getSalesDock, ROLES } from '../src/auth/permissions.js'

describe('customer history search helpers', () => {
  it('normalizes plate and phone', () => {
    assert.equal(normalizeHistoryPlate('ab-12 34'), 'AB1234')
    assert.equal(normalizeHistoryPhone('+63 917-123-4567'), '639171234567')
  })

  it('classifies plate vs phone queries', () => {
    assert.equal(classifyHistoryQuery('ABC-1234').kind, 'plate')
    assert.equal(classifyHistoryQuery('09171234567').kind, 'phone')
    assert.ok(phonesMatch('09171234567', '+639171234567'))
    assert.ok(platesMatch('ABC 1234', 'abc-1234'))
  })

  it('builds and filters a mixed timeline', () => {
    const timeline = buildHistoryTimeline({
      bookings: [
        {
          id: 'b1',
          status: 'completed',
          branch: 'bacoor',
          vehicle_plate: 'ABC123',
          created_at: '2026-01-01T00:00:00Z',
          scheduled_start: '2026-01-01T08:00:00Z',
          completed_at: '2026-01-02T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
          final_price_minor: 150000,
          services: { name: 'Ceramic Coating', pay_category: 'detailing', slug: 'ceramic-coating' },
        },
      ],
      maintenance: [
        {
          id: 'm1',
          status: 'scheduled',
          plate_number: 'ABC123',
          branch_slug: 'bacoor',
          next_due_at: '2026-07-02',
          updated_at: '2026-01-02T00:00:00Z',
          service_slug: 'ceramic-coating',
        },
      ],
      sales: [
        {
          id: 's1',
          status: 'paid',
          branch: 'bacoor',
          total_minor: 150000,
          payment_method: 'gcash',
          occurred_at: '2026-01-02T01:00:00Z',
        },
      ],
    })
    assert.equal(timeline.length, 3)
    assert.equal(timeline[0].kind, 'sale')
    const bookingEv = timeline.find((e) => e.kind === 'booking')
    assert.equal(bookingEv.startedAt, '2026-01-01T08:00:00Z')
    assert.equal(bookingEv.endedAt, '2026-01-02T00:00:00Z')
    assert.ok(bookingEv.statusAt)

    const onlyMaint = filterHistoryTimeline(timeline, { kinds: ['maintenance'] })
    assert.equal(onlyMaint.length, 1)
    assert.equal(onlyMaint[0].kind, 'maintenance')

    const detailing = filterHistoryTimeline(timeline, {
      kinds: ['booking'],
      serviceKind: 'detailing',
    })
    assert.equal(detailing.length, 1)
  })
})

describe('history RBAC + nav', () => {
  it('allows SA ASA Sales TL Marketing Branch Admin', () => {
    assert.equal(canAccessHistory({ role: 'BossMich' }), true)
    assert.equal(canAccessHistory({ role: 'assistant_super_admin' }), true)
    assert.equal(canAccessHistory({ role: ROLES.SALES }), true)
    assert.equal(canAccessHistory({ role: ROLES.TEAM_LEAD }), true)
    assert.equal(canAccessHistory({ role: ROLES.MARKETING }), true)
    assert.equal(canAccessHistory({ role: ROLES.ADMIN }), true)
    assert.equal(canAccessHistory({ role: ROLES.STAFF }), false)
  })

  it('puts History on Sales / Marketing / Branch Admin nav', () => {
    assert.ok(getOperationsNav({ role: ROLES.SALES }).some((i) => i.to === '/operations/history'))
    assert.ok(getOperationsNav({ role: ROLES.MARKETING }).some((i) => i.to === '/operations/history'))
    assert.ok(getOperationsNav({ role: ROLES.ADMIN }).some((i) => i.to === '/operations/history'))
    assert.ok(getSalesDock({ role: ROLES.SALES }).some((i) => i.to === '/operations/history'))
  })
})
