/**
 * Public customer auth lookup (service role).
 * Resolves email / phone / plate → login email + whether TL-provisioned account still needs a password.
 * Indexed lookups only (plate unique, phone/email on customers) — no Auth listUsers scans.
 */
import { createClient } from '@supabase/supabase-js'
import { classifyIdentifier, normalizePlate, phoneDigits, phoneLoginEmail } from '../src/lib/customerAuth.js'
import { clientIp, rateLimit } from './httpUtil.mjs'

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function findCustomerByIdentifier(admin, identifier) {
  const kind = classifyIdentifier(identifier)
  if (kind === 'empty' || kind === 'unknown') return { kind, customer: null }

  if (kind === 'email') {
    const email = String(identifier).trim().toLowerCase()
    const { data } = await admin
      .from('customers')
      .select('id, phone, email, full_name, role, is_archived')
      .eq('role', 'customer')
      .eq('is_archived', false)
      .ilike('email', email)
      .limit(1)
      .maybeSingle()
    return { kind, customer: data || null }
  }

  if (kind === 'phone') {
    const digits = phoneDigits(identifier)
    const variants = [digits]
    if (digits.startsWith('63') && digits.length >= 12) variants.push(`0${digits.slice(2)}`)
    if (digits.startsWith('0') && digits.length >= 11) variants.push(`63${digits.slice(1)}`)

    for (const phone of variants) {
      const { data } = await admin
        .from('customers')
        .select('id, phone, email, full_name, role, is_archived')
        .eq('role', 'customer')
        .eq('is_archived', false)
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) return { kind, customer: data }
    }

    // Synthetic login email row
    try {
      const loginEmail = phoneLoginEmail(identifier)
      const { data } = await admin
        .from('customers')
        .select('id, phone, email, full_name, role, is_archived')
        .eq('role', 'customer')
        .eq('is_archived', false)
        .ilike('email', loginEmail)
        .limit(1)
        .maybeSingle()
      if (data) return { kind, customer: data }
    } catch {
      /* short phone */
    }
    return { kind, customer: null }
  }

  // plate — indexed normalized_plate_number
  const plate = normalizePlate(identifier)
  if (plate.length < 3) return { kind: 'plate', customer: null }

  const { data: vehicle } = await admin
    .from('vehicles')
    .select('customer_id, plate_number, normalized_plate_number')
    .eq('normalized_plate_number', plate)
    .limit(1)
    .maybeSingle()

  if (!vehicle?.customer_id) return { kind: 'plate', customer: null }

  const { data: customer } = await admin
    .from('customers')
    .select('id, phone, email, full_name, role, is_archived')
    .eq('id', vehicle.customer_id)
    .eq('role', 'customer')
    .eq('is_archived', false)
    .maybeSingle()

  return { kind: 'plate', customer: customer || null, plate: vehicle.plate_number || plate }
}

async function getAuthUser(admin, id) {
  const { data, error } = await admin.auth.admin.getUserById(id)
  if (error) return null
  return data?.user || null
}

async function statusForCustomer(admin, customer, kind) {
  if (!customer) return { status: 'unknown', kind }

  const user = await getAuthUser(admin, customer.id)

  if (!user) {
    return {
      status: 'needs_invite',
      kind,
      // CRM walk-in without Auth yet
    }
  }

  const loginEmail = user.email || customer.email || null
  const needsPassword = Boolean(user.user_metadata?.must_set_password)

  return {
    status: needsPassword ? 'needs_password' : 'ready',
    kind,
    login_email: loginEmail,
  }
}

export async function lookupCustomerAuthStatus({ identifier }) {
  const admin = adminClient()
  const raw = String(identifier || '').trim()
  if (raw.length < 3) return { status: 'unknown', kind: 'empty' }

  const { kind, customer } = await findCustomerByIdentifier(admin, raw)
  return statusForCustomer(admin, customer, kind)
}

/**
 * Trigger Supabase Auth recovery / set-password email only.
 * ponytail: SMS is transactional (booking notify) — never auth links.
 */
export async function sendCustomerSetupLink({ identifier, siteOrigin, mode = 'setup' }) {
  const admin = adminClient()
  const raw = String(identifier || '').trim()
  const { kind, customer } = await findCustomerByIdentifier(admin, raw)
  if (!customer) throw Object.assign(new Error('No Hakum visit found for that email, phone, or plate.'), { status: 404 })

  const user = await getAuthUser(admin, customer.id)

  if (!user) {
    throw Object.assign(
      new Error('Your visit is on file, but an account invite was not created yet. Ask your Team Lead to send one from the queue.'),
      { status: 409 },
    )
  }

  const loginEmail = user.email || customer.email
  if (!loginEmail) throw Object.assign(new Error('Account has no login email.'), { status: 400 })

  const synthetic = String(loginEmail).endsWith('@customers.hakumautocare.com')
  if (synthetic) {
    throw Object.assign(
      new Error(
        'This account needs a real email for password reset. Ask the Team Lead to add your email on file, then try Forgot password again.',
      ),
      { status: 400 },
    )
  }

  const redirectTo = `${String(siteOrigin || '').replace(/\/$/, '')}/account/set-password`
  const isReset = mode === 'reset'

  // Supabase Auth sends the recovery email (configured SMTP / Supabase mail)
  const { error: resetError } = await admin.auth.resetPasswordForEmail(loginEmail, { redirectTo })
  if (resetError) throw Object.assign(new Error(resetError.message), { status: 400 })

  // First-time setup only — do not force this flag on normal password resets
  if (!isReset) {
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, must_set_password: true },
    })
  }

  return {
    status: isReset ? (user.user_metadata?.must_set_password ? 'needs_password' : 'ready') : 'needs_password',
    kind,
    sent: true,
    via: 'email',
    can_email_reset: true,
    // ponytail: never return login_email or action_link — prevents enumeration / phishing
  }
}

export async function handleCustomerAuthLookupRequest(req, res, { getBody, siteOrigin }) {
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
    const action = body.action || 'lookup'
    const origin = siteOrigin || body.site_origin || 'http://localhost:5173'
    const idKey = String(body.identifier || '').trim().toLowerCase().slice(0, 64)
    const ip = clientIp(req)

    if (action === 'send_setup' || action === 'send_reset') {
      rateLimit({ key: `auth-mail:${ip}`, limit: 8, windowMs: 15 * 60_000 })
      rateLimit({ key: `auth-mail-id:${idKey || ip}`, limit: 5, windowMs: 15 * 60_000 })
    } else {
      rateLimit({ key: `auth-lookup:${ip}`, limit: 60, windowMs: 60_000 })
    }

    let result
    if (action === 'send_setup') {
      result = await sendCustomerSetupLink({
        identifier: body.identifier,
        siteOrigin: origin,
        mode: 'setup',
      })
    } else if (action === 'send_reset') {
      result = await sendCustomerSetupLink({
        identifier: body.identifier,
        siteOrigin: origin,
        mode: 'reset',
      })
    } else {
      result = await lookupCustomerAuthStatus({ identifier: body.identifier })
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    res.statusCode = err.status || 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: err.message || String(err) }))
  }
}
