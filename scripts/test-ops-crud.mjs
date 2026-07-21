/**
 * Live CRUD smoke test for branches / services / staff_profiles / audit.
 * Uses service role for setup + BossMich password login for RPC/RLS paths.
 * Run: node scripts/test-ops-crud.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 1) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim()
    if (!process.env[k]) process.env[k] = v
  }
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
if (!url || !serviceKey || !anon) {
  console.error('Missing SUPABASE_URL / SERVICE_ROLE / ANON')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })

const stamp = Date.now().toString(36).slice(-6)
const BRANCH_SLUG = `crudtest-${stamp}`
// Code must be 2–5 A–Z only — derive from stamp letters
const BRANCH_CODE = (`C${stamp.replace(/[^a-z]/gi, '').toUpperCase()}XX`).slice(0, 4)
const SERVICE_SLUG = `crud-svc-${stamp}`
const results = []

function ok(name, detail = '') {
  results.push({ name, ok: true, detail })
  console.log('✔', name, detail || '')
}
function fail(name, err) {
  results.push({ name, ok: false, detail: String(err?.message || err) })
  console.error('✘', name, err?.message || err)
}

async function cleanupSmoke(adminClient) {
  const { data } = await adminClient.from('services').select('id').like('slug', 'crud-svc-%')
  if (data?.length) await adminClient.from('services').delete().in('id', data.map((r) => r.id))
}

async function main() {
  await cleanupSmoke(admin)

  // Sign in as BossMich (authenticated RLS/RPC path)
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: 'bossmich@hakumautocare.com',
    password: 'HakumBoss2026!',
  })
  if (authErr) throw authErr
  ok('auth.bossmich', authData.user.id)

  // --- Audit table / RPC presence ---
  {
    const { error } = await client.from('audit_logs').select('id').limit(1)
    if (error) fail('audit_logs.select', error)
    else ok('audit_logs.select')
  }
  {
    const { data, error } = await client.rpc('write_audit_event', {
      input_action: 'test',
      input_entity_type: 'smoke',
      input_entity_id: stamp,
      input_summary: 'CRUD smoke test',
      input_meta: { stamp },
    })
    if (error) fail('write_audit_event', error)
    else ok('write_audit_event', data?.id || '')
  }

  // --- Branches CRUD via RPC ---
  let createdBranch = null
  {
    const { data, error } = await client.rpc('create_branch', {
      input_name: `CRUD Test ${stamp}`,
      input_slug: BRANCH_SLUG,
      input_code: BRANCH_CODE,
      input_address: 'Test City',
    })
    if (error) fail('branch.create', error)
    else {
      createdBranch = data
      ok('branch.create', data.slug)
    }
  }

  // Validation: bad slug
  {
    const { error } = await client.rpc('create_branch', {
      input_name: 'Bad',
      input_slug: 'BAD SLUG!',
      input_code: 'XX',
      input_address: '',
    })
    if (error) ok('branch.create.reject_bad_slug', error.message)
    else fail('branch.create.reject_bad_slug', new Error('expected error'))
  }

  // Validation: bad code
  {
    const { error } = await client.rpc('create_branch', {
      input_name: 'Bad Code',
      input_slug: `badcode-${stamp}`,
      input_code: '1',
      input_address: '',
    })
    if (error) ok('branch.create.reject_bad_code', error.message)
    else fail('branch.create.reject_bad_code', new Error('expected error'))
  }

  if (createdBranch) {
    const { data, error } = await client.rpc('update_branch', {
      input_branch_slug: BRANCH_SLUG,
      input_name: `CRUD Test Updated ${stamp}`,
      input_code: BRANCH_CODE,
      input_address: 'Updated Address',
      input_is_active: true,
    })
    if (error) fail('branch.update', error)
    else {
      assert.equal(data.name.includes('Updated'), true)
      ok('branch.update', data.name)
    }

    const { data: off, error: offErr } = await client.rpc('update_branch', {
      input_branch_slug: BRANCH_SLUG,
      input_name: `CRUD Test Updated ${stamp}`,
      input_code: BRANCH_CODE,
      input_address: 'Updated Address',
      input_is_active: false,
    })
    if (offErr) fail('branch.deactivate', offErr)
    else {
      assert.equal(off.is_active, false)
      ok('branch.deactivate')
    }

    const { data: arch, error: archErr } = await client.rpc('archive_branch', {
      input_branch_slug: BRANCH_SLUG,
    })
    if (archErr) fail('branch.archive', archErr)
    else {
      assert.equal(arch.is_archived, true)
      ok('branch.archive')
    }
  }

  // --- Services CRUD (direct table) ---
  let serviceId = null
  {
    const { data, error } = await client
      .from('services')
      .insert({
        name: `CRUD Service ${stamp}`,
        slug: SERVICE_SLUG,
        price_minor: 19900,
        duration_minutes: 45,
        is_active: true,
        is_archived: false,
        display_order: 99,
      })
      .select()
      .maybeSingle()
    if (error) fail('service.create', error)
    else {
      serviceId = data.id
      ok('service.create', data.id)
    }
  }

  // Validation: empty name blocked in app layer AND DB CHECK
  {
    try {
      const { validateServiceInput } = await import('../src/lib/opsValidation.js')
      validateServiceInput({ name: '  ', price: '10', duration_minutes: '30' })
      fail('service.validate.reject_empty_name', new Error('expected throw'))
    } catch (err) {
      if (/name is required/i.test(err.message)) ok('service.validate.reject_empty_name')
      else fail('service.validate.reject_empty_name', err)
    }
  }
  {
    const { error } = await client.from('services').insert({
      name: '',
      slug: `blank-db-${stamp}`,
      price_minor: 100,
      duration_minutes: 10,
      is_active: true,
      is_archived: false,
    })
    if (error && /services_name_not_blank|check constraint/i.test(error.message)) {
      ok('service.db.reject_blank_name', error.message.split('\n')[0])
    } else if (error) fail('service.db.reject_blank_name', error)
    else fail('service.db.reject_blank_name', new Error('blank name allowed by DB'))
  }
  {
    const { error } = await client.from('services').insert({
      name: `Bad dur ${stamp}`,
      slug: `bad-dur-${stamp}`,
      price_minor: 100,
      duration_minutes: 0,
      is_active: true,
      is_archived: false,
    })
    if (error && /duration|check constraint/i.test(error.message)) ok('service.db.reject_zero_duration')
    else if (error) fail('service.db.reject_zero_duration', error)
    else fail('service.db.reject_zero_duration', new Error('zero duration allowed'))
  }

  if (serviceId) {
    const { data, error } = await client
      .from('services')
      .update({
        name: `CRUD Service Updated ${stamp}`,
        price_minor: 24900,
        duration_minutes: 60,
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', serviceId)
      .select()
      .maybeSingle()
    if (error) fail('service.update', error)
    else {
      assert.equal(data.is_active, false)
      assert.equal(data.price_minor, 24900)
      ok('service.update')
    }

    const { data: arch, error: archErr } = await client
      .from('services')
      .update({ is_archived: true, is_active: false, updated_at: new Date().toISOString() })
      .eq('id', serviceId)
      .select()
      .maybeSingle()
    if (archErr) fail('service.archive', archErr)
    else {
      assert.equal(arch.is_archived, true)
      ok('service.archive')
    }
  }

  // --- Staff profile update/deactivate (not BossMich) ---
  {
    const { data: staff } = await client
      .from('staff_profiles')
      .select('id, full_name, role, phone, is_active')
      .eq('role', 'staff')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (!staff) fail('staff.update.fixture', new Error('no active staff row'))
    else {
      const prevPhone = staff.phone
      const { data, error } = await client
        .from('staff_profiles')
        .update({ phone: '09179998888', updated_at: new Date().toISOString() })
        .eq('id', staff.id)
        .select()
        .maybeSingle()
      if (error) fail('staff.update', error)
      else {
        assert.equal(data.phone, '09179998888')
        ok('staff.update', data.full_name)
        await client.from('staff_profiles').update({ phone: prevPhone }).eq('id', staff.id)
      }

      // Cannot reassign BossMich via staff update validation
      const { data: boss } = await client.from('staff_profiles').select('id').eq('role', 'BossMich').maybeSingle()
      if (boss) {
        ok('staff.bossmich.exists', boss.id)
        try {
          const { validateStaffUpdate } = await import('../src/lib/opsValidation.js')
          validateStaffUpdate({ id: boss.id, full_name: 'BossMich', role: 'BossMich', branch_slug: null })
          fail('staff.protect_bossmich_role', new Error('expected throw'))
        } catch (err) {
          if (/Super Admin/i.test(err.message)) ok('staff.protect_bossmich_role')
          else fail('staff.protect_bossmich_role', err)
        }
      }
    }
  }

  // --- List reads ---
  {
    const { data, error } = await client.from('branches').select('slug').eq('is_archived', false).limit(5)
    if (error) fail('branch.list', error)
    else ok('branch.list', `${data.length} rows`)
  }
  {
    const { data, error } = await client.from('services').select('id').eq('is_archived', false).limit(5)
    if (error) fail('service.list', error)
    else ok('service.list', `${data.length} rows`)
  }
  {
    const { data, error } = await client.from('staff_profiles').select('id').eq('is_archived', false).limit(5)
    if (error) fail('staff.list', error)
    else ok('staff.list', `${data.length} rows`)
  }

  // --- Provision staff API validation (direct server module) ---
  {
    const { data: session } = await client.auth.getSession()
    const token = session.session?.access_token
    const { provisionStaffAccount } = await import('../server/provisionStaff.mjs')
    try {
      await provisionStaffAccount({
        accessToken: token,
        body: { email: 'bad', full_name: 'X', role: 'staff', branch_slug: 'bacoor' },
        siteOrigin: 'http://localhost:5173',
      })
      fail('provision.reject_bad_email', new Error('expected error'))
    } catch (err) {
      if (/email/i.test(err.message)) ok('provision.reject_bad_email')
      else fail('provision.reject_bad_email', err)
    }
    try {
      await provisionStaffAccount({
        accessToken: token,
        body: { email: `crud.staff.${stamp}@hakumautocare.com`, full_name: 'CRUD Staff', role: 'staff', branch_slug: '', temporary_password: 'HakumStaff2026!' },
        siteOrigin: 'http://localhost:5173',
      })
      fail('provision.reject_missing_branch', new Error('expected error'))
    } catch (err) {
      if (/branch/i.test(err.message)) ok('provision.reject_missing_branch')
      else fail('provision.reject_missing_branch', err)
    }
  }

  await client.auth.signOut()

  // --- Demo customer + branch admin login smoke ---
  {
    const { data, error } = await client.auth.signInWithPassword({
      email: 'demo.customer@hakumautocare.com',
      password: 'HakumCustomer2026!',
    })
    if (error) fail('auth.demo_customer', error)
    else {
      ok('auth.demo_customer', data.user.id)
      await client.auth.signOut()
    }
  }
  {
    const { data, error } = await client.auth.signInWithPassword({
      email: 'admin@hakumautocare.com',
      password: 'HakumAdmin2026!',
    })
    if (error) fail('auth.branch_admin', error)
    else {
      const { data: profile } = await client
        .from('staff_profiles')
        .select('role, branch_slug, is_active')
        .eq('id', data.user.id)
        .maybeSingle()
      if (!profile?.is_active || profile.role !== 'admin') {
        fail('auth.branch_admin.profile', new Error(JSON.stringify(profile)))
      } else ok('auth.branch_admin', `${profile.role}@${profile.branch_slug}`)
      // Admin should read audit
      const { error: auditErr } = await client.from('audit_logs').select('id').limit(1)
      if (auditErr) fail('auth.branch_admin.audit_read', auditErr)
      else ok('auth.branch_admin.audit_read')
      await client.auth.signOut()
    }
  }
  {
    // Staff must NOT create branches
    const { error: loginErr } = await client.auth.signInWithPassword({
      email: 'staff1@hakumautocare.com',
      password: 'HakumStaff2026!',
    })
    if (loginErr) fail('auth.staff', loginErr)
    else {
      ok('auth.staff')
      const { error } = await client.rpc('create_branch', {
        input_name: 'Nope',
        input_slug: `staff-deny-${stamp}`,
        input_code: 'ZZ',
        input_address: '',
      })
      if (error && /Only BossMich or admin|42501|permission/i.test(error.message)) {
        ok('staff.deny_create_branch')
      } else if (error) ok('staff.deny_create_branch', error.message)
      else fail('staff.deny_create_branch', new Error('staff created a branch'))
      await client.auth.signOut()
    }
  }

  await cleanupSmoke(admin)

  const failed = results.filter((r) => !r.ok)
  console.log('\n---')
  console.log(`passed ${results.length - failed.length}/${results.length}`)
  if (failed.length) {
    console.error('FAILED:', failed.map((f) => f.name).join(', '))
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
