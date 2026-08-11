/**
 * Public first-account wizard (service role).
 * New phone → create Auth + CRM + vehicle.
 * Team Lead CRM-only or must_set_password → claim/attach, set password, keep customer_id.
 */
import { createClient } from '@supabase/supabase-js'
import { normalizePlate, phoneLoginEmail, phoneLoginEmailAliases } from '../src/lib/customerAuth.js'
import { resolveClaimPath } from '../src/lib/customerAccountLifecycle.js'
import {
  normalizeOnboardingPhone,
  validateOnboardingDraft,
} from '../src/lib/customerOnboarding.js'
import { clientIp, rateLimit } from './httpUtil.mjs'

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function assertAcceptedTerms(body) {
  if (body?.accepted_terms !== true) {
    throw Object.assign(new Error('You must accept the Terms of Service and Privacy Policy.'), { status: 400 })
  }
}

function splitName(fullName) {
  const [first, ...rest] = String(fullName || '').trim().split(/\s+/)
  return { first: first || null, last: rest.join(' ') || null }
}

async function upsertGaragePlate(admin, { customerId, plate }) {
  const normalized = normalizePlate(plate)
  if (!normalized) return null
  const payload = {
    customer_id: customerId,
    plate_number: String(plate).trim().toUpperCase(),
    normalized_plate_number: normalized,
    is_archived: false,
  }
  const { data: own } = await admin
    .from('vehicles')
    .update(payload)
    .eq('normalized_plate_number', normalized)
    .eq('customer_id', customerId)
    .select('id')
    .maybeSingle()
  if (own) return own.id

  const { data: taken } = await admin
    .from('vehicles')
    .select('customer_id')
    .eq('normalized_plate_number', normalized)
    .maybeSingle()
  if (taken?.customer_id && taken.customer_id !== customerId) {
    throw Object.assign(new Error('That plate is already linked to another Hakum account.'), { status: 409 })
  }

  const { error } = await admin.from('vehicles').insert(payload)
  if (error && error.code !== '23505') {
    throw Object.assign(new Error(error.message), { status: 400 })
  }
  return true
}

async function findCustomerByPhone(admin, phone) {
  const digits = normalizeOnboardingPhone(phone)
  const variants = [digits, phone, `63${digits.replace(/^0/, '')}`].filter(Boolean)
  for (const candidate of variants) {
    const { data } = await admin
      .from('customers')
      .select('id, phone, email, full_name, date_of_birth, role, is_archived')
      .eq('role', 'customer')
      .eq('is_archived', false)
      .eq('phone', candidate)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) return data
  }
  for (const loginEmail of phoneLoginEmailAliases(phone)) {
    const { data } = await admin
      .from('customers')
      .select('id, phone, email, full_name, date_of_birth, role, is_archived')
      .eq('role', 'customer')
      .eq('is_archived', false)
      .ilike('email', loginEmail)
      .limit(1)
      .maybeSingle()
    if (data) return data
  }
  return null
}

async function attachAuthToCrmRow(admin, { existing, fullName, phone, password, plate }) {
  const loginEmail = phoneLoginEmail(phone)
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    id: existing.id,
    email: loginEmail,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'customer',
      full_name: fullName,
      phone,
      plate,
      must_set_password: false,
    },
  })
  if (!createError && created?.user) return created.user

  const { data: again } = await admin.auth.admin.getUserById(existing.id)
  if (again?.user) return again.user
  throw Object.assign(new Error(createError?.message || 'Could not activate this visit. Ask the shop.'), { status: 400 })
}

async function claimTeamLeadAccount(admin, { existing, body, fullName, phone, emailRaw, password, plate, dob, requestOrigin }) {
  const { data: authWrap } = await admin.auth.admin.getUserById(existing.id)
  let user = authWrap?.user || null
  const path = resolveClaimPath({ customer: existing, authUser: user })
  if (path === 'exists') {
    throw Object.assign(new Error('This phone already has a Hakum account. Sign in instead.'), { status: 409 })
  }
  if (path === 'attach_auth') {
    user = await attachAuthToCrmRow(admin, { existing, fullName, phone, password, plate })
  } else if (!user) {
    throw Object.assign(new Error('Your visit is on file, but the login invite is not ready. Ask the shop.'), { status: 409 })
  }

  const { first, last } = splitName(fullName)
  const termsAcceptedAt = new Date().toISOString()
  const { error: updateAuth } = await admin.auth.admin.updateUserById(user.id, {
    password,
    user_metadata: {
      ...user.user_metadata,
      role: 'customer',
      full_name: fullName,
      phone,
      plate,
      must_set_password: false,
      accepted_terms_at: termsAcceptedAt,
    },
  })
  if (updateAuth) throw Object.assign(new Error(updateAuth.message), { status: 400 })

  const { error: profileError } = await admin
    .from('customers')
    .update({
      full_name: fullName,
      first_name: first,
      last_name: last,
      phone,
      email: emailRaw || existing.email || phoneLoginEmail(phone),
      date_of_birth: dob,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
  if (profileError) throw Object.assign(new Error(profileError.message), { status: 400 })

  await upsertGaragePlate(admin, { customerId: user.id, plate })

  try {
    const { grantBirthdayIfDue } = await import('./birthdayGreetings.mjs')
    await grantBirthdayIfDue(admin, {
      id: user.id,
      full_name: fullName,
      phone,
      date_of_birth: dob,
    })
  } catch {
    /* perk is best-effort */
  }

  try {
    const { sendLifecycleSms } = await import('./lifecycleSms.mjs')
    await sendLifecycleSms(admin, {
      kind: 'welcome_app',
      customerId: user.id,
      phone,
      appUrl: requestOrigin,
    })
  } catch {
    /* never block on SMS */
  }

  return {
    user_id: user.id,
    email: user.email || phoneLoginEmail(phone),
    login_hint: phone,
    claimed: true,
  }
}

export async function signupCustomer({ body, requestOrigin = '' }) {
  const draft = {
    phone: body.phone,
    full_name: body.full_name,
    plate: body.plate || body.vehicle_plate,
    date_of_birth: body.date_of_birth,
    email: body.email,
    password: body.password,
    confirm: body.confirm != null ? body.confirm : body.password,
    accepted_terms: body.accepted_terms,
  }
  const checked = validateOnboardingDraft(draft)
  if (!checked.ok) {
    const first = Object.values(checked.errors)[0]
    const err = Object.assign(new Error(first || 'Check the form and try again.'), { status: 400 })
    err.fields = checked.errors
    throw err
  }

  const fullName = String(draft.full_name).trim().replace(/\s+/g, ' ')
  const phone = normalizeOnboardingPhone(draft.phone)
  const plate = String(draft.plate || '').trim().toUpperCase()
  const dob = String(draft.date_of_birth).slice(0, 10)
  const emailRaw = String(draft.email || '').trim().toLowerCase()
  const password = String(draft.password)
  const { first, last } = splitName(fullName)
  const loginEmail = phoneLoginEmail(phone)
  const termsAcceptedAt = new Date().toISOString()

  const admin = adminClient()
  const existing = await findCustomerByPhone(admin, phone)
  if (existing) {
    return claimTeamLeadAccount(admin, {
      existing,
      body,
      fullName,
      phone,
      emailRaw,
      password,
      plate,
      dob,
      requestOrigin,
    })
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: loginEmail,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'customer',
      full_name: fullName,
      phone,
      plate,
      must_set_password: false,
      accepted_terms_at: termsAcceptedAt,
    },
  })
  if (createError) {
    const dup = /already|registered|exists/i.test(createError.message || '')
    throw Object.assign(
      new Error(dup ? 'This phone already has a Hakum account. Sign in instead.' : createError.message),
      { status: dup ? 409 : 400 },
    )
  }

  const { error: profileError } = await admin.from('customers').upsert(
    {
      id: created.user.id,
      role: 'customer',
      full_name: fullName,
      first_name: first,
      last_name: last,
      phone,
      email: emailRaw || loginEmail,
      date_of_birth: dob,
      is_archived: false,
    },
    { onConflict: 'id' },
  )
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    throw Object.assign(new Error(profileError.message), { status: 400 })
  }

  try {
    await upsertGaragePlate(admin, { customerId: created.user.id, plate })
  } catch (err) {
    await admin.auth.admin.deleteUser(created.user.id)
    throw err
  }

  try {
    const { grantBirthdayIfDue } = await import('./birthdayGreetings.mjs')
    await grantBirthdayIfDue(admin, {
      id: created.user.id,
      full_name: fullName,
      phone,
      date_of_birth: dob,
    })
  } catch {
    /* perk is best-effort */
  }

  try {
    const { sendLifecycleSms } = await import('./lifecycleSms.mjs')
    await sendLifecycleSms(admin, {
      kind: 'welcome_app',
      customerId: created.user.id,
      phone,
      appUrl: requestOrigin,
    })
  } catch {
    /* never block signup on SMS */
  }

  return { user_id: created.user.id, email: loginEmail, login_hint: phone, claimed: false }
}

export async function handleCustomerSignupRequest(req, res, { getBody }) {
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
    rateLimit({ key: `customer-signup:${clientIp(req)}`, limit: 8, windowMs: 15 * 60_000 })
    const body = await getBody()
    const origin = String(req.headers?.origin || '').trim()
    const result = await signupCustomer({ body, requestOrigin: /^https?:\/\//.test(origin) ? origin : '' })
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    res.statusCode = err.status || 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: err.message || String(err), fields: err.fields || null }))
  }
}
