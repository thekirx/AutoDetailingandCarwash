/**
 * Server-only customer account provisioning (service role).
 * Used by Vite middleware (dev) and Vercel /api/provision-customer (prod).
 */
import { createClient } from '@supabase/supabase-js'

export const QUEUE_PROVISION_ROLES = new Set(['team_lead', 'BossMich', 'admin', 'marketing', 'sales'])

/** Phone digits → synthetic login email when walk-in has no email. */
export function phoneLoginEmail(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length < 10) throw new Error('Phone number is required.')
  return `c${digits}@customers.hakumautocare.com`
}

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
    throw Object.assign(new Error('Only Admin, Team Lead, Super Admin, Marketing, or Sales can provision customer accounts.'), { status: 403 })
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
  const fullName = String(body.customer_name || body.full_name || `${first} ${last}`).trim()
  const emailRaw = String(body.customer_email || body.email || '').trim().toLowerCase()
  const email = emailRaw || null
  const plate = String(body.vehicle_plate || body.plate || '').trim().toUpperCase() || null

  if (!phone) throw Object.assign(new Error('Phone number is required.'), { status: 400 })
  if (!fullName) throw Object.assign(new Error('Customer name is required.'), { status: 400 })

  const loginEmail = email || phoneLoginEmail(phone)
  const redirectTo = `${siteOrigin.replace(/\/$/, '')}/account/set-password`

  // Prefer existing CRM row by phone
  let customerId = body.customer_id || null
  if (!customerId) {
    const { data: byPhone } = await admin
      .from('customers')
      .select('id, email, phone, full_name')
      .eq('role', 'customer')
      .eq('phone', phone)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    customerId = byPhone?.id || null
  }

  let authUser = null
  let createdAuth = false
  let actionLink = null

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
        data: { role: 'customer', full_name: fullName, phone, plate },
        redirectTo,
      })
      if (!inviteError && invited?.user) {
        authUser = invited.user
        createdAuth = true
      }
    }
    if (!authUser) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: loginEmail,
        password: randomTempPassword(),
        email_confirm: true,
        user_metadata: { role: 'customer', full_name: fullName, phone, plate, must_set_password: true },
      })
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

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: authUser.email || loginEmail,
    options: { redirectTo },
  })
  if (!linkError) actionLink = linkData?.properties?.action_link || null

  // Ensure customers row: prefer auth user id when inserting new
  if (customerId) {
    const { data: existingAuth } = await admin.auth.admin.getUserById(customerId)
    if (!existingAuth?.user && authUser.id !== customerId) {
      // Walk-in CRM row without auth — keep row, point email/phone; ticket still uses CRM id
      await admin
        .from('customers')
        .update({
          first_name: first || null,
          last_name: last || null,
          full_name: fullName,
          phone,
          email: email || loginEmail,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId)
    } else {
      await admin
        .from('customers')
        .update({
          first_name: first || null,
          last_name: last || null,
          full_name: fullName,
          phone,
          email: email || loginEmail,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId)
    }
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

  const setPasswordHint = actionLink
    ? `Set your password here: ${actionLink}`
    : 'Open the Hakum set-password link sent to you, or ask the Team Lead to resend it.'

  const message = email
    ? `Hi ${fullName.split(' ')[0]}, your Hakum Auto Care account is ready (${email}). ${setPasswordHint}`
    : `Hi ${fullName.split(' ')[0]}, your Hakum account login is your phone number (${phone}). ${setPasswordHint}`

  const notify = await notifyCustomer(admin, { phone, email, message })

  return {
    customer_id: customerId,
    auth_user_id: authUser.id,
    login_email: authUser.email || loginEmail,
    created_auth: createdAuth,
    notified: true,
    notify,
    // ponytail: TL UI can show "invite queued"; never expose action_link in browser responses in prod — omit here
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
