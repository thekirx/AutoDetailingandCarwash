/**
 * Seed BossMich, Admin, Team Lead, Sales, staff, and demo customer with known passwords.
 * Run: node scripts/seed-floor-accounts.mjs
 *
 * Default passwords (change after first login):
 *   bossmich@hakumautocare.com     → HakumBoss2026!
 *   admin@hakumautocare.com        → HakumAdmin2026!
 *   teamlead@hakumautocare.com     → HakumTL2026!
 *   sales@hakumautocare.com        → HakumSales2026!
 *   staff1@hakumautocare.com       → HakumStaff2026!
 *   marketing@hakumautocare.com    → HakumMkt2026!
 *   assistant@hakumautocare.com    → HakumAsa2026!
 *   opslead@hakumautocare.com      → HakumOpsLead2026!
 *   detailer@hakumautocare.com     → HakumDetail2026!
 *   video@hakumautocare.com        → HakumVideo2026!
 *   investor@hakumautocare.com     → HakumInvest2026!
 *   demo.customer@…                → HakumCustomer2026!
 *
 * (cashier demos removed — Part 9)
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

const DETAILING_SERVICES = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Ceramic Coating',
    slug: 'ceramic-coating',
    price_minor: 1_500_000,
    duration_minutes: 480,
    display_order: 10,
    description: 'Multi-day ceramic coating. Crew required.',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Paint Maintenance',
    slug: 'paint-maintenance',
    price_minor: 350_000,
    duration_minutes: 180,
    display_order: 15,
    description: 'Follow-up paint maintenance for Ceramic Coating and PPF.',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Nano Ceramic Tint',
    slug: 'nano-ceramic-tint',
    price_minor: 800_000,
    duration_minutes: 360,
    display_order: 20,
    description: 'Multi-day nano ceramic window tint. Crew required.',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Paint Protection Film (PPF)',
    slug: 'paint-protection-film',
    price_minor: 2_500_000,
    duration_minutes: 720,
    display_order: 30,
    description: 'Multi-day PPF install. Crew required.',
  },
]

async function seedFloorDetailingServices() {
  for (const svc of DETAILING_SERVICES) {
    const { error } = await admin.from('services').upsert(
      {
        ...svc,
        pay_category: 'detailing',
        is_active: true,
        is_archived: false,
      },
      { onConflict: 'slug' },
    )
    if (error) throw error
    const sizes = [
      { size_slug: 'small', price_minor: Math.round(svc.price_minor * 0.85) },
      { size_slug: 'medium', price_minor: svc.price_minor },
      { size_slug: 'large', price_minor: Math.round(svc.price_minor * 1.2) },
      { size_slug: 'extra_large', price_minor: Math.round(svc.price_minor * 1.4) },
    ]
    const { error: sizeErr } = await admin.from('service_size_prices').upsert(
      sizes.map((row) => ({ service_id: svc.id, ...row })),
      { onConflict: 'service_id,size_slug' },
    )
    if (sizeErr) throw sizeErr
    console.log('Detailing service', svc.slug)
  }
}

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

async function upsertStaffProfile(user, { full_name, role, branch_slug, phone = null, permission_grants = undefined }) {
  const row = {
    id: user.id,
    full_name,
    role,
    branch_slug,
    phone,
    is_active: true,
    is_archived: false,
  }
  if (permission_grants !== undefined) row.permission_grants = permission_grants
  const { error } = await admin.from('staff_profiles').upsert(row, { onConflict: 'id' })
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

  await seedFloorDetailingServices()

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

  const salesUser = await ensureAuthUser({
    email: 'sales@hakumautocare.com',
    password: 'HakumSales2026!',
    full_name: 'Sales Desk',
  })
  await upsertStaffProfile(salesUser, {
    full_name: 'Sales Desk',
    role: 'sales',
    branch_slug: BRANCH,
    phone: '09170000015',
  })
  await admin.from('staff_branch_assignments').delete().eq('staff_id', salesUser.id)
  await admin.from('staff_branch_assignments').insert({ staff_id: salesUser.id, branch_slug: BRANCH })
  console.log('Sales', salesUser.id)

  const staffDefs = [
    { email: 'staff1@hakumautocare.com', full_name: 'Crew One', phone: '09170001111' },
    { email: 'staff2@hakumautocare.com', full_name: 'Crew Two', phone: '09170002222' },
    { email: 'staff3@hakumautocare.com', full_name: 'Crew Three', phone: '09170003333' },
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

  const marketing = await ensureAuthUser({
    email: 'marketing@hakumautocare.com',
    password: 'HakumMkt2026!',
    full_name: 'Marketing Lead',
  })
  await upsertStaffProfile(marketing, {
    full_name: 'Marketing Lead',
    role: 'marketing',
    branch_slug: BRANCH,
    phone: '09170000021',
  })
  console.log('Marketing', marketing.id)

  const asa = await ensureAuthUser({
    email: 'assistant@hakumautocare.com',
    password: 'HakumAsa2026!',
    full_name: 'Assistant Super Admin',
  })
  await upsertStaffProfile(asa, {
    full_name: 'Assistant Super Admin',
    role: 'assistant_super_admin',
    branch_slug: null,
    phone: '09170000030',
    permission_grants: {},
  })
  console.log('Assistant Super Admin', asa.id)

  const opsLead = await ensureAuthUser({
    email: 'opslead@hakumautocare.com',
    password: 'HakumOpsLead2026!',
    full_name: 'Operations Lead',
  })
  await upsertStaffProfile(opsLead, {
    full_name: 'Operations Lead',
    role: 'operations_lead',
    branch_slug: null,
    phone: '09170000031',
  })
  await admin.from('staff_profiles').update({ attendance_enabled: false }).eq('id', opsLead.id)
  console.log('Operations Lead', opsLead.id)

  const detailer = await ensureAuthUser({
    email: 'detailer@hakumautocare.com',
    password: 'HakumDetail2026!',
    full_name: 'Demo Detailer',
  })
  await upsertStaffProfile(detailer, {
    full_name: 'Demo Detailer',
    role: 'detailer',
    branch_slug: BRANCH,
    phone: '09170000040',
  })
  await admin
    .from('staff_profiles')
    .update({ attendance_enabled: true, geofence_enabled: true })
    .eq('id', detailer.id)
  console.log('Detailer', detailer.id)

  const video = await ensureAuthUser({
    email: 'video@hakumautocare.com',
    password: 'HakumVideo2026!',
    full_name: 'Demo Video Editor',
  })
  await upsertStaffProfile(video, {
    full_name: 'Demo Video Editor',
    role: 'video_editor',
    branch_slug: BRANCH,
    phone: '09170000041',
  })
  console.log('Video Editor', video.id)

  const investor = await ensureAuthUser({
    email: 'investor@hakumautocare.com',
    password: 'HakumInvest2026!',
    full_name: 'Demo Investor',
  })
  await upsertStaffProfile(investor, {
    full_name: 'Demo Investor',
    role: 'investor',
    branch_slug: null,
    phone: '09170000042',
  })
  console.log('Investor', investor.id)

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
        sales: 'sales@hakumautocare.com / HakumSales2026!',
        staff: 'staff1|2|3@hakumautocare.com / HakumStaff2026! (Crew 1–3 · present on Bacoor)',
        marketing: 'marketing@hakumautocare.com / HakumMkt2026!',
        assistant: 'assistant@hakumautocare.com / HakumAsa2026!',
        opslead: 'opslead@hakumautocare.com / HakumOpsLead2026!',
        detailer: 'detailer@hakumautocare.com / HakumDetail2026!',
        video: 'video@hakumautocare.com / HakumVideo2026!',
        investor: 'investor@hakumautocare.com / HakumInvest2026!',
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
