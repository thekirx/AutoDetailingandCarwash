import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  computeDetailingScheduledStart,
  matchDetailingServiceRow,
  resolveDetailingBranchSlug,
  submitPublicOpsFormAndSync,
} from '../server/publicOpsForm.mjs'

const SAMPLE_BRANCHES = [
  { slug: 'bacoor', name: 'Hakum Auto Care Bacoor', is_public: true, is_active: true, is_archived: false, coming_soon: false },
  { slug: 'batangas', name: 'Hakum Auto Care Batangas', is_public: true, is_active: true, is_archived: false, coming_soon: false },
  { slug: 'imus', name: 'Hakum Auto Care Imus', is_public: true, is_active: true, is_archived: false, coming_soon: true },
  { slug: 'hq', name: 'HQ', is_public: false, is_active: true, is_archived: false, coming_soon: false },
]

const SAMPLE_SERVICES = [
  {
    id: 'svc-ceramic',
    name: '3-Year Ceramic Coating',
    slug: 'ceramic-coating',
    pay_category: 'detailing',
    price_minor: 1500000,
    is_active: true,
    is_archived: false,
    service_size_prices: [{ size_slug: 'medium', price_minor: 1500000 }],
  },
  {
    id: 'svc-tint',
    name: 'Nano Ceramic Tint',
    slug: 'nano-ceramic-tint',
    pay_category: 'detailing',
    price_minor: 800000,
    is_active: true,
    is_archived: false,
    service_size_prices: [],
  },
  {
    id: 'svc-ppf',
    name: 'Full Front PPF',
    slug: 'paint-protection-film',
    pay_category: 'ppf',
    price_minor: 3500000,
    is_active: true,
    is_archived: false,
    service_size_prices: [{ size_slug: 'large', price_minor: 4200000 }],
  },
  {
    id: 'svc-wash',
    name: 'Basic Wash',
    slug: 'basic-wash',
    pay_category: 'wash',
    price_minor: 25000,
    is_active: true,
    is_archived: false,
    service_size_prices: [],
  },
]

function createMockDb({
  formRow = null,
  branches = SAMPLE_BRANCHES,
  services = SAMPLE_SERVICES,
  rpcResult = { data: { id: 'sub-1' }, error: null },
  hasBookingColumn = true,
} = {}) {
  const opsLog = []

  const makeChain = (table) => {
    const state = { filters: {}, action: 'select', payload: null }
    const exec = async () => {
      opsLog.push({ table, ...state })
      if (table === 'ops_forms') {
        return { data: formRow, error: null }
      }
      if (table === 'branches') {
        return { data: branches, error: null }
      }
      if (table === 'services') {
        return { data: services, error: null }
      }
      if (table === 'bookings' && state.action === 'insert') {
        return {
          data: { id: 'bk-placeholder-1', ...state.payload },
          error: null,
        }
      }
      if (table === 'ops_form_submissions' && state.action === 'update') {
        if (!hasBookingColumn && state.payload && 'booking_id' in state.payload) {
          return { error: { message: 'column "booking_id" of relation "ops_form_submissions" does not exist' } }
        }
        return { data: state.payload, error: null }
      }
      return { data: null, error: null }
    }

    const chain = {
      select() { return chain },
      eq(col, val) {
        state.filters[col] = val
        return chain
      },
      insert(row) {
        state.action = 'insert'
        state.payload = row
        return chain
      },
      update(patch) {
        state.action = 'update'
        state.payload = patch
        return chain
      },
      delete() {
        state.action = 'delete'
        return chain
      },
      maybeSingle: exec,
      single: exec,
      then(onFulfilled, onRejected) {
        return exec().then(onFulfilled, onRejected)
      },
    }
    return chain
  }

  return {
    opsLog,
    rpcCalls: [],
    from: (table) => makeChain(table),
    async rpc(fn, args) {
      this.rpcCalls.push({ fn, args })
      return rpcResult
    },
  }
}

describe('publicOpsForm helpers & Detailing Placeholder sync', () => {
  it('matches active detailing services and ignores wash-only services', () => {
    assert.equal(matchDetailingServiceRow(SAMPLE_SERVICES, 'Ceramic Coating')?.id, 'svc-ceramic')
    assert.equal(matchDetailingServiceRow(SAMPLE_SERVICES, 'Nano Ceramic Tint')?.id, 'svc-tint')
    assert.equal(matchDetailingServiceRow(SAMPLE_SERVICES, 'Paint Protection Film (PPF)')?.id, 'svc-ppf')
    assert.equal(matchDetailingServiceRow(SAMPLE_SERVICES, 'Other detailing')?.id, 'svc-ceramic')
    assert.equal(matchDetailingServiceRow([SAMPLE_SERVICES[3]], 'Ceramic Coating'), null)
  })

  it('resolves open public branches cleanly and rejects ambiguous or closed branches', () => {
    assert.equal(resolveDetailingBranchSlug(SAMPLE_BRANCHES, 'bacoor'), 'bacoor')
    assert.equal(resolveDetailingBranchSlug(SAMPLE_BRANCHES, 'Batangas'), 'batangas')
    assert.equal(resolveDetailingBranchSlug(SAMPLE_BRANCHES, 'ba'), null)
    assert.equal(resolveDetailingBranchSlug(SAMPLE_BRANCHES, 'imus'), null)
    assert.equal(resolveDetailingBranchSlug(SAMPLE_BRANCHES, 'hq'), null)
    assert.equal(resolveDetailingBranchSlug(SAMPLE_BRANCHES, ''), 'bacoor')
  })

  it('inserts staff submissions directly with source=staff without a public flicker', async () => {
    const db = createMockDb({
      formRow: {
        id: 'f-fb',
        name: 'Customer Complaints',
        kind: 'complaint',
        slug: 'customer-complaints',
        fields: [
          { key: 'customer_name', label: 'Customer name', type: 'text', required: true },
          { key: 'category', label: 'Category', type: 'text', required: true },
          { key: 'description', label: 'Description', type: 'textarea', required: true },
        ],
        public_enabled: true,
        is_active: true,
        status: 'published',
      },
    })
    const res = await submitPublicOpsFormAndSync({
      db,
      slug: 'customer-complaints',
      source: 'staff',
      payload: { customer_name: 'Ana', category: 'Service', description: 'Follow-up note' },
      notifyComplaint: async () => ({ ok: true }),
    })
    assert.equal(res.status, 200)
    assert.equal(db.rpcCalls.length, 0)
    const directInsert = db.opsLog.find((op) => op.table === 'ops_form_submissions' && op.action === 'insert')
    assert.equal(directInsert.payload.source, 'staff')
  })

  it('computes Manila morning slot from preferred_date or defaults +2 days ahead', () => {
    assert.equal(computeDetailingScheduledStart('2026-12-01'), '2026-12-01T01:00:00.000Z')
    const fallback = computeDetailingScheduledStart('', Date.UTC(2026, 10, 16, 4, 0, 0))
    assert.match(fallback, /^2026-11-18T01:00:00\.000Z$/)
  })

  it('returns 410 Gone for retired Events RSVP forms', async () => {
    const db = createMockDb({
      formRow: { id: 'f-ev', name: 'Events RSVP', kind: 'event', slug: 'events-rsvp', public_enabled: true, is_active: true, status: 'published' },
    })
    const res = await submitPublicOpsFormAndSync({
      db,
      slug: 'events-rsvp',
      payload: { name: 'Ana', phone: '09171234567' },
    })
    assert.equal(res.status, 410)
    assert.match(res.error, /retired/i)
    assert.equal(db.rpcCalls.length, 0)
  })

  it('creates a linked Booking Placeholder ("pending") booking when submitting a detailing form', async () => {
    const db = createMockDb({
      formRow: {
        id: 'f-det',
        name: 'Detailing inquiry',
        kind: 'detailing',
        slug: 'detailing-inquiry',
        public_enabled: true,
        is_active: true,
        status: 'published',
      },
    })
    const notifyCalls = []
    const res = await submitPublicOpsFormAndSync({
      db,
      slug: 'detailing-inquiry',
      payload: {
        customer_name: 'Carlos Reyes',
        phone: '09171234567',
        plate: 'abc-123',
        service: 'Ceramic Coating',
        branch: 'bacoor',
        preferred_date: '2026-12-05',
      },
      notifyBooking: async (booking, status) => {
        notifyCalls.push({ booking, status })
        return { ok: true }
      },
    })

    assert.equal(res.status, 200)
    assert.equal(res.formKind, 'detailing')
    assert.equal(res.booking?.status, 'pending')
    assert.equal(res.booking?.branch, 'bacoor')

    const bookingInsert = db.opsLog.find((op) => op.table === 'bookings' && op.action === 'insert')
    assert.equal(bookingInsert.payload.status, 'pending')
    assert.equal(bookingInsert.payload.vehicle_plate, 'ABC-123')
    assert.equal(bookingInsert.payload.vehicle_make, 'TBD')
    assert.equal(bookingInsert.payload.vehicle_model, 'Pending')
    assert.equal(bookingInsert.payload.service_id, 'svc-ceramic')
    assert.equal(bookingInsert.payload.price_minor, 1500000)

    const linkUpdate = db.opsLog.find((op) => op.table === 'ops_form_submissions' && op.action === 'update')
    assert.equal(linkUpdate.payload.booking_id, 'bk-placeholder-1')
    assert.equal(linkUpdate.payload.payload.booking_id, 'bk-placeholder-1')
    assert.equal(linkUpdate.payload.payload.booking_status, 'pending')
    assert.equal(notifyCalls.length, 1)
    assert.equal(notifyCalls[0].status, 'pending')
  })

  it('falls back cleanly when ops_form_submissions.booking_id column is not yet migrated', async () => {
    const db = createMockDb({
      formRow: {
        id: 'f-det',
        name: 'Detailing inquiry',
        kind: 'detailing',
        slug: 'detailing-inquiry',
        public_enabled: true,
        is_active: true,
        status: 'published',
      },
      hasBookingColumn: false,
    })

    const res = await submitPublicOpsFormAndSync({
      db,
      slug: 'detailing-inquiry',
      payload: {
        customer_name: 'Maya Cruz',
        phone: '09181112222',
        plate: 'XYZ-999',
        service: 'Paint Protection Film (PPF)',
        branch: 'batangas',
      },
      notifyBooking: async () => ({ ok: true }),
    })

    assert.equal(res.status, 200)
    const fallbackUpdate = db.opsLog.filter((op) => op.table === 'ops_form_submissions' && op.action === 'update').at(-1)
    assert.equal('booking_id' in fallbackUpdate.payload, false)
    assert.equal(fallbackUpdate.payload.payload.booking_id, 'bk-placeholder-1')
    assert.equal(fallbackUpdate.payload.payload.booking_status, 'pending')
  })

  it('rolls back orphan submission row if detailing branch validation fails', async () => {
    const db = createMockDb({
      formRow: {
        id: 'f-det',
        name: 'Detailing inquiry',
        kind: 'detailing',
        slug: 'detailing-inquiry',
        public_enabled: true,
        is_active: true,
        status: 'published',
      },
    })

    const res = await submitPublicOpsFormAndSync({
      db,
      slug: 'detailing-inquiry',
      payload: {
        customer_name: 'Bad Branch',
        phone: '09181112222',
        plate: 'AAA-111',
        service: 'Ceramic Coating',
        branch: 'imus',
      },
    })

    assert.equal(res.status, 400)
    assert.match(res.error, /available branch/i)
    assert.ok(db.opsLog.some((op) => op.table === 'ops_form_submissions' && op.action === 'delete'))
  })
})
