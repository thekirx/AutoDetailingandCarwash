import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { adminClient } from '../server/supabaseAdmin.mjs'
import { runDetailingBookingReminders } from '../server/bookingReminders.mjs'

describe('server/supabaseAdmin cache and env isolation', () => {
  const origUrl = process.env.SUPABASE_URL
  const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  afterEach(() => {
    if (origUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = origUrl
    if (origKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = origKey
  })

  it('reuses cached client for identical env and swaps when env changes', () => {
    process.env.SUPABASE_URL = 'https://one.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key-one'
    const c1 = adminClient()
    const c2 = adminClient()
    assert.strictEqual(c1, c2)

    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key-two'
    const c3 = adminClient()
    assert.notStrictEqual(c1, c3)
  })
})

describe('runDetailingBookingReminders batched prior-send check', () => {
  it('queries sms_events once in batch rather than N+1 inside the loop', async () => {
    const smsSelectCalls = []
    const bookingsRows = [
      {
        id: 'b-1',
        customer_id: 'c-1',
        customer_name: 'Alice',
        customer_phone: '',
        vehicle_make: 'Toyota',
        vehicle_model: 'Vios',
        vehicle_plate: 'ABC123',
        scheduled_start: '2026-11-16T02:00:00+08:00',
        status: 'confirmed',
        branch: 'bacoor',
        service_id: 's-1',
        services: { name: 'Ceramic Coating', slug: 'ceramic-coating', pay_category: 'detailing' },
        assigned_staff_id: null,
      },
      {
        id: 'b-2',
        customer_id: 'c-2',
        customer_name: 'Bob',
        customer_phone: '',
        vehicle_make: 'Honda',
        vehicle_model: 'City',
        vehicle_plate: 'XYZ999',
        scheduled_start: '2026-11-16T04:00:00+08:00',
        status: 'confirmed',
        branch: 'batangas',
        service_id: 's-1',
        services: { name: 'Ceramic Coating', slug: 'ceramic-coating', pay_category: 'detailing' },
        assigned_staff_id: null,
      },
    ]

    const insertedNotifs = []
    const insertedSmsEvents = []
    const db = {
      from(table) {
        if (table === 'bookings') {
          return {
            select() {
              const chain = {
                in: () => chain,
                eq: () => chain,
                gte: () => chain,
                lte: () => chain,
                limit: async () => ({ data: bookingsRows, error: null }),
              }
              return chain
            },
          }
        }
        if (table === 'app_settings') {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { value: { enabled: false } } }) }) }),
          }
        }
        if (table === 'sms_events') {
          return {
            select() {
              smsSelectCalls.push(1)
              return {
                in: () => ({
                  in: async () => ({
                    data: [{ booking_id: 'b-1', event_type: 'booking_remind_1d' }],
                    error: null,
                  }),
                }),
              }
            },
            insert: async (row) => {
              insertedSmsEvents.push(row)
              return { error: null }
            },
          }
        }
        if (table === 'user_notifications') {
          return {
            insert: async (row) => {
              insertedNotifs.push(row)
              return { error: null }
            },
          }
        }
        throw new Error(`Unexpected table ${table}`)
      },
    }

    const res = await runDetailingBookingReminders(db, '2026-11-15')
    assert.equal(smsSelectCalls.length, 1, 'should execute exactly 1 batched sms_events SELECT')
    assert.equal(res.considered, 2)
    assert.equal(res.sent, 1, 'b-1 already sent in batch result so only b-2 should send')
    assert.equal(insertedNotifs.length, 1)
    assert.equal(insertedNotifs[0].user_id, 'c-2')
    assert.equal(insertedSmsEvents.length, 1)
    assert.equal(insertedSmsEvents[0].booking_id, 'b-2')
  })
})
