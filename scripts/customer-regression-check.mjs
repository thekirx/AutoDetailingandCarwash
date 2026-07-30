/**
 * Static regression checks for customer critical/high fixes.
 * Run: node scripts/customer-regression-check.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const publicBook = read('server/publicBook.mjs')
assert.match(publicBook, /resolveBookingCustomerId/)
assert.doesNotMatch(publicBook, /\.eq\('phone',\s*customer_phone\)/)
assert.doesNotMatch(publicBook, /user_metadata\?\.role === 'customer'/)

const portal = read('server/customerPortal.mjs')
assert.match(portal, /CUSTOMER_ACTIVE_VISIT_STATUSES/)
assert.match(portal, /That phone is already on another Hakum account/)

const queuePage = read('src/pages/PublicQueuePage.jsx')
assert.doesNotMatch(queuePage, /\.on\('postgres_changes'/)
assert.doesNotMatch(queuePage, /table:\s*'bookings'/)
assert.match(queuePage, /PUBLIC_QUEUE_POLL_MS/)

const authProvider = read('src/auth/AuthProvider.jsx')
assert.doesNotMatch(authProvider, /source:\s*'auth_metadata'/)
assert.doesNotMatch(authProvider, /user_metadata\?\.role === 'customer'/)

const provision = read('server/provisionCustomer.mjs')
assert.match(provision, /buildProvisionInviteMessage/)
assert.match(provision, /authCreateUserIdForCrm|createPayload\.id/)
assert.match(provision, /remountCustomerOntoAuthUid/)
assert.doesNotMatch(provision, /Set your password here: \$\{actionLink\}/)

const lookup = read('server/customerAuthLookup.mjs')
assert.match(lookup, /publicAuthLookupPayload/)

const migration = read('supabase/migrations/20260730180000_customer_public_harden.sql')
assert.match(migration, /security_invoker = false/)
assert.match(migration, /Public can read safe active queue rows/)
assert.match(migration, /customers_active_phone_uidx/)

console.log('customer-regression-check: ok')
