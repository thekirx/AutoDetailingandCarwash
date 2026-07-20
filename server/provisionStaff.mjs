/**
 * Server-only ops account provisioning (service role).
 * BossMich may create admin + crew roles; admin may create TL/staff/cashier only.
 */
import { createClient } from '@supabase/supabase-js'

const SUPER = 'BossMich'
const ADMIN = 'admin'

/** Roles a caller may assign. */
export function creatableRolesFor(callerRole) {
  if (callerRole === SUPER) {
    return ['admin', 'team_lead', 'staff', 'cashier', 'marketing', 'sales']
  }
  if (callerRole === ADMIN) {
    return ['team_lead', 'staff', 'cashier']
  }
  return []
}

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function randomTempPassword() {
  return `Hakum-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}!`
}

async function assertAdminCaller(admin, accessToken) {
  if (!accessToken) throw Object.assign(new Error('Unauthorized'), { status: 401 })
  const { data: userData, error: userError } = await admin.auth.getUser(accessToken)
  if (userError || !userData?.user) throw Object.assign(new Error('Unauthorized'), { status: 401 })

  const { data: staff, error } = await admin
    .from('staff_profiles')
    .select('id, role, is_active, branch_slug')
    .eq('id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  if (!staff || ![SUPER, ADMIN].includes(staff.role)) {
    throw Object.assign(new Error('Only Super Admin or Admin may create staff accounts.'), { status: 403 })
  }
  return { user: userData.user, staff }
}

/**
 * @param {{ accessToken: string, body: object, siteOrigin: string }} args
 */
export async function provisionStaffAccount({ accessToken, body, siteOrigin }) {
  const admin = adminClient()
  const { staff: caller } = await assertAdminCaller(admin, accessToken)

  const email = String(body.email || '').trim().toLowerCase()
  const fullName = String(body.full_name || '').trim()
  const role = String(body.role || '').trim()
  const phone = String(body.phone || '').trim() || null
  let branchSlug = body.branch_slug ? String(body.branch_slug).trim().toLowerCase() : null
  const allowed = creatableRolesFor(caller.role)

  if (!email || !email.includes('@')) throw Object.assign(new Error('Valid email is required.'), { status: 400 })
  if (!fullName) throw Object.assign(new Error('Full name is required.'), { status: 400 })
  if (!allowed.includes(role)) {
    throw Object.assign(new Error(`You cannot create role "${role}". Allowed: ${allowed.join(', ')}`), { status: 403 })
  }

  // Branch admins can only provision into their own site
  if (caller.role === ADMIN) {
    if (!caller.branch_slug) {
      throw Object.assign(new Error('Your admin account has no branch. Ask Super Admin to assign one.'), { status: 403 })
    }
    branchSlug = caller.branch_slug
  }

  if (['admin', 'team_lead', 'staff', 'cashier', 'marketing', 'sales'].includes(role) && !branchSlug) {
    throw Object.assign(new Error('Branch is required for this role.'), { status: 400 })
  }

  if (branchSlug) {
    const { data: branch } = await admin
      .from('branches')
      .select('slug')
      .eq('slug', branchSlug)
      .eq('is_active', true)
      .eq('is_archived', false)
      .maybeSingle()
    if (!branch) throw Object.assign(new Error('Branch not found or inactive.'), { status: 400 })
  }

  const redirectTo = `${String(siteOrigin || '').replace(/\/$/, '')}/operations/login`
  let authUser = null
  let createdAuth = false

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: body.temporary_password?.trim() || randomTempPassword(),
    email_confirm: true,
    user_metadata: { full_name: fullName, role, phone, branch_slug: branchSlug },
  })

  if (createError) {
    // Existing email — look up and update password if temp provided
    let page = 1
    for (;;) {
      const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 100 })
      if (listError) throw listError
      authUser = listed.users.find((u) => (u.email || '').toLowerCase() === email) || null
      if (authUser || !listed.users.length || listed.users.length < 100) break
      page += 1
    }
    if (!authUser) throw Object.assign(new Error(createError.message), { status: 400 })
    if (body.temporary_password?.trim()) {
      await admin.auth.admin.updateUserById(authUser.id, { password: body.temporary_password.trim() })
    }
  } else {
    authUser = created.user
    createdAuth = true
  }

  const { error: profileError } = await admin.from('staff_profiles').upsert(
    {
      id: authUser.id,
      full_name: fullName,
      role,
      branch_slug: role === SUPER ? null : branchSlug,
      phone,
      is_active: true,
      is_archived: false,
    },
    { onConflict: 'id' },
  )
  if (profileError) throw Object.assign(new Error(profileError.message), { status: 400 })

  const { data: linkData } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  })

  if (phone) {
    await admin.from('sms_events').insert({
      phone,
      message: `Hakum ops account ready (${role}). Sign in at ${redirectTo} with ${email}. Set password: ${linkData?.properties?.action_link || 'use email invite'}`,
      event_type: 'account_invite',
      status: 'queued',
    })
  }

  return {
    user_id: authUser.id,
    email,
    role,
    branch_slug: branchSlug,
    created_auth: createdAuth,
    notified: Boolean(phone),
  }
}

export async function handleProvisionStaffRequest(req, res, { siteOrigin, getBody, getAccessToken }) {
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
    const result = await provisionStaffAccount({
      accessToken: getAccessToken(),
      body,
      siteOrigin: siteOrigin || body.site_origin || 'http://localhost:5173',
    })
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    res.statusCode = err.status || 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: err.message || String(err) }))
  }
}
