/**
 * Server-only ops account provisioning (service role).
 * BossMich may create admin + assistant_super_admin + crew; admin/assistant may create TL/staff;
 * team_lead may create staff for their own branch.
 */
import { createClient } from '@supabase/supabase-js'

const SUPER = 'BossMich'
const ASSISTANT = 'assistant_super_admin'
const ADMIN = 'admin'
const TEAM_LEAD = 'team_lead'

/** Roles a caller may assign. */
export function creatableRolesFor(callerRole) {
  if (callerRole === SUPER) {
    return [
      'admin',
      'assistant_super_admin',
      'operations_lead',
      'team_lead',
      'staff',
      'marketing',
      'sales',
      'detailer',
      'video_editor',
      'investor',
    ]
  }
  if (callerRole === ADMIN || callerRole === ASSISTANT) {
    return ['team_lead', 'staff', 'detailer']
  }
  if (callerRole === TEAM_LEAD) {
    return ['staff']
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

function normalizeUsername(raw) {
  const username = String(raw || '').trim().toLowerCase()
  if (!username) return null
  if (username.length < 3) throw Object.assign(new Error('Username must be at least 3 characters.'), { status: 400 })
  if (!/^[a-z0-9._-]+$/.test(username)) {
    throw Object.assign(new Error('Username may only use letters, numbers, dots, underscores, or hyphens.'), { status: 400 })
  }
  return username
}

async function assertStaffManagerCaller(admin, accessToken) {
  if (!accessToken) throw Object.assign(new Error('Unauthorized'), { status: 401 })
  const { data: userData, error: userError } = await admin.auth.getUser(accessToken)
  if (userError || !userData?.user) throw Object.assign(new Error('Unauthorized'), { status: 401 })

  const { data: staff, error } = await admin
    .from('staff_profiles')
    .select('id, role, is_active, branch_slug, permission_grants')
    .eq('id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  if (!staff || ![SUPER, ADMIN, ASSISTANT, TEAM_LEAD].includes(staff.role)) {
    throw Object.assign(new Error('Only Super Admin, Assistant Super Admin, Admin, or Team Lead may manage staff accounts.'), { status: 403 })
  }
  // ASA must hold people grant (defaults merge treats missing as true)
  if (staff.role === ASSISTANT) {
    const grants = staff.permission_grants || {}
    const peopleOk = grants.people !== false
    if (!peopleOk) {
      throw Object.assign(new Error('Your Assistant Super Admin account lacks the people grant.'), { status: 403 })
    }
  }
  return { user: userData.user, staff }
}

/**
 * @param {{ accessToken: string, body: object, siteOrigin: string }} args
 */
export async function provisionStaffAccount({ accessToken, body, siteOrigin }) {
  const admin = adminClient()
  const { staff: caller } = await assertStaffManagerCaller(admin, accessToken)

  const email = String(body.email || '').trim().toLowerCase()
  const fullName = String(body.full_name || '').trim()
  const role = String(body.role || '').trim()
  const phone = String(body.phone || '').trim() || null
  const username = normalizeUsername(body.username)
  if (phone) {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) {
      throw Object.assign(new Error('Phone must have at least 10 digits.'), { status: 400 })
    }
  }
  let branchSlug = body.branch_slug ? String(body.branch_slug).trim().toLowerCase() : null
  const branchSlugs = Array.isArray(body.branch_slugs)
    ? body.branch_slugs.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
    : branchSlug
      ? [branchSlug]
      : []
  const allowed = creatableRolesFor(caller.role)

  if (!email || !email.includes('@')) throw Object.assign(new Error('Valid email is required.'), { status: 400 })
  if (!fullName) throw Object.assign(new Error('Full name is required.'), { status: 400 })
  if (!allowed.includes(role)) {
    throw Object.assign(new Error(`You cannot create role "${role}". Allowed: ${allowed.join(', ')}`), { status: 403 })
  }

  // Branch admins / TLs can only provision into their own site
  if (caller.role === ADMIN || caller.role === TEAM_LEAD) {
    if (!caller.branch_slug) {
      throw Object.assign(new Error('Your account has no branch. Ask Super Admin to assign one.'), { status: 403 })
    }
    branchSlug = caller.branch_slug
    branchSlugs.length = 0
    branchSlugs.push(caller.branch_slug)
  }

  if (['admin', 'team_lead', 'staff', 'marketing', 'sales', 'detailer', 'video_editor', 'investor'].includes(role) && !branchSlug && !branchSlugs.length) {
    throw Object.assign(new Error('Branch is required for this role.'), { status: 400 })
  }
  if (!branchSlug && branchSlugs.length) branchSlug = branchSlugs[0]

  const permissionGrants =
    role === ASSISTANT && body.permission_grants && typeof body.permission_grants === 'object'
      ? body.permission_grants
      : {}

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
      branch_slug: role === SUPER || role === ASSISTANT || role === 'operations_lead' ? null : branchSlug,
      phone,
      username,
      login_email: email,
      permission_grants: role === ASSISTANT ? permissionGrants : {},
      attendance_enabled:
        role === 'operations_lead' ? false : body.attendance_enabled !== false,
      geofence_enabled: body.geofence_enabled !== false,
      employment_type: body.employment_type === 'on_call' ? 'on_call' : 'permanent',
      is_active: true,
      is_archived: false,
    },
    { onConflict: 'id' },
  )
  if (profileError) throw Object.assign(new Error(profileError.message), { status: 400 })

  if (
    role === ADMIN ||
    role === 'team_lead' ||
    role === 'staff' ||
    role === 'marketing' ||
    role === 'sales' ||
    role === 'detailer' ||
    role === 'video_editor' ||
    role === 'investor'
  ) {
    const slugs = branchSlugs.length ? branchSlugs : branchSlug ? [branchSlug] : []
    await admin.from('staff_branch_assignments').delete().eq('staff_id', authUser.id)
    if (slugs.length) {
      const { error: assignErr } = await admin.from('staff_branch_assignments').insert(
        slugs.map((slug) => ({ staff_id: authUser.id, branch_slug: slug })),
      )
      if (assignErr) throw Object.assign(new Error(assignErr.message), { status: 400 })
    }
  } else if (role === ASSISTANT) {
    const grants = { branches_all: true, ...permissionGrants }
    await admin.from('staff_branch_assignments').delete().eq('staff_id', authUser.id)
    if (grants.branches_all === false) {
      const slugs = branchSlugs.length ? branchSlugs : branchSlug ? [branchSlug] : []
      if (!slugs.length) {
        throw Object.assign(new Error('Assign at least one branch when branches_all is off.'), { status: 400 })
      }
      const { error: assignErr } = await admin.from('staff_branch_assignments').insert(
        slugs.map((slug) => ({ staff_id: authUser.id, branch_slug: slug })),
      )
      if (assignErr) throw Object.assign(new Error(assignErr.message), { status: 400 })
    }
  }

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

/**
 * Update crew profile + optional auth email/password (service role).
 * Body: { id, full_name?, phone?, username?, branch_slug?, email?, temporary_password? }
 */
export async function updateStaffAccount({ accessToken, body }) {
  const admin = adminClient()
  const { staff: caller } = await assertStaffManagerCaller(admin, accessToken)
  const id = String(body.id || '').trim()
  if (!id) throw Object.assign(new Error('Staff id is required.'), { status: 400 })

  const { data: target, error: targetErr } = await admin
    .from('staff_profiles')
    .select('id, role, branch_slug, full_name, phone, username, login_email')
    .eq('id', id)
    .maybeSingle()
  if (targetErr) throw targetErr
  if (!target) throw Object.assign(new Error('Staff not found.'), { status: 404 })
  if (target.role === SUPER) throw Object.assign(new Error('Cannot edit Super Admin via this endpoint.'), { status: 403 })

  if (caller.role === TEAM_LEAD) {
    if (target.role !== 'staff') throw Object.assign(new Error('Team Lead may only edit staff.'), { status: 403 })
    if (!caller.branch_slug || target.branch_slug !== caller.branch_slug) {
      throw Object.assign(new Error('Staff is outside your branch.'), { status: 403 })
    }
  }
  if (caller.role === ADMIN) {
    if (!caller.branch_slug) throw Object.assign(new Error('Your admin account has no branch.'), { status: 403 })
    if (target.branch_slug && target.branch_slug !== caller.branch_slug) {
      const { data: assign } = await admin
        .from('staff_branch_assignments')
        .select('branch_slug')
        .eq('staff_id', id)
        .eq('branch_slug', caller.branch_slug)
        .maybeSingle()
      if (!assign) {
        throw Object.assign(new Error('Staff is outside your branch.'), { status: 403 })
      }
    }
  }

  const patch = { updated_at: new Date().toISOString() }
  if (body.full_name != null) {
    const name = String(body.full_name).trim()
    if (!name) throw Object.assign(new Error('Full name is required.'), { status: 400 })
    patch.full_name = name
  }
  if (body.phone !== undefined) {
    const phone = String(body.phone || '').trim() || null
    if (phone) {
      const digits = phone.replace(/\D/g, '')
      if (digits.length < 10) throw Object.assign(new Error('Phone must have at least 10 digits.'), { status: 400 })
    }
    patch.phone = phone
  }
  if (body.username !== undefined) {
    patch.username = normalizeUsername(body.username)
  }

  let branchSlug = body.branch_slug != null ? String(body.branch_slug).trim().toLowerCase() || null : undefined
  if (branchSlug !== undefined) {
    if (caller.role === TEAM_LEAD || caller.role === ADMIN) {
      branchSlug = caller.branch_slug
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
    patch.branch_slug = branchSlug
  }

  const email = body.email != null ? String(body.email).trim().toLowerCase() : ''
  const password = body.temporary_password != null ? String(body.temporary_password).trim() : ''
  if (email || password) {
    const authPatch = {}
    if (email) {
      if (!email.includes('@')) throw Object.assign(new Error('Valid email is required.'), { status: 400 })
      authPatch.email = email
      patch.login_email = email
    }
    if (password) {
      if (password.length < 8) throw Object.assign(new Error('Password must be at least 8 characters.'), { status: 400 })
      authPatch.password = password
    }
    const { error: authErr } = await admin.auth.admin.updateUserById(id, authPatch)
    if (authErr) throw Object.assign(new Error(authErr.message), { status: 400 })
  }

  const { data, error } = await admin.from('staff_profiles').update(patch).eq('id', id).select().maybeSingle()
  if (error) throw Object.assign(new Error(error.message), { status: 400 })
  if (!data) throw Object.assign(new Error('Staff not found.'), { status: 404 })

  if (patch.branch_slug && ['admin', 'team_lead', 'staff', 'marketing', 'sales'].includes(data.role)) {
    await admin.from('staff_branch_assignments').delete().eq('staff_id', id)
    await admin.from('staff_branch_assignments').insert({ staff_id: id, branch_slug: patch.branch_slug })
  }

  return data
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

export async function handleUpdateStaffRequest(req, res, { getBody, getAccessToken }) {
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
    const result = await updateStaffAccount({ accessToken: getAccessToken(), body })
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    res.statusCode = err.status || 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: err.message || String(err) }))
  }
}
