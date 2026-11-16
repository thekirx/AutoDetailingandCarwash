import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { handleFormResultsAction } from '../server/formResultsStore.mjs'

function createFormResultsMockDb({
  callerRole = 'BossMich',
  submissionRow = null,
  bookingRow = null,
} = {}) {
  const ops = []

  const chainFor = (table) => {
    const state = { table, action: 'select', patch: null, filters: {} }
    const exec = async () => {
      ops.push({ ...state })
      if (table === 'staff_profiles') {
        return { data: { id: 'user-1', role: callerRole, is_active: true }, error: null }
      }
      if (table === 'staff_branch_assignments') {
        return { data: [], error: null }
      }
      if (table === 'ops_form_submissions' && state.action === 'select') {
        return { data: submissionRow, error: null }
      }
      if (table === 'ops_form_submissions' && state.action === 'update') {
        return {
          data: { ...(submissionRow || {}), ...(state.patch || {}), id: state.filters.id || submissionRow?.id },
          error: null,
        }
      }
      if (table === 'ops_form_submissions' && state.action === 'delete') {
        return { error: null }
      }
      if (table === 'bookings' && state.action === 'select') {
        return { data: bookingRow, error: null }
      }
      if (table === 'bookings' && state.action === 'update') {
        return { data: { ...(bookingRow || {}), ...(state.patch || {}) }, error: null }
      }
      return { data: [], error: null }
    }

    const chain = {
      select() { return chain },
      eq(col, val) {
        state.filters[col] = val
        return chain
      },
      neq() { return chain },
      in() { return chain },
      order() { return chain },
      limit() { return chain },
      update(patch) {
        state.action = 'update'
        state.patch = patch
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
    ops,
    auth: {
      async getUser(token) {
        return token === 'valid-token'
          ? { data: { user: { id: 'user-1' } }, error: null }
          : { data: { user: null }, error: new Error('Invalid token') }
      },
    },
    from: (table) => chainFor(table),
  }
}

describe('formResultsStore non-destructive sync & RBAC', () => {
  it('blocks non-Owner mutations with 403', async () => {
    const admin = createFormResultsMockDb({ callerRole: 'assistant_super_admin' })
    await assert.rejects(
      () =>
        handleFormResultsAction({
          admin,
          accessToken: 'valid-token',
          action: 'update-form-submission',
          body: { id: 'sub-1', status: 'resolved' },
        }),
      (err) => err.status === 403,
    )
  })

  it('syncs Owner edits on detailing answers & status onto active bookings without touching completed books', async () => {
    const activeBooking = {
      id: 'bk-1',
      status: 'pending',
      customer_name: 'Old Name',
      customer_phone: '09170000000',
      vehicle_plate: 'OLD-1',
      scheduled_start: '2026-12-01T01:00:00.000Z',
    }
    const sub = {
      id: 'sub-1',
      booking_id: 'bk-1',
      status: 'new',
      payload: { customer_name: 'Old Name', phone: '09170000000', plate: 'OLD-1' },
      ops_forms: { id: 'f-det', kind: 'detailing' },
    }
    const admin = createFormResultsMockDb({ submissionRow: sub, bookingRow: activeBooking })
    const notified = []

    await handleFormResultsAction({
      admin,
      accessToken: 'valid-token',
      action: 'update-form-submission',
      body: {
        id: 'sub-1',
        status: 'confirmed',
        calendar_at: '2026-12-03T02:00:00.000Z',
        payload: { customer_name: 'New Name', phone: '09189999999', plate: 'new-99' },
      },
      notifyBooking: async (b, s) => notified.push({ id: b.id, status: s }),
    })

    const bookingUpd = admin.ops.find((o) => o.table === 'bookings' && o.action === 'update')
    assert.equal(bookingUpd.patch.status, 'confirmed')
    assert.equal(bookingUpd.patch.customer_name, 'New Name')
    assert.equal(bookingUpd.patch.customer_phone, '09189999999')
    assert.equal(bookingUpd.patch.vehicle_plate, 'NEW-99')
    assert.equal(bookingUpd.patch.scheduled_start, '2026-12-03T02:00:00.000Z')
    assert.deepEqual(notified, [{ id: 'bk-1', status: 'confirmed' }])

    // Completed booking: form answers edit must NOT rewrite completed ledger booking
    const completedAdmin = createFormResultsMockDb({
      submissionRow: sub,
      bookingRow: { ...activeBooking, status: 'completed' },
    })
    await handleFormResultsAction({
      admin: completedAdmin,
      accessToken: 'valid-token',
      action: 'update-form-submission',
      body: {
        id: 'sub-1',
        payload: { customer_name: 'Amended Label' },
      },
    })
    assert.equal(completedAdmin.ops.some((o) => o.table === 'bookings' && o.action === 'update'), false)
  })

  it('soft-cancels untouched pending placeholder on detailing submission delete, leaving confirmed bookings intact', async () => {
    const pendingAdmin = createFormResultsMockDb({
      submissionRow: {
        id: 'sub-p',
        booking_id: 'bk-p',
        payload: { booking_id: 'bk-p' },
        ops_forms: { id: 'f-det', kind: 'detailing' },
      },
      bookingRow: { id: 'bk-p', status: 'pending', is_archived: false },
    })
    await handleFormResultsAction({
      admin: pendingAdmin,
      accessToken: 'valid-token',
      action: 'delete-form-submission',
      body: { id: 'sub-p' },
    })
    const softCancel = pendingAdmin.ops.find((o) => o.table === 'bookings' && o.action === 'update')
    assert.deepEqual(softCancel.patch, { status: 'cancelled', is_archived: true })
    assert.equal(pendingAdmin.ops.some((o) => o.table === 'bookings' && o.action === 'delete'), false)

    const confirmedAdmin = createFormResultsMockDb({
      submissionRow: {
        id: 'sub-c',
        booking_id: 'bk-c',
        payload: { booking_id: 'bk-c' },
        ops_forms: { id: 'f-det', kind: 'detailing' },
      },
      bookingRow: { id: 'bk-c', status: 'confirmed', is_archived: false },
    })
    await handleFormResultsAction({
      admin: confirmedAdmin,
      accessToken: 'valid-token',
      action: 'delete-form-submission',
      body: { id: 'sub-c' },
    })
    assert.equal(confirmedAdmin.ops.some((o) => o.table === 'bookings' && o.action === 'update'), false)
  })

  it('returns 410 Gone for retired event registration actions', async () => {
    const admin = createFormResultsMockDb()
    for (const action of ['update-event-registration', 'delete-event-registration']) {
      await assert.rejects(
        () => handleFormResultsAction({ admin, accessToken: 'valid-token', action, body: { id: 'r1' } }),
        (err) => err.status === 410,
      )
    }
  })
})
