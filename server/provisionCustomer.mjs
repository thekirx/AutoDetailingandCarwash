/**
 * Server-only customer account provisioning (service role).
 * Used by Vite middleware (dev) and Vercel /api/provision-customer (prod).
 */
import { createClient } from '@supabase/supabase-js'
import { authCreateUserIdForCrm, buildProvisionInviteMessage } from './provisionSms.mjs'
import { phoneLoginEmail } from '../src/lib/customerAuth.js'
import {
  mergeCustomerDisplayName,
  resolveQueueCustomerDisplayName,
} from '../src/lib/queueCustomerName.js'

export { phoneLoginEmail }

/** Queue walk-in provision: SA / Admin / ASA / Team Lead (TL forced to own branch at ticket create). */
export const QUEUE_PROVISION_ROLES = new Set(['BossMich', 'admin', 'assistant_super_admin', 'team_lead'])

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
    throw Object.assign(new Error('Only Admin, Super Admin, Assistant Super Admin, or Team Lead can provision customer accounts.'), { status: 403 })
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

/**
 * @param {{ accessToken: string, body: object, siteOrigin: string }} args
 */
export async function provisionCustomerAccount({ accessToken, body, siteOrigin }) {
  const admin = adminClient()
  await assertQueueEditor(admin, accessToken)

  const phone = String(body.customer_phone || body.phone || '').trim()
  const first = String(body.customer_first_name || body.first_name || '').trim()
  const last = String(body.customer_last_name || body.last_name || '').trim()
  const emailRaw = String(body.customer_email || body.email || '').trim().toLowerCase()
  const email = emailRaw || null
  const plate = String(body.vehicle_plate || body.plate || '').trim().toUpperCase() || null
  const allowWalkInName = body.allow_walk_in_name === true || body.allow_walk_in_name === 'true'

  if (!phone) throw Object.assign(new Error('Phone number is required.'), { status: 400 })

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

  // Prefer existing CRM row by phone
  let customerId = body.customer_id || null
  let existingFullName = null
  if (!customerId) {
    const { data: byPhone } = await admin
      .from('customers')
      .select('id, email, phone, full_name, first_name, last_name')
      .eq('role', 'customer')
      .eq('phone', phone)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    customerId = byPhone?.id || null
    existingFullName = byPhone?.full_name || null
  } else {
    const { data: byId } = await admin
      .from('customers')
      .select('full_name, first_name, last_name')
      .eq('id', customerId)
      .maybeSingle()
    existingFullName = byId?.full_name || null
  }

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
  if (customerId && authUser.id !== customerId) {
    await remountCustomerOntoAuthUid(admin, {
      fromId: customerId,
      toId: authUser.id,
      first,
      last,
      fullName,
      phone,
      email: email || loginEmail,
    })
    customerId = authUser.id
  } else if (customerId) {
    const customerPatch = {
      full_name: fullName,
      phone,
      email: email || loginEmail,
      updated_at: new Date().toISOString(),
    }
    // Keep prior first/last when TL leaves name blank on a returning plate/phone
    if (first) customerPatch.first_name = first
    if (last) customerPatch.last_name = last
    await admin.from('customers').update(customerPatch).eq('id', customerId)
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

  const notify = await notifyCustomer(admin, { phone, email, message })

  return {
    customer_id: customerId,
    auth_user_id: authUser.id,
    login_email: authUser.email || loginEmail,
    full_name: fullName,
    created: createdAuth,
    created_auth: createdAuth,
    notified: true,
    notify,
    // ponytail: never expose action_link in browser responses
  }
}

/** Move CRM + FK rows onto Auth uid when invite/create could not pin CRM id. */
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

  await Promise.all([
    admin.from('bookings').update({ customer_id: toId }).eq('customer_id', fromId),
    admin.from('vehicles').update({ customer_id: toId }).eq('customer_id', fromId),
    admin.from('sales').update({ customer_id: toId }).eq('customer_id', fromId),
  ])

  if (fromId !== toId) {
    await admin.from('customers').delete().eq('id', fromId)
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
