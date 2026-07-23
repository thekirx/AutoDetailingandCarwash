import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]
    }),
)

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const { error: ae } = await client.auth.signInWithPassword({
  email: 'admin@hakumautocare.com',
  password: 'HakumAdmin2026!',
})
if (ae) {
  console.error('login', ae.message)
  process.exit(1)
}

const { data: handoffs, error: he } = await client
  .from('pos_handoffs')
  .select(
    'id, booking_id, branch, amount_minor, bookings(customer_id, service_id, vehicle_plate, final_price_minor)',
  )
  .eq('status', 'pending')
  .limit(1)
if (he) {
  console.error('handoffs', he.message)
  process.exit(1)
}

const h = handoffs?.[0]
if (!h) {
  console.log('no pending handoff')
  process.exit(0)
}

const svc = h.bookings?.service_id
const amount = h.amount_minor || h.bookings?.final_price_minor || 35000
const { data, error } = await client.rpc('complete_pos_sale', {
  payload: {
    branch: h.branch,
    customer_id: h.bookings?.customer_id || null,
    booking_id: h.booking_id,
    pos_handoff_id: h.id,
    payment_method: 'cash',
    status: 'paid',
    lines: [
      {
        item_type: 'service',
        service_id: svc,
        name: 'Audit pay',
        quantity: 1,
        unit_price_minor: amount,
      },
    ],
  },
})
if (error) {
  console.error('FAIL', error.message)
  process.exit(1)
}

const { data: ph } = await client.from('pos_handoffs').select('status').eq('id', h.id).single()
const { data: bk } = await client.from('bookings').select('status').eq('id', h.booking_id).single()
console.log('PASS sale', data?.sale_id, 'handoff', ph?.status, 'booking', bk?.status)
