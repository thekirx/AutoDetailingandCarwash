/**
 * Seed BossMich, Admin, Team Lead, staff, and demo customer with known passwords.
 * Run: node scripts/seed-floor-accounts.mjs
 *
 * Default passwords (change after first login):
 *   bossmich@hakumautocare.com     → HakumBoss2026!
 *   admin@hakumautocare.com        → HakumAdmin2026!
 *   teamlead@hakumautocare.com     → HakumTL2026!
 *   staff1@hakumautocare.com       → HakumStaff2026!
 *   demo.customer@hakumautocare.com → HakumCustomer2026!
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// ponytail: load .env without adding dotenv dependency
const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const k = trimmed.slice(0, eq).trim()
    const v = trimmed.slice(eq + 1).trim()
    if (!process.env[k]) process.env[k] = v
  }
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const BRANCH = 'bacoor'
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

async function ensureAuthUser({ email, password, full_name, user_metadata = {} }) {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, ...user_metadata },
  })
  if (!error && created?.user) return created.user

  let page = 1
  let found = null
  for (;;) {
    const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (listError) throw listError
    found = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase()) || null
    if (found || !data.users.length || data.users.length < 100) break
    page += 1
  }
  if (!found) throw error || new Error(`Unable to create or find ${email}`)
  await admin.auth.admin.updateUserById(found.id, {
    password,
    email_confirm: true,
    user_metadata: { ...found.user_metadata, full_name, ...user_metadata },
  })
  return found
}

async function upsertStaffProfile(user, { full_name, role, branch_slug, phone = null }) {
  const { error } = await admin.from('staff_profiles').upsert(
    {
      id: user.id,
      full_name,
      role,
      branch_slug,
      phone,
      is_active: true,
      is_archived: false,
    },
    { onConflict: 'id' },
  )
  if (error) throw error
  return user.id
}

async function markPresent(staffId, markedBy) {
  const { error } = await admin.from('staff_attendance').upsert(
    {
      staff_id: staffId,
      branch_slug: BRANCH,
      attendance_date: TODAY,
      status: 'present',
      checked_in_at: new Date().toISOString(),
      checked_out_at: null,
      marked_by: markedBy,
    },
    { onConflict: 'staff_id,attendance_date' },
  )
  if (error) throw error
}

async function archiveOrphanStaff(keepIds) {
  const { data: rows } = await admin
    .from('staff_profiles')
    .select('id, full_name, role')
    .eq('branch_slug', BRANCH)
    .eq('role', 'staff')
    .eq('is_active', true)

  for (const row of rows || []) {
    if (keepIds.has(row.id)) continue
    const { data: auth } = await admin.auth.admin.getUserById(row.id)
    if (auth?.user) continue
    await admin
      .from('staff_profiles')
      .update({ is_active: false, is_archived: true })
      .eq('id', row.id)
    console.log('archived orphan staff profile', row.full_name, row.id)
  }
}

async function main() {
  console.log('Seeding floor accounts for', TODAY, BRANCH)

  const boss = await ensureAuthUser({
    email: 'bossmich@hakumautocare.com',
    password: 'HakumBoss2026!',
    full_name: 'BossMich',
  })
  await upsertStaffProfile(boss, { full_name: 'BossMich', role: 'BossMich', branch_slug: null })
  console.log('BossMich', boss.id)

  const branchAdmin = await ensureAuthUser({
    email: 'admin@hakumautocare.com',
    password: 'HakumAdmin2026!',
    full_name: 'Branch Admin',
  })
  await upsertStaffProfile(branchAdmin, {
    full_name: 'Branch Admin',
    role: 'admin',
    branch_slug: BRANCH,
    phone: '09170000001',
  })
  console.log('Admin', branchAdmin.id)

  const tlUser = await ensureAuthUser({
    email: 'teamlead@hakumautocare.com',
    password: 'HakumTL2026!',
    full_name: 'TL Test Account',
  })
  await upsertStaffProfile(tlUser, { full_name: 'TL Test Account', role: 'team_lead', branch_slug: BRANCH })
  console.log('Team Lead', tlUser.id)

  const staffDefs = [
    { email: 'staff1@hakumautocare.com', full_name: 'Staff One', phone: '09170001111' },
    { email: 'staff2@hakumautocare.com', full_name: 'Staff Two', phone: '09170002222' },
    { email: 'staff3@hakumautocare.com', full_name: 'Staff Three', phone: '09170003333' },
  ]
  const staffIds = new Set()
  for (const def of staffDefs) {
    const user = await ensureAuthUser({
      email: def.email,
      password: 'HakumStaff2026!',
      full_name: def.full_name,
    })
    await upsertStaffProfile(user, {
      full_name: def.full_name,
      role: 'staff',
      branch_slug: BRANCH,
      phone: def.phone,
    })
    await markPresent(user.id, tlUser.id)
    staffIds.add(user.id)
    console.log('Staff', def.email, user.id, 'present', TODAY)
  }

  await archiveOrphanStaff(staffIds)

  const demo = await ensureAuthUser({
    email: 'demo.customer@hakumautocare.com',
    password: 'HakumCustomer2026!',
    full_name: 'Demo Customer',
    user_metadata: {
      role: 'customer',
      phone: '09180000001',
      must_set_password: false,
    },
  })
  await admin.from('customers').upsert(
    {
      id: demo.id,
      role: 'customer',
      full_name: 'Demo Customer',
      first_name: 'Demo',
      last_name: 'Customer',
      phone: '09180000001',
      email: 'demo.customer@hakumautocare.com',
      is_archived: false,
    },
    { onConflict: 'id' },
  )
  console.log('Demo customer', demo.id)

  console.log('Done.')
  console.log(
    JSON.stringify(
      {
        bossmich: 'bossmich@hakumautocare.com / HakumBoss2026!',
        admin: 'admin@hakumautocare.com / HakumAdmin2026!',
        teamlead: 'teamlead@hakumautocare.com / HakumTL2026!',
        staff: 'staff1|2|3@hakumautocare.com / HakumStaff2026!',
        customer: 'demo.customer@hakumautocare.com / HakumCustomer2026!',
        attendance_date: TODAY,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
