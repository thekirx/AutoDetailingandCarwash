import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  BOOKING_CUSTOMER_EMBED,
  BOOKING_PROJECTIONS,
  BOOKING_SERVICE_EMBED,
  claimBookingReschedule,
  countActiveVoucherHolds,
  findBookingById,
  findCustomerBooking,
  listCompletedBookingsForReview,
  listUpcomingDetailingBookings,
} from '../server/bookingRepo.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvIfPresent() {
  const envPath = join(root, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 1) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
}

describe('server/bookingRepo seam & PostgREST embed invariants', () => {
  it('uses explicit bookings_customer_id_fkey disambiguation and canonical service embed', () => {
    assert.equal(BOOKING_CUSTOMER_EMBED, 'customers!bookings_customer_id_fkey(full_name)')
    assert.equal(BOOKING_SERVICE_EMBED, 'services(name, slug, pay_category)')
    assert.match(BOOKING_PROJECTIONS.reschedule, /customers!bookings_customer_id_fkey\(full_name\)/)
    assert.match(BOOKING_PROJECTIONS.rateVisit, /customers!bookings_customer_id_fkey\(full_name\)/)
  })

  it('prevents un-disambiguated bookings -> customers(...) embeds anywhere in server/', () => {
    for (const [name, projection] of Object.entries(BOOKING_PROJECTIONS)) {
      const badEmbeds = projection.match(/(?<!!)customers\s*\(/g) || []
      assert.equal(badEmbeds.length, 0, `BOOKING_PROJECTIONS.${name} contains bare customers(...) embed`)
    }
    const serverFiles = readdirSync(join(root, 'server')).filter((f) => f.endsWith('.mjs'))
    for (const file of serverFiles) {
      const src = readFileSync(join(root, 'server', file), 'utf8')
      const matches = [...src.matchAll(/\.from\(['"]bookings['"]\)/g)]
      for (const m of matches) {
        const window = src.slice(m.index, m.index + 500)
        if (/\.from\(['"](?!bookings)/.test(window.slice(15))) {
          const nextTable = window.indexOf('.from(', 15)
          const snippet = nextTable > -1 ? window.slice(0, nextTable) : window
          const badEmbeds = snippet.match(/(?<!bookings_customer_id_fkey|bookings_referred_customer_id_fkey)\)?\s*(?<![!a-zA-Z0-9_])customers\s*\(/g) || []
          assert.equal(badEmbeds.length, 0, `${file} contains bare customers(...) embed on bookings query`)
        } else {
          const badEmbeds = window.match(/(?<![!a-zA-Z0-9_])customers\s*\(/g) || []
          assert.equal(badEmbeds.length, 0, `${file} contains bare customers(...) embed on bookings query`)
        }
      }
    }
  })

  it('delegates find, reschedule claim, voucher holds, and reminder queries cleanly', async () => {
    const calls = []
    const makeChain = (table, terminalData = { data: null, error: null, count: 3 }) => {
      const chain = {
        select(cols, opts) {
          calls.push({ table, op: 'select', cols, opts })
          return chain
        },
        update(patch) {
          calls.push({ table, op: 'update', patch })
          return chain
        },
        eq(col, val) {
          calls.push({ table, op: 'eq', col, val })
          return chain
        },
        is(col, val) {
          calls.push({ table, op: 'is', col, val })
          return chain
        },
        in(col, val) {
          calls.push({ table, op: 'in', col, val })
          return chain
        },
        not(col, op, val) {
          calls.push({ table, op: 'not', col, opName: op, val })
          return Promise.resolve(terminalData)
        },
        gte() {
          return chain
        },
        lte() {
          return chain
        },
        order() {
          return chain
        },
        limit() {
          return Promise.resolve({ data: [{ id: 'b-1' }], error: null })
        },
        maybeSingle: async () => terminalData,
      }
      return chain
    }
    const db = { from: (t) => makeChain(t) }

    await findBookingById(db, 'b-1')
    assert.ok(calls.some((c) => c.op === 'select' && c.cols === BOOKING_PROJECTIONS.statusDetail))

    await findCustomerBooking(db, { bookingId: 'b-1', userId: 'u-1' })
    assert.ok(calls.some((c) => c.op === 'select' && c.cols === BOOKING_PROJECTIONS.reschedule))

    await claimBookingReschedule(db, {
      bookingId: 'b-1',
      userId: 'u-1',
      timestamp: '2026-11-24T00:00:00Z',
      openStatuses: ['pending', 'confirmed'],
    })
    assert.ok(calls.some((c) => c.op === 'is' && c.col === 'reschedule_requested_at' && c.val === null))

    const holds = await countActiveVoucherHolds(db, 'v-1')
    assert.equal(holds, 3)

    // Rate-visit and reminder list queries
    const rateDb = {
      from: () => ({
        select: () => ({
          eq() {
            return this
          },
          not() {
            return this
          },
          gte() {
            return this
          },
          order() {
            return this
          },
          limit: async () => ({ data: [{ id: 'rv-1' }], error: null }),
        }),
      }),
    }
    const rvRes = await listCompletedBookingsForReview(rateDb, { sinceIso: '2026-11-24T00:00:00Z' })
    assert.equal(rvRes.data.length, 1)

    const remDb = {
      from: () => ({
        select: () => ({
          in() {
            return this
          },
          eq() {
            return this
          },
          gte() {
            return this
          },
          lte() {
            return this
          },
          limit: async () => ({ data: [{ id: 'rem-1' }], error: null }),
        }),
      }),
    }
    const remRes = await listUpcomingDetailingBookings(remDb, {
      fromIso: '2026-11-24T00:00:00Z',
      toIso: '2026-12-01T00:00:00Z',
    })
    assert.equal(remRes.data.length, 1)
  })

  it('validates every BOOKING_PROJECTIONS select against live PostgREST schema when Supabase env is loaded', async (t) => {
    loadEnvIfPresent()
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      t.skip('No live Supabase env in CI; skipping live PostgREST schema contract check')
      return
    }
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    for (const [name, projection] of Object.entries(BOOKING_PROJECTIONS)) {
      const { error } = await admin.from('bookings').select(projection).limit(1)
      assert.equal(error, null, `BOOKING_PROJECTIONS.${name} failed live PostgREST validation: ${error?.message}`)
    }
  })
})
