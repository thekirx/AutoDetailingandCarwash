#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return
  for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadDotEnv()

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
  process.exit(1)
}

function passwordForEnv(envKey) {
  const value = process.env[envKey]
  if (!value) {
    console.error(`Missing ${envKey} in environment; cannot provision new users cleanly.`)
    process.exit(1)
  }
  return value
}

const GENERAL_ADMIN_GRANTS = {
  crm: true,
  pos: true,
  audit: true,
  people: true,
  content: true,
  history: true,
  kpi_all: true,
  reports: true,
  reviews: true,
  bookings: true,
  branches: true,
  inquiries: true,
  queue_all: true,
  rbac_edit: true,
  memberships: true,
  branches_all: true,
  finance_view: true,
  finance_write: true,
  notifications: true,
  planning_edit: true,
  services_merch: true,
}

const REAL_EMPLOYEES = [
  // Team Leads (8)
  {
    full_name: 'Jaycee',
    username: 'jaycee',
    email: 'jaycee@hakumautocare.com',
    role: 'team_lead',
    branch_slug: 'bacoor',
    assigned_branches: ['bacoor'],
    passwordEnv: 'VITE_DEMO_PASSWORD_TL',
  },
  {
    full_name: 'Ronnel',
    username: 'ronnel',
    email: 'ronnel@hakumautocare.com',
    role: 'team_lead',
    branch_slug: 'bacoor',
    assigned_branches: ['bacoor'],
    passwordEnv: 'VITE_DEMO_PASSWORD_TL',
  },
  {
    full_name: 'Rovi',
    username: 'rovi',
    email: 'rovi@hakumautocare.com',
    role: 'team_lead',
    branch_slug: 'dasmarinas',
    assigned_branches: ['dasmarinas'],
    passwordEnv: 'VITE_DEMO_PASSWORD_TL',
  },
  {
    full_name: 'Ben',
    username: 'ben',
    email: 'ben@hakumautocare.com',
    role: 'team_lead',
    branch_slug: 'dasmarinas',
    assigned_branches: ['dasmarinas'],
    passwordEnv: 'VITE_DEMO_PASSWORD_TL',
  },
  {
    full_name: 'Kyle',
    username: 'kyle',
    email: 'kyle@hakumautocare.com',
    role: 'team_lead',
    branch_slug: 'batangas',
    assigned_branches: ['batangas'],
    passwordEnv: 'VITE_DEMO_PASSWORD_TL',
  },
  {
    full_name: 'Rex',
    username: 'rex',
    email: 'rex@hakumautocare.com',
    role: 'team_lead',
    branch_slug: 'batangas',
    assigned_branches: ['batangas'],
    passwordEnv: 'VITE_DEMO_PASSWORD_TL',
  },
  {
    full_name: 'Russel',
    username: 'russel',
    email: 'russel@hakumautocare.com',
    role: 'team_lead',
    branch_slug: 'imus',
    assigned_branches: ['imus'],
    passwordEnv: 'VITE_DEMO_PASSWORD_TL',
  },
  {
    full_name: 'Jedrick',
    username: 'jedrick',
    email: 'jedrick@hakumautocare.com',
    role: 'team_lead',
    branch_slug: 'imus',
    assigned_branches: ['imus'],
    passwordEnv: 'VITE_DEMO_PASSWORD_TL',
  },
  // Branch Admins (3)
  {
    full_name: 'Jennica',
    username: 'jennica',
    email: 'jennica@hakumautocare.com',
    role: 'admin',
    branch_slug: 'bacoor',
    assigned_branches: ['bacoor'],
    passwordEnv: 'VITE_DEMO_PASSWORD_ADMIN',
  },
  {
    full_name: 'Peter',
    username: 'peter',
    email: 'peter@hakumautocare.com',
    role: 'admin',
    branch_slug: 'dasmarinas',
    assigned_branches: ['dasmarinas'],
    passwordEnv: 'VITE_DEMO_PASSWORD_ADMIN',
  },
  {
    full_name: 'Almirra',
    username: 'almirra',
    email: 'almirra@hakumautocare.com',
    role: 'admin',
    branch_slug: 'batangas',
    assigned_branches: ['batangas'],
    passwordEnv: 'VITE_DEMO_PASSWORD_ADMIN',
  },
  // General Admins (3)
  {
    full_name: 'Lucy',
    username: 'lucy',
    email: 'assistant@hakumautocare.com',
    role: 'assistant_super_admin',
    branch_slug: null,
    assigned_branches: [],
    permission_grants: GENERAL_ADMIN_GRANTS,
    passwordEnv: 'VITE_DEMO_PASSWORD_ASA',
  },
  {
    full_name: 'Robert',
    username: 'robert',
    email: 'robert@hakumautocare.com',
    role: 'assistant_super_admin',
    branch_slug: null,
    assigned_branches: [],
    permission_grants: GENERAL_ADMIN_GRANTS,
    passwordEnv: 'VITE_DEMO_PASSWORD_ASA',
  },
  {
    full_name: 'Bryan',
    username: 'bryan',
    email: 'bryan@hakumautocare.com',
    role: 'assistant_super_admin',
    branch_slug: null,
    assigned_branches: [],
    permission_grants: GENERAL_ADMIN_GRANTS,
    passwordEnv: 'VITE_DEMO_PASSWORD_ASA',
  },
  // Marketing Manager Across All (1)
  {
    full_name: 'Mira',
    username: 'mira',
    email: 'mira@hakumautocare.com',
    role: 'marketing',
    branch_slug: 'bacoor',
    assigned_branches: ['bacoor', 'batangas', 'dasmarinas', 'imus'],
    passwordEnv: 'VITE_DEMO_PASSWORD_MARKETING',
  },
]

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function listAllAuthUsersByEmail() {
  const byEmail = new Map()
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    for (const user of data.users || []) {
      if (user.email) byEmail.set(user.email.toLowerCase(), user)
    }
    if (!data.users || data.users.length < 200) break
    page += 1
  }
  return byEmail
}

async function main() {
  const existingUsers = await listAllAuthUsersByEmail()
  let createdCount = 0
  let updatedCount = 0

  for (const emp of REAL_EMPLOYEES) {
    const email = emp.email.toLowerCase()
    let authUser = existingUsers.get(email) || null

    if (!authUser) {
      const password = passwordForEnv(emp.passwordEnv)
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: emp.full_name,
          role: emp.role,
          branch_slug: emp.branch_slug,
        },
      })
      if (error) throw error
      authUser = created.user
      createdCount += 1
    } else {
      const { error } = await admin.auth.admin.updateUserById(authUser.id, {
        email_confirm: true,
        user_metadata: {
          ...(authUser.user_metadata || {}),
          full_name: emp.full_name,
          role: emp.role,
          branch_slug: emp.branch_slug,
        },
      })
      if (error) throw error
      updatedCount += 1
    }

    const { error: profileError } = await admin.from('staff_profiles').upsert(
      {
        id: authUser.id,
        full_name: emp.full_name,
        role: emp.role,
        branch_slug: emp.branch_slug,
        username: emp.username,
        login_email: email,
        permission_grants: emp.permission_grants || {},
        attendance_enabled: true,
        geofence_enabled: true,
        employment_type: 'permanent',
        is_active: true,
        is_archived: false,
      },
      { onConflict: 'id' },
    )
    if (profileError) throw profileError

    const { error: delErr } = await admin
      .from('staff_branch_assignments')
      .delete()
      .eq('staff_id', authUser.id)
    if (delErr) throw delErr

    if (emp.assigned_branches.length) {
      const { error: insErr } = await admin.from('staff_branch_assignments').insert(
        emp.assigned_branches.map((branch_slug) => ({
          staff_id: authUser.id,
          branch_slug,
        })),
      )
      if (insErr) throw insErr
    }

    console.log(
      `[OK] ${emp.full_name} (${email}) | role=${emp.role} | home=${emp.branch_slug || 'all'} | branches=${emp.assigned_branches.join(',') || 'all'}`,
    )
  }

  console.log(`Synced ${REAL_EMPLOYEES.length} real employees (created=${createdCount}, updated=${updatedCount}).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
