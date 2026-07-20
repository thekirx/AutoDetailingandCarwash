/**
 * Public customer auth lookup (service role).
 * Resolves email / phone / plate → login email + whether TL-provisioned account still needs a password.
 * Indexed lookups only (plate unique, phone/email on customers) — no Auth listUsers scans.
 */
import { createClient } from '@supabase/supabase-js'
import { classifyIdentifier, normalizePlate, phoneDigits, phoneLoginEmail } from '../src/lib/customerAuth.js'

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

/** Queue recovery / set-password link to the customer's phone (and note email if present). */
export async function sendCustomerSetupLink({ identifier, siteOrigin }) {
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

  const redirectTo = `${String(siteOrigin || '').replace(/\/$/, '')}/account/set-password`
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: loginEmail,
    options: { redirectTo },
  })
  if (linkError) throw Object.assign(new Error(linkError.message), { status: 400 })

  const actionLink = linkData?.properties?.action_link || null
  const first = (customer.full_name || 'there').split(' ')[0]
  const message = actionLink
    ? `Hi ${first}, finish your Hakum Auto Care account — set your password: ${actionLink}`
    : `Hi ${first}, open Hakum Auto Care and use Forgot password with your phone or plate to finish setup.`

  if (customer.phone) {
    const { error } = await admin.from('sms_events').insert({
      phone: customer.phone,
      message,
      event_type: 'account_invite',
      status: 'queued',
    })
    if (error) {
      await admin.from('sms_events').insert({
        to_phone: customer.phone,
        body: message,
        template_type: 'account_invite',
        status: 'queued',
      })
    }
  }

  // Ensure flag stays set until they finish
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, must_set_password: true },
  })

  return {
    status: 'needs_password',
    kind,
    sent: true,
    via: customer.phone ? 'sms' : 'link_only',
    // ponytail: never return action_link to the browser
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
    let result
    if (action === 'send_setup') {
      result = await sendCustomerSetupLink({
        identifier: body.identifier,
        siteOrigin: siteOrigin || body.site_origin || 'http://localhost:5173',
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
