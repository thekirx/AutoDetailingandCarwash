/**
 * Live Phase C smoke against VITE_SUPABASE_* (read-mostly).
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const raw = fs.readFileSync('.env', 'utf8')
  const out = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
const results = []
function pass(id, note) {
  results.push({ id, ok: true, note })
  console.log(`PASS ${id} — ${note}`)
}
function fail(id, note) {
  results.push({ id, ok: false, note })
  console.error(`FAIL ${id} — ${note}`)
}

async function signIn(email, password) {
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw error
  return { sb, user: data.user }
}

async function main() {
  const { sb } = await signIn('bossmich@hakumautocare.com', 'HakumBoss2026!')

  const { data: roles, error: roleErr } = await sb.from('staff_profiles').select('role')
  if (roleErr) fail('C1-roles', roleErr.message)
  else {
    const counts = {}
    for (const r of roles || []) counts[r.role] = (counts[r.role] || 0) + 1
    pass('C1-roles', JSON.stringify(counts))
    const missing = ['detailer', 'video_editor', 'investor'].filter((r) => !counts[r])
    if (missing.length) pass('C1-provision-gap', `P2: no live rows yet for ${missing.join(', ')} (People hub)`)
    else pass('C1-provision-gap', 'detailer/video/investor present')
  }

  const { data: bookings, error: bErr } = await sb
    .from('bookings')
    .select('id,status,branch,created_at')
    .order('created_at', { ascending: false })
    .limit(8)
  if (bErr) fail('C3-bookings', bErr.message)
  else {
    const statuses = [...new Set((bookings || []).map((b) => b.status))]
    pass('C3-bookings', `n=${bookings?.length || 0} statuses=${statuses.join('|')}`)
  }

  const { data: sales, error: sErr } = await sb
    .from('sales')
    .select('id,status,total_minor,payment_method')
    .order('created_at', { ascending: false })
    .limit(5)
  if (sErr) fail('C5-sales', sErr.message)
  else pass('C5-sales', `n=${sales?.length || 0}`)

  const { error: expErr } = await sb.from('expenses').select('id,expense_kind').limit(3)
  if (expErr) fail('C5-expenses', expErr.message)
  else pass('C5-expenses', 'ok')

  const { error: attErr } = await sb.from('staff_attendance').select('id,status').limit(3)
  if (attErr) fail('C7-attendance', attErr.message)
  else pass('C7-attendance', 'staff_attendance ok')

  const { error: planErr } = await sb.from('plan_cards').select('id').limit(3)
  if (planErr) fail('C8-planner', planErr.message)
  else pass('C8-planner', 'plan_cards ok')

  const { error: revErr } = await sb.from('service_reviews').select('id').limit(3)
  if (revErr) fail('C9-reviews', revErr.message)
  else pass('C9-reviews', 'service_reviews ok')

  const { error: compErr } = await sb.from('compensation_settings').select('id').limit(1)
  if (compErr) fail('C10-comp', compErr.message)
  else pass('C10-comp', 'ok')

  for (const [id, email, password, expectRole] of [
    ['login-tl', 'teamlead@hakumautocare.com', 'HakumTL2026!', 'team_lead'],
    ['login-sales', 'sales@hakumautocare.com', 'HakumSales2026!', 'sales'],
    ['login-admin', 'admin@hakumautocare.com', 'HakumAdmin2026!', 'admin'],
    ['login-marketing', 'marketing@hakumautocare.com', 'HakumMkt2026!', 'marketing'],
    ['login-staff', 'staff1@hakumautocare.com', 'HakumStaff2026!', 'staff'],
    ['login-detailer', 'detailer@hakumautocare.com', 'HakumDetail2026!', 'detailer'],
    ['login-video', 'video@hakumautocare.com', 'HakumVideo2026!', 'video_editor'],
    ['login-investor', 'investor@hakumautocare.com', 'HakumInvest2026!', 'investor'],
  ]) {
    try {
      const { sb: s2, user } = await signIn(email, password)
      const { data: prof, error } = await s2
        .from('staff_profiles')
        .select('role,branch_slug')
        .eq('id', user.id)
        .maybeSingle()
      if (error) fail(id, error.message)
      else if (prof?.role !== expectRole) fail(id, `got role=${prof?.role}`)
      else pass(id, `role=${prof.role} branch=${prof.branch_slug}`)
      await s2.auth.signOut()
    } catch (e) {
      fail(id, e.message || String(e))
    }
  }

  try {
    const { user } = await signIn('demo.customer@hakumautocare.com', 'HakumCustomer2026!')
    pass('login-customer', `uid=${user.id.slice(0, 8)}`)
  } catch (e) {
    fail('login-customer', e.message || String(e))
  }

  const failed = results.filter((r) => !r.ok)
  console.log(`\nSUMMARY ${results.length - failed.length}/${results.length} pass`)
  fs.mkdirSync('docs', { recursive: true })
  fs.writeFileSync(
    'docs/qa-live-smoke.json',
    JSON.stringify({ at: new Date().toISOString(), url, results }, null, 2),
  )
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
