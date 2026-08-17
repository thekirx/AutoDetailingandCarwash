/**
 * Principal QA E2E for request.md — frontend contracts + live backend + build.
 *
 * node scripts/e2e-request-brief.mjs
 */
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCustomerPortal, mutateCustomerPortal } from '../server/customerPortal.mjs'
import { buildCompletedVisitReview } from '../src/lib/serviceReviews.js'
import { isValidCustomerPlate } from '../src/lib/customerAuth.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'

if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1)
    if (!process.env[k]) process.env[k] = v.replace(/^["']|["']$/g, '')
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function run(label, cmd, extra = {}) {
  console.log(`\n━━━ ${label} ━━━`)
  const [bin, ...args] = cmd
  const r = spawnSync(bin, args, {
    cwd: extra.cwd || root,
    encoding: 'utf8',
    shell: extra.shell ?? false,
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  })
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  const code = r.status ?? 1
  if (code !== 0) {
    console.error(`\nFAIL ${label} exit=${code}`)
    process.exit(code)
  }
  console.log(`PASS ${label}`)
}

const UNIT_STEPS = [
  ['request brief contracts', [process.execPath, '--test', 'tests/requestBriefE2e.test.js']],
  ['visit reviews + plate', [process.execPath, '--test', 'tests/serviceReviews.test.js', 'tests/customerAuth.test.js', 'tests/serviceReviewsRls.test.js']],
  ['principal QA flows + matrix', [process.execPath, '--test', 'tests/principalQaFlows.test.js', 'tests/principalQaMatrix.test.js']],
]

for (const [label, cmd] of UNIT_STEPS) run(label, cmd)

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && anonKey && service, 'missing SUPABASE_URL / anon key / SERVICE_ROLE_KEY')

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
const results = []
const stamp = Date.now().toString(36).toUpperCase()
const email = `qa.req.${stamp.toLowerCase()}@customers.hakumautocare.com`
const password = 'HakumQA2026!'
const plateBad = 'AAA'
const plateOk = `QA${stamp.slice(-5)}1`
const phone = `09${String(Date.now()).slice(-9)}`
const photo = 'https://example.com/qa-car.jpg'
let userId = null
let vehicleId = null
let completedId = null
let pendingId = null
let reviewId = null

console.log('\n━━━ live backend (portal + reviews RLS) ━━━')
assert(isValidCustomerPlate(plateOk), `fixture plate ${plateOk} must be valid`)
assert(!isValidCustomerPlate(plateBad), 'AAA must be invalid')

try {
  const { data: cols, error: colErr } = await admin
    .from('service_reviews')
    .select('overall_rating, app_rating, service_rating, detailing_rating, comment, booking_id, customer_id')
    .limit(1)
  assert(!colErr, `service_reviews columns: ${colErr?.message}`)
  results.push(`schema.service_reviews: ok (${cols?.length ?? 0} sample)`)

  const { error: vehColErr } = await admin.from('vehicles').select('photo_url').limit(1)
  assert(!vehColErr, `vehicles.photo_url: ${vehColErr?.message}`)
  results.push('schema.vehicles.photo_url: ok')

  const { data: services, error: svcErr } = await admin
    .from('services')
    .select('id')
    .eq('is_active', true)
    .eq('is_archived', false)
    .limit(1)
  assert(!svcErr && services?.[0]?.id, svcErr?.message || 'no active service')

  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'QA Request Brief' },
  })
  assert(!authErr && authUser?.user?.id, authErr?.message || 'createUser failed')
  userId = authUser.user.id

  const { error: custErr } = await admin.from('customers').upsert({
    id: userId,
    full_name: 'QA Request Brief',
    first_name: 'QA',
    last_name: 'Request Brief',
    phone,
    email,
    role: 'customer',
    is_archived: false,
  })
  assert(!custErr, custErr?.message)
  results.push('seed.customer: ok')

  const customer = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: sessionData, error: loginErr } = await customer.auth.signInWithPassword({ email, password })
  assert(!loginErr && sessionData?.session?.access_token, loginErr?.message || 'customer login failed')
  const token = sessionData.session.access_token

  const portal = await loadCustomerPortal({ accessToken: token })
  assert(portal.profile?.role === 'customer', 'portal role')
  assert(Array.isArray(portal.vehicles), 'portal vehicles')
  results.push('portal.load: ok')

  let plateRejected = false
  try {
    await mutateCustomerPortal({ accessToken: token, body: { action: 'add-vehicle', plate_number: plateBad } })
  } catch (err) {
    plateRejected = /numbers|plate|sticker/i.test(err.message)
  }
  assert(plateRejected, 'invalid plate must be rejected by portal')
  results.push('portal.add-vehicle.invalid_plate: ok')

  const added = await mutateCustomerPortal({
    accessToken: token,
    body: {
      action: 'add-vehicle',
      plate_number: plateOk,
      vehicle_make: 'Toyota',
      vehicle_model: 'Vios',
      photo_url: photo,
    },
  })
  assert(added?.vehicle?.id, 'add-vehicle did not return a vehicle')
  vehicleId = added.vehicle.id
  assert(added.vehicle.photo_url === photo, `photo_url=${added.vehicle.photo_url}`)
  results.push(`portal.add-vehicle.valid: ${plateOk}`)

  const jsPhoto = await mutateCustomerPortal({
    accessToken: token,
    body: {
      action: 'add-vehicle',
      plate_number: plateOk,
      photo_url: 'javascript:alert(1)',
    },
  })
  assert(jsPhoto.vehicle.photo_url == null, 'javascript: photo must be stripped')
  results.push('portal.add-vehicle.strip_js_photo: ok')

  const bookingBase = {
    customer_id: userId,
    customer_name: 'QA Request Brief',
    customer_phone: phone,
    branch: 'bacoor',
    service_id: services[0].id,
    vehicle_plate: plateOk,
    vehicle_make: 'Toyota',
    vehicle_model: 'Vios',
    is_archived: false,
  }

  const { data: pending, error: pendingErr } = await admin
    .from('bookings')
    .insert({ ...bookingBase, status: 'pending', scheduled_start: new Date().toISOString() })
    .select('id')
    .single()
  assert(!pendingErr && pending?.id, pendingErr?.message || 'pending booking insert failed')
  pendingId = pending.id

  const { error: pendingReviewErr } = await customer.from('service_reviews').insert({
    booking_id: pendingId,
    customer_id: userId,
    customer_name: 'QA Request Brief',
    branch: 'bacoor',
    overall_rating: 5,
    app_rating: 5,
    service_rating: 5,
    detailing_rating: 5,
  })
  assert(pendingReviewErr, 'review on pending booking must fail RLS')
  results.push('rls.review_pending_blocked: ok')

  const { data: completed, error: completedErr } = await admin
    .from('bookings')
    .insert({ ...bookingBase, status: 'completed', scheduled_start: new Date().toISOString() })
    .select('id')
    .single()
  assert(!completedErr && completed?.id, completedErr?.message || 'completed booking insert failed')
  completedId = completed.id

  const scores = buildCompletedVisitReview({ overall: 5, app: 4, service: 5, detailing: 3 }, 'e2e request brief')
  assert(scores, 'payload helper rejected a complete score set')
  const { data: review, error: reviewErr } = await customer
    .from('service_reviews')
    .insert({
      booking_id: completedId,
      customer_id: userId,
      customer_name: 'QA Request Brief',
      branch: 'bacoor',
      ...scores,
    })
    .select('id, overall_rating, app_rating, service_rating, detailing_rating, comment')
    .single()
  assert(!reviewErr && review?.id, reviewErr?.message || 'completed visit review insert failed')
  reviewId = review.id
  assert(review.overall_rating === 5 && review.app_rating === 4 && review.service_rating === 5 && review.detailing_rating === 3, JSON.stringify(review))
  results.push('rls.review_completed_insert: ok')

  const tl = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: tlLoginErr } = await tl.auth.signInWithPassword({
    email: 'teamlead@hakumautocare.com',
    password: 'HakumTL2026!',
  })
  assert(!tlLoginErr, `TL login: ${tlLoginErr?.message}`)
  const { data: tlRows, error: tlSelErr } = await tl.from('service_reviews').select('id').eq('id', reviewId)
  assert(!tlSelErr, tlSelErr?.message)
  assert((tlRows || []).length === 0, 'team lead must not read customer reviews')
  results.push('rls.review_tl_cannot_select: ok')

  const boss = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: bossLoginErr } = await boss.auth.signInWithPassword({
    email: 'bossmich@hakumautocare.com',
    password: 'HakumBoss2026!',
  })
  assert(!bossLoginErr, `SA login: ${bossLoginErr?.message}`)
  const { data: bossRow, error: bossSelErr } = await boss
    .from('service_reviews')
    .select('id, overall_rating, app_rating, service_rating, detailing_rating')
    .eq('id', reviewId)
    .maybeSingle()
  assert(!bossSelErr && bossRow?.id === reviewId, bossSelErr?.message || 'SA cannot read review')
  assert(bossRow.app_rating === 4 && bossRow.detailing_rating === 3, JSON.stringify(bossRow))
  results.push('rls.review_sa_select: ok')

  if (reviewId) {
    await admin.from('service_reviews').delete().eq('id', reviewId)
    reviewId = null
  }
  if (completedId) {
    await admin.from('bookings').delete().eq('id', completedId)
    completedId = null
  }
  if (pendingId) {
    await admin.from('bookings').delete().eq('id', pendingId)
    pendingId = null
  }
  await mutateCustomerPortal({ accessToken: token, body: { action: 'archive-vehicle', vehicle_id: vehicleId } })
  results.push('portal.archive-vehicle: ok')
} finally {
  if (reviewId) await admin.from('service_reviews').delete().eq('id', reviewId)
  if (completedId) await admin.from('bookings').delete().eq('id', completedId)
  if (pendingId) await admin.from('bookings').delete().eq('id', pendingId)
  if (vehicleId) await admin.from('vehicles').delete().eq('id', vehicleId)
  if (userId) {
    await admin.from('customers').delete().eq('id', userId)
    await admin.auth.admin.deleteUser(userId)
  }
}

console.log(results.map((line) => `✔ ${line}`).join('\n'))
console.log('PASS live backend')

run('full unit suite', [process.execPath, '--test'], { cwd: join(root, 'tests') })

run('production build', isWin ? ['npm.cmd', 'run', 'build'] : ['npm', 'run', 'build'], { shell: isWin })

console.log(`\n━━━ request brief E2E PASS (${results.length} live checks) ━━━`)
