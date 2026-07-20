/**
 * Seed BossMich, ensure Team Lead, create auth-backed staff, mark attendance today.
 * Run: node scripts/seed-floor-accounts.mjs
 *
 * Default passwords (change after first login):
 *   bossmich@hakumautocare.com  → HakumBoss2026!
 *   teamlead@hakumautocare.com  → HakumTL2026!
 *   staff1@hakumautocare.com    → HakumStaff2026!
 *   staff2@hakumautocare.com    → HakumStaff2026!
 *   staff3@hakumautocare.com    → HakumStaff2026!
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

async function ensureAuthUser({ email, password, full_name }) {
  const { data: existing } = await admin
    .from('staff_profiles')
    .select('id')
    .limit(0)

  void existing

  // Look up via auth admin list filter — create or update password
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  })
  if (!error && created?.user) return created.user

  // Already exists: find by paging (small staff set) then reset password
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
  await admin.auth.admin.updateUserById(found.id, { password, email_confirm: true })
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

  // Ensure team lead profile (auth already exists)
  const { data: tlList } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 })
  const tlUser = tlList.users.find((u) => (u.email || '').toLowerCase() === 'teamlead@hakumautocare.com')
  if (!tlUser) throw new Error('teamlead@hakumautocare.com missing — create in Auth first')
  await admin.auth.admin.updateUserById(tlUser.id, { password: 'HakumTL2026!', email_confirm: true })
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

  // Sample customer with set-password invite queued
  const samplePhone = '09181239999'
  const sampleEmail = 'sample.customer@hakumautocare.com'
  const { data: sampleAuth, error: sampleErr } = await admin.auth.admin.createUser({
    email: sampleEmail,
    password: randomTemp(),
    email_confirm: true,
    user_metadata: { role: 'customer', full_name: 'Sample Customer', phone: samplePhone, must_set_password: true },
  })
  let sampleUser = sampleAuth?.user
  if (sampleErr) {
    const { data: more } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 })
    sampleUser = more.users.find((u) => (u.email || '').toLowerCase() === sampleEmail) || null
  }
  if (sampleUser) {
    await admin.from('customers').upsert(
      {
        id: sampleUser.id,
        role: 'customer',
        full_name: 'Sample Customer',
        first_name: 'Sample',
        last_name: 'Customer',
        phone: samplePhone,
        email: sampleEmail,
        is_archived: false,
      },
      { onConflict: 'id' },
    )
    const { data: link } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: sampleEmail,
      options: { redirectTo: 'http://localhost:5173/account/set-password' },
    })
    await admin.from('sms_events').insert({
      phone: samplePhone,
      message: `Hakum sample account ready. Set password: ${link?.properties?.action_link || '(check email invite)'}`,
      event_type: 'account_invite',
      status: 'queued',
    })
    console.log('Sample customer', sampleUser.id)
  }

  console.log('Done.')
  console.log(JSON.stringify({
    bossmich: 'bossmich@hakumautocare.com / HakumBoss2026!',
    teamlead: 'teamlead@hakumautocare.com / HakumTL2026!',
    staff: 'staff1|2|3@hakumautocare.com / HakumStaff2026!',
    attendance_date: TODAY,
  }, null, 2))
}

function randomTemp() {
  return `Hakum-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}!`
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
