/**
 * Part 4: crew username + plan_card_assignees smoke.
 * node scripts/e2e-part4-crew-tasks.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { validateCrewUsername } from '../src/queue/queueLogic.js'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1)
    if (!process.env[k]) process.env[k] = v
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && service, 'missing supabase env')
const results = []

assert(validateCrewUsername('crew.lead') === 'crew.lead')
results.push('helpers.username: ok')

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

const { error: colErr } = await admin.from('staff_profiles').select('id, username').limit(1)
assert(!colErr, `username column: ${colErr?.message}`)
results.push('db.staff_profiles.username: ok')

const { error: assignErr } = await admin
  .from('plan_card_assignees')
  .select('id, card_id, staff_id, status')
  .limit(1)
assert(!assignErr, `plan_card_assignees: ${assignErr?.message}`)
results.push('db.plan_card_assignees: ok')

const { data: card } = await admin.from('plan_cards').select('id').limit(1).maybeSingle()
const { data: staff } = await admin.from('staff_profiles').select('id').eq('is_active', true).limit(1).maybeSingle()
if (card?.id && staff?.id) {
  const { data: row, error: insErr } = await admin
    .from('plan_card_assignees')
    .upsert(
      { card_id: card.id, staff_id: staff.id, status: 'todo', notes: 'part4-smoke' },
      { onConflict: 'card_id,staff_id' },
    )
    .select('id, status')
    .maybeSingle()
  assert(!insErr, `assign upsert: ${insErr?.message}`)
  assert(row?.id, 'assign row missing')
  await admin.from('plan_card_assignees').delete().eq('id', row.id)
  results.push('db.assign_roundtrip: ok')
} else {
  results.push('db.assign_roundtrip: skipped (no card/staff)')
}

console.log(results.join('\n'))
console.log('e2e-part4-crew-tasks: PASS')
