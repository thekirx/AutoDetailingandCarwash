/**
 * Part 2 POS shell smoke: catalog columns, vehicle_sizes, provision roles, handoff RPC.
 * node scripts/e2e-pos-part2.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { QUEUE_PROVISION_ROLES } from '../server/provisionCustomer.mjs'
import { buildPosSalePayload } from '../src/lib/posSale.js'
import { normalizeVehicleType } from '../src/queue/queueLogic.js'
import { allowRoute, canManageServices, getOperationsNav, ROLES } from '../src/auth/permissions.js'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1)
    if (!process.env[k]) process.env[k] = v
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && anon && service, 'missing supabase env')

const results = []

// Matrix: POS tabs owned by Admin+; no standalone services/products nav
assert(allowRoute({ role: ROLES.ADMIN }, 'pos'), 'admin pos')
assert(!canManageServices({ role: ROLES.ADMIN }), 'branch admin checkout-only (no manage services)')
assert(canManageServices({ role: ROLES.SUPER_ADMIN }), 'super admin manage services')
assert(!getOperationsNav({ role: ROLES.SUPER_ADMIN }).some((i) => i.to === '/operations/services'), 'no services nav')
assert(!getOperationsNav({ role: ROLES.SUPER_ADMIN }).some((i) => i.to === '/operations/products'), 'no products nav')
results.push('matrix.pos_shell: ok')

assert(QUEUE_PROVISION_ROLES.has('BossMich'))
assert(QUEUE_PROVISION_ROLES.has('admin'))
assert(QUEUE_PROVISION_ROLES.has('assistant_super_admin'))
assert(QUEUE_PROVISION_ROLES.has('team_lead'))
assert(!QUEUE_PROVISION_ROLES.has('sales'))
results.push('provision.roles: ok')

const loyalty = buildPosSalePayload({
  branch: 'bacoor',
  customerId: 'c1',
  paymentMethod: 'cash',
  cart: [{ item_type: 'service', id: 's1', name: 'X', quantity: 1, unit_price_minor: 100, is_loyalty_award: true }],
  activeHandoff: null,
})
assert(loyalty.lines[0].unit_price_minor === 0, 'loyalty line must be free')
assert(normalizeVehicleType('custom-size') === 'custom_size', 'custom vehicle slug')
results.push('payload.loyalty_and_vehicle: ok')

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: sizes, error: sizeErr } = await admin
  .from('vehicle_sizes')
  .select('slug, label, is_active')
  .eq('is_active', true)
  .order('sort_order')
assert(!sizeErr, `vehicle_sizes: ${sizeErr?.message}`)
assert((sizes?.length || 0) >= 4, `expected seeded vehicle_sizes, got ${sizes?.length}`)
results.push(`db.vehicle_sizes: ${sizes.length}`)

const { data: svc, error: svcErr } = await admin.from('services').select('id, pay_category').limit(1)
assert(!svcErr, `services.pay_category: ${svcErr?.message}`)
assert(svc?.[0] && 'pay_category' in svc[0], 'pay_category column missing')
results.push('db.services.pay_category: ok')

const { data: prod, error: prodErr } = await admin.from('products').select('id, stock_group').limit(1)
assert(!prodErr, `products.stock_group: ${prodErr?.message}`)
results.push(`db.products.stock_group: ${prod?.[0]?.stock_group != null ? 'present' : 'nullable-ok'}`)

const { data: rpcDef, error: rpcErr } = await admin.rpc('send_queue_ticket_to_payment', {
  input_booking_id: '00000000-0000-0000-0000-000000000000',
})
// Expect a clean business error, not missing function
assert(
  rpcErr && !/Could not find the function|PGRST202/i.test(rpcErr.message || ''),
  `handoff RPC missing or broken: ${rpcErr?.message || 'unexpected success'}`,
)
results.push(`rpc.send_queue_ticket_to_payment: reachable (${rpcErr.message.slice(0, 80)})`)
void rpcDef

console.log(results.join('\n'))
console.log('e2e-pos-part2: PASS')
