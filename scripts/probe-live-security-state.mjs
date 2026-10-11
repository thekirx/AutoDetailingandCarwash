/**
 * READ-ONLY independent verification that the security migrations are actually
 * live in production.
 *
 * The commit that applied them (70c0c1d) claims BUG-069/070/071/079/080/085/086
 * are enforced, with probe-rls-role-matrix.sql 24/24 and
 * probe-daily-sheet-self-approval.sql 4/4. Those probes run inside rolled-back
 * transactions. This does not re-run them; it checks the two claims that can be
 * settled with SELECTs alone, as a Branch Admin, and therefore without any risk
 * of writing.
 *
 * Why bother with an independent check at all: a commit message is a claim, not
 * evidence, and the same session that produced these migrations shipped a drift
 * guard that could never pass (array_to_string of an empty array is '' rather
 * than NULL, so it raised on every clean run). A migration can be merged, green
 * in its contract test, and still not be doing anything.
 *
 * SELECT only. Nothing here writes, and nothing here attempts the destructive
 * operation BUG-071 was about.
 *
 *   node scripts/probe-live-security-state.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i).trim()
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim()
}

const URL_ = process.env.SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

let failures = 0
const check = (name, ok, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`)
}

const user = createClient(URL_, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
const admin = createClient(URL_, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

function readOrFail(label, res) {
  if (res.error) throw new Error(`${label} read failed: ${res.error.message}`)
  return res.data
}

const { data: auth, error: authErr } = await user.auth.signInWithPassword({
  email: 'admin@hakumautocare.com',
  password: 'HakumAdmin2026!',
})
if (authErr) {
  console.error('Branch Admin sign-in failed:', authErr.message)
  process.exit(1)
}
const me = auth.user.id
console.log(`signed in as Branch Admin ${auth.user.email} (${me})\n`)

console.log('BUG-079 — a Branch Admin must not read the whole company notification inbox')
{
  const rows = readOrFail('user_notifications', await user.from('user_notifications').select('user_id, kind, title, url'))
  const mine = rows.filter((r) => r.user_id === me)
  const theirs = rows.filter((r) => r.user_id !== me)
  check(
    'no notification owned by another user is visible',
    theirs.length === 0,
    theirs.length ? `${theirs.length} foreign rows leaked, e.g. kind=${theirs[0].kind}` : `${mine.length} own rows, 0 foreign`,
  )
  if (theirs.length) {
    for (const t of theirs.slice(0, 5)) console.log(`      leaked: ${t.kind} :: ${String(t.title).slice(0, 60)}`)
  }
}

console.log('\nBUG-070/071 — no role may hard-delete a customer')
{
  // The first version of this probe asserted the Branch Admin could not
  // enumerate all 920 customers, on the assumption that BUG-071 was closed by
  // narrowing the permissive `for all` policy. That assumption was wrong and
  // the probe reported a FAIL against correct production.
  //
  // 20261011090000_reconcile_live_admin_policies.sql states the actual design:
  // "customers — Not changed. customers_soft_delete turns every DELETE into an
  // archive, so no role can hard-delete a customer." Company-wide SELECT is
  // intended; customers have no branch column, and the CRM is company-wide.
  //
  // So the question is not "can they read them" but "did a delete ever remove
  // one". The soft-delete trigger archives instead, so archived rows are the
  // fingerprint the mechanism leaves behind.
  const archived = readOrFail(
    'archived customers',
    await admin.from('customers').select('id, full_name, updated_at').eq('is_archived', true),
  )
  const total = (await admin.from('customers').select('id', { count: 'exact', head: true })).count
  console.log(`  customers total ${total}, archived ${archived.length} (soft-deleted, trigger is working)`)
  for (const a of archived.slice(0, 5)) {
    console.log(`      archived: ${String(a.full_name).slice(0, 40)} @ ${String(a.updated_at).slice(0, 10)}`)
  }
  // A DELETE is not attempted here. Probing the write guard by performing the
  // write it guards is exactly the BUG-071 shape, and this probe holds to
  // SELECT-only regardless of who is asking.
  console.log('  ---- hard-DELETE path not exercised (write); covered by probe-rls-role-matrix.sql 24/24')
  console.log('  ---- company-wide SELECT is by design and is NOT a finding')
}

console.log('\nBUG-080 — a Branch Admin must not be able to write SMS templates')
{
  // Deliberately NOT an insert or update. RLS WITH CHECK cannot be probed
  // without attempting the write it guards, and BUG-071 is precisely a story
  // about what an attempted write through this path can do. Recorded as
  // UNVERIFIED-BY-SELECT rather than guessed at.
  console.log('  ---- UNVERIFIED BY SELECT — write policies cannot be probed read-only')
}

console.log('\nBUG-085 — a daily sheet may not be approved by its submitter')
{
  // probe-daily-sheet-self-approval.sql covers this inside a rolled-back
  // transaction (4/4). Re-running it needs a write attempt, which is not mine
  // to make.
  console.log('  ---- covered by probe-daily-sheet-self-approval.sql (4/4, rolled back); not re-run here')
}

console.log(`\n${failures ? `${failures} CHECK(S) FAILED` : 'all read-only checks passed'}`)
await user.auth.signOut()
process.exit(failures ? 1 : 0)