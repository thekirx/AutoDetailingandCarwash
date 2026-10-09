/**
 * Server-only customer account provisioning (service role).
 * Used by Vite middleware (dev) and Vercel /api/provision-customer (prod).
 */
import { createClient } from '@supabase/supabase-js'
import { authCreateUserIdForCrm, buildProvisionInviteMessage } from './provisionSms.mjs'
import { canonicalPhMobile, phoneLoginEmail, phoneLoginEmailAliases, plateValidationError } from '../src/lib/customerAuth.js'
import {
  mergeCustomerDisplayName,
  resolveQueueCustomerDisplayName,
} from '../src/lib/queueCustomerName.js'

export { phoneLoginEmail }

/** Queue walk-in provision: SA / Admin / ASA / Team Lead (TL forced to own branch at ticket create). */
// Queue (SA / ASA / TL / Operations Lead) plus Branch Admin, who registers customers at POS and CRM.
export const QUEUE_PROVISION_ROLES = new Set(['BossMich', 'admin', 'assistant_super_admin', 'team_lead', 'operations_lead'])

function randomTempPassword() {
  return `Hakum-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}!`
}

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function assertQueueEditor(admin, accessToken) {
  if (!accessToken) throw Object.assign(new Error('Unauthorized'), { status: 401 })
  const { data: userData, error: userError } = await admin.auth.getUser(accessToken)
  if (userError || !userData?.user) throw Object.assign(new Error('Unauthorized'), { status: 401 })

  const { data: staff, error: staffError } = await admin
    .from('staff_profiles')
    .select('id, role, is_active')
    .eq('id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (staffError) throw staffError
  if (!staff || !QUEUE_PROVISION_ROLES.has(staff.role)) {
    throw Object.assign(new Error('Only Admin, Super Admin, Assistant Super Admin, Team Lead, or Operations Lead can provision customer accounts.'), { status: 403 })
  }
  return { user: userData.user, staff }
}

async function notifyCustomer(admin, { phone, email, message, eventType = 'account_invite' }) {
  const { error } = await admin.from('sms_events').insert({
    phone,
    message,
    event_type: eventType,
    status: 'queued',
  })
  if (error) {
    // tolerate older column shapes
    await admin.from('sms_events').insert({
      to_phone: phone,
      body: message,
      template_type: eventType,
      status: 'queued',
    })
  }
  return { channel: email ? 'email+sms' : 'sms', email: email || null }
}

const CUSTOMER_COLUMNS = 'id, email, phone, full_name, first_name, last_name'
const SYNTHETIC_EMAIL = /@customers\.hakumautocare\.com$/i
const looksLikeEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

/** Phone and email are both unique identifiers — find whoever already owns each. */
async function findCustomerMatches(admin, { phone, email }) {
  let byPhone = null
  let byEmail = null
  const canon = phone ? canonicalPhMobile(phone) : ''
  if (canon.length >= 10) {
    const variants = [...new Set([phone, canon, canon.startsWith('0') ? `63${canon.slice(1)}` : ''].filter(Boolean))]
    const { data } = await admin
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .eq('role', 'customer')
      .eq('is_archived', false)
      .in('phone', variants)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    byPhone = data || null
    if (!byPhone) {
      // Phone-only accounts keep a synthetic login email even when the phone column is blank.
      const { data: legacy } = await admin
        .from('customers')
        .select(CUSTOMER_COLUMNS)
        .eq('role', 'customer')
        .eq('is_archived', false)
        .in('email', phoneLoginEmailAliases(phone))
        .limit(1)
        .maybeSingle()
      byPhone = legacy || null
    }
  }
  if (email) {
    const { data } = await admin
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .eq('role', 'customer')
      .eq('is_archived', false)
      .ilike('email', email.replace(/[\\%_]/g, '\\$&'))
      .limit(1)
      .maybeSingle()
    byEmail = data || null
  }
  return { byPhone, byEmail }
}

/** What the POS shows when it autofills — never leaks the synthetic phone-login address. */
function publicCustomer(row) {
  if (!row) return null
  return {
    id: row.id,
    full_name: row.full_name || '',
    first_name: row.first_name || '',
    last_name: row.last_name || '',
    phone: row.phone || '',
    email: row.email && !SYNTHETIC_EMAIL.test(row.email) ? row.email : '',
  }
}

function identityConflictError(byPhone, byEmail) {
  return Object.assign(
    new Error(
      `That phone belongs to ${byPhone?.full_name || 'another customer'} but that email belongs to ${byEmail?.full_name || 'another customer'}. Use one customer's phone and email.`,
    ),
    { status: 409 },
  )
}

/**
 * Phone and email must point at the same person (or nobody). Returns the matched row, or null
 * when both are free; throws 409 when they belong to different customers or to someone other
 * than the pinned customer_id.
 */
export function resolveCustomerIdentity({ byPhone, byEmail, pinnedId = null }) {
  if (byPhone && byEmail && byPhone.id !== byEmail.id) throw identityConflictError(byPhone, byEmail)
  const matched = byPhone || byEmail || null
  if (pinnedId && matched && matched.id !== pinnedId) {
    throw Object.assign(
      new Error(`That ${byPhone ? 'phone' : 'email'} already belongs to ${matched.full_name || 'another customer'}.`),
      { status: 409 },
    )
  }
  return matched
}

/**
 * The row a *returning* customer's `customers` record should get after a POS capture.
 *
 * Phone and email are the identity, so only the name can change here. Anything the
 * cashier did not retype has to survive: the account's established number wins over
 * the number just typed, and first/last are only overwritten when they were supplied.
 *
 * `full_name` is rebuilt from the reconciled parts rather than from the typed name
 * alone. Editing only the first name field used to leave `last_name` as 'Cruz' while
 * `full_name` became 'Maria', so every screen that displays the joined name quietly
 * dropped the surname. When we know neither part (a phone-only record), the caller's
 * already-merged fallback wins — it carries the plate or last-4 phone label.
 */
export function resolveExistingCustomerUpdate({
  first,
  last,
  existing,
  fullName,
  phone,
  email,
  loginEmail,
  now,
}) {
  const firstName = first || existing?.first_name || null
  const lastName = last || existing?.last_name || null
  const fromParts = [firstName, lastName].filter(Boolean).join(' ')
  const patch = {
    full_name: fromParts ? mergeCustomerDisplayName(fromParts, existing?.full_name) : fullName,
    // Keep the established number / real email; only fill what the account lacks.
    phone: existing?.phone || phone,
    email: email || existing?.email || loginEmail,
    updated_at: now,
  }
  // Keep prior first/last when the capture left the name blank.
  if (firstName) patch.first_name = firstName
  if (lastName) patch.last_name = lastName
  return { firstName, lastName, fullName: patch.full_name, patch }
}

/**
 * @param {{ accessToken: string, body: object, siteOrigin: string }} args
 */
export async function provisionCustomerAccount({ accessToken, body, siteOrigin }) {
  const admin = adminClient()
  await assertQueueEditor(admin, accessToken)

  const phoneInput = String(body.customer_phone || body.phone || '').trim()
  const phone = canonicalPhMobile(phoneInput).length >= 10 ? canonicalPhMobile(phoneInput) : phoneInput
  const first = String(body.customer_first_name || body.first_name || '').trim()
  const last = String(body.customer_last_name || body.last_name || '').trim()
  const emailRaw = String(body.customer_email || body.email || '').trim().toLowerCase()
  const email = emailRaw || null
  const plate = String(body.vehicle_plate || body.plate || '').trim().toUpperCase() || null
  const allowWalkInName = body.allow_walk_in_name === true || body.allow_walk_in_name === 'true'

  if (email && !looksLikeEmail(email)) throw Object.assign(new Error('Enter a valid email address.'), { status: 400 })

  // Autofill: report who owns this phone / email without creating anything.
  if (body.lookup_only === true || body.lookup_only === 'true') {
    const { byPhone, byEmail } = await findCustomerMatches(admin, { phone, email })
    if (byPhone && byEmail && byPhone.id !== byEmail.id) {
      return { found: true, conflict: identityConflictError(byPhone, byEmail).message }
    }
    const hit = byPhone || byEmail
    return { found: Boolean(hit), match: byPhone ? 'phone' : byEmail ? 'email' : null, customer: publicCustomer(hit) }
  }

  if (!phone) throw Object.assign(new Error('Phone number is required.'), { status: 400 })
  if (canonicalPhMobile(phone).length < 10) {
    throw Object.assign(new Error('Enter a valid phone number.'), { status: 400 })
  }
  if (plate) {
    const plateError = plateValidationError(plate)
    if (plateError) throw Object.assign(new Error(plateError), { status: 400 })
  }

  // Queue walk-ins may omit name; other callers still require a real name.
  let fullName = String(body.customer_name || body.full_name || `${first} ${last}`).trim()
  if (!fullName) {
    if (!allowWalkInName) {
      throw Object.assign(new Error('Customer name is required.'), { status: 400 })
    }
    fullName = resolveQueueCustomerDisplayName({
      customer_first_name: first,
      customer_last_name: last,
      vehicle_plate: plate,
      customer_phone: phone,
    })
  }

  const loginEmail = email || phoneLoginEmail(phone)
  const redirectTo = `${siteOrigin.replace(/\/$/, '')}/account/set-password`

  // One person = one account. Phone and email each identify a customer; they must agree.
  let customerId = body.customer_id || null
  const { byPhone, byEmail } = await findCustomerMatches(admin, { phone, email })
  const matched = resolveCustomerIdentity({ byPhone, byEmail, pinnedId: customerId })
  if (!customerId) customerId = matched?.id || null
  let existing = matched
  if (customerId && !existing) {
    const { data: byId } = await admin.from('customers').select(CUSTOMER_COLUMNS).eq('id', customerId).maybeSingle()
    existing = byId || null
  }
  const existingFullName = existing?.full_name || null

  fullName = mergeCustomerDisplayName(fullName, existingFullName)

  let authUser = null
  let createdAuth = false

  // Resolve existing auth via customers.email index (not listUsers — query-missing-indexes / N+1 avoid)
  const { data: byLoginEmail } = await admin
    .from('customers')
    .select('id')
    .eq('role', 'customer')
    .ilike('email', loginEmail)
    .limit(1)
    .maybeSingle()
  if (byLoginEmail?.id && customerId && byLoginEmail.id !== customerId) {
    throw Object.assign(new Error('That email already belongs to another customer.'), { status: 409 })
  }
  if (byLoginEmail?.id) {
    const { data: existingAuth } = await admin.auth.admin.getUserById(byLoginEmail.id)
    authUser = existingAuth?.user || null
  }
  if (!authUser && customerId) {
    const { data: existingAuth } = await admin.auth.admin.getUserById(customerId)
    authUser = existingAuth?.user || null
  }

  if (!authUser) {
    if (email) {
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { role: 'customer', full_name: fullName, phone, plate, must_set_password: true },
        redirectTo,
      })
      if (!inviteError && invited?.user) {
        authUser = invited.user
        createdAuth = true
      }
    }
    if (!authUser) {
      const createPayload = {
        email: loginEmail,
        password: randomTempPassword(),
        email_confirm: true,
        user_metadata: { role: 'customer', full_name: fullName, phone, plate, must_set_password: true },
      }
      const pinnedId = authCreateUserIdForCrm(customerId)
      if (pinnedId) createPayload.id = pinnedId
      const { data: created, error: createError } = await admin.auth.admin.createUser(createPayload)
      if (createError) {
        // Already registered — recovery link still works below once we resolve id
        const { data: again } = await admin
          .from('customers')
          .select('id')
          .ilike('email', loginEmail)
          .limit(1)
          .maybeSingle()
        if (again?.id) {
          const { data: existingAuth } = await admin.auth.admin.getUserById(again.id)
          authUser = existingAuth?.user || null
        }
        if (!authUser) throw Object.assign(new Error(createError.message), { status: 400 })
      } else {
        authUser = created.user
        createdAuth = true
      }
    }
  }

  // Ensure customers row shares Auth uid (CUST-C3 — never leave CRM id ≠ Auth uid)
  // A returning customer keeps everything they did not retype.
  const returning = customerId
    ? resolveExistingCustomerUpdate({
      first,
      last,
      existing,
      fullName,
      phone,
      email,
      loginEmail,
      now: new Date().toISOString(),
    })
    : null

  if (customerId && authUser.id !== customerId) {
    await remountCustomerOntoAuthUid(admin, {
      fromId: customerId,
      toId: authUser.id,
      first: returning.firstName,
      last: returning.lastName,
      fullName: returning.fullName,
      phone: existing?.phone || phone,
      email: email || existing?.email || loginEmail,
    })
    customerId = authUser.id
  } else if (customerId) {
    await admin.from('customers').update(returning.patch).eq('id', customerId)
  } else {
    customerId = authUser.id
    const { error: upsertError } = await admin.from('customers').upsert(
      {
        id: authUser.id,
        role: 'customer',
        first_name: first || null,
        last_name: last || null,
        full_name: fullName,
        phone,
        email: email || loginEmail,
        is_archived: false,
      },
      { onConflict: 'id' },
    )
    if (upsertError) throw Object.assign(new Error(upsertError.message), { status: 400 })
  }

  const message = buildProvisionInviteMessage({
    firstName: fullName.split(' ')[0],
    phone,
    email,
  })

  // Only a brand-new account gets the set-password invite; a returning customer is just linked.
  const notify = createdAuth ? await notifyCustomer(admin, { phone, email, message }) : null

  return {
    customer_id: customerId,
    auth_user_id: authUser.id,
    login_email: authUser.email || loginEmail,
    full_name: fullName,
    phone: existing?.phone || phone,
    email: email || (existing?.email && !SYNTHETIC_EMAIL.test(existing.email) ? existing.email : ''),
    created: createdAuth,
    created_auth: createdAuth,
    notified: createdAuth,
    notify,
    // ponytail: never expose action_link in browser responses
  }
}

/**
 * Every table whose `customer_id` references `customers(id)` and therefore has
 * to be re-pointed before the old row can go away.
 *
 * `set null` tables are included deliberately: leaving them to cascade would
 * quietly unlink a customer's notes, reviews and finance quotes from the person
 * they belong to, which is the history this remount exists to preserve.
 *
 * Kept in sync with the migrations by tests/customerRemountIntegrity.test.js,
 * which derives the list from the SQL and fails when a new customer FK appears
 * here. Do not add a table without adding it there too.
 */
export const CUSTOMER_REFERENCING_TABLES = new Set([
  'bookings',
  'vehicles',
  'sales',
  'loyalty_ledger',
  'customer_memberships',
  'customer_birthday_perks',
  'service_reviews',
  'customer_notes',
  'finance_quotes',
  'vehicle_maintenance_schedules',
])

/**
 * Move CRM + FK rows onto the Auth uid when invite/create could not pin the CRM id.
 *
 * The old row is deleted LAST and only if every move landed. Deleting earlier
 * would cascade memberships and birthday perks away and would fail outright on
 * the `loyalty_ledger` restrict FK — and because PostgREST returns `{ error }`
 * rather than throwing, an unchecked delete used to leave a second orphaned
 * `customers` row behind while the request still answered 200.
 */
async function remountCustomerOntoAuthUid(admin, { fromId, toId, first, last, fullName, phone, email }) {
  const { data: old } = await admin.from('customers').select('*').eq('id', fromId).maybeSingle()
  const { error: upsertError } = await admin.from('customers').upsert(
    {
      id: toId,
      role: 'customer',
      first_name: first || old?.first_name || null,
      last_name: last || old?.last_name || null,
      full_name: fullName || old?.full_name,
      phone: phone || old?.phone,
      email: email || old?.email,
      loyalty_stamps: old?.loyalty_stamps ?? 0,
      loyalty_points: old?.loyalty_points ?? 0,
      is_archived: false,
    },
    { onConflict: 'id' },
  )
  if (upsertError) throw Object.assign(new Error(upsertError.message), { status: 400 })

  // Re-point every referencing row before touching the old row. A failure here
  // must abort: deleting anyway is what destroys loyalty and membership history.
  const failed = []
  await Promise.all(
    [...CUSTOMER_REFERENCING_TABLES].map(async (table) => {
      const { error } = await admin
        .from(table)
        .update({ customer_id: toId })
        .eq('customer_id', fromId)
      if (error) failed.push(`${table}: ${error.message}`)
    }),
  )
  if (failed.length) {
    throw Object.assign(
      new Error(`Could not move this customer's history onto the new account (${failed.join('; ')}). The old record was left in place.`),
      { status: 409 },
    )
  }

  if (fromId !== toId) {
    const { error: deleteError } = await admin.from('customers').delete().eq('id', fromId)
    if (deleteError) {
      // The old row still exists, so this customer now has two records. Say so
      // instead of reporting a clean link — the next lookup would pick one at
      // random and show the wrong history.
      throw Object.assign(
        new Error(`Linked, but the previous customer record could not be merged (${deleteError.message}). Do not re-enter this customer until it is reconciled.`),
        { status: 409 },
      )
    }
  }
}

export async function handleProvisionRequest(req, res, { siteOrigin, getBody, getAccessToken }) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Method not allowed' }))
      return
    }

    const body = await getBody()
    const accessToken = getAccessToken()
    const result = await provisionCustomerAccount({
      accessToken,
      body,
      siteOrigin: siteOrigin || body.site_origin || 'http://localhost:5173',
    })
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    const status = err.status || 500
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: err.message || String(err) }))
  }
}
