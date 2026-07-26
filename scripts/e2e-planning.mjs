/**
 * Live planning board smoke: Super Admin CRUD, Admin read-only.
 * Usage: node scripts/e2e-planning.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'

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
const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
assert(url && anon, 'missing supabase env')

const results = []

async function asUser(email, password) {
  const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  assert(!error && data.session, `${email}: ${error?.message || 'no session'}`)
  return client
}

const boss = await asUser('bossmich@hakumautocare.com', 'HakumBoss2026!')
const { data: board, error: boardErr } = await boss
  .from('plan_boards')
  .select('id, name, plan_lists(id, title, position)')
  .limit(1)
  .maybeSingle()
assert(!boardErr && board?.id, `board: ${boardErr?.message || 'missing'}`)
assert((board.plan_lists || []).length >= 3, 'seed lists')
results.push(`board: ${board.name} lists=${board.plan_lists.length}`)

const listId = [...board.plan_lists].sort((a, b) => a.position - b.position)[0].id
const title = `E2E card ${Date.now()}`
const { data: card, error: cardErr } = await boss
  .from('plan_cards')
  .insert({
    list_id: listId,
    title,
    labels: [{ name: 'Ops', color: '#38bdf8' }],
    due_at: new Date(Date.now() + 86400000).toISOString(),
  })
  .select('id, title, labels')
  .single()
assert(!cardErr && card?.id, `insert card: ${cardErr?.message}`)
results.push('boss.insert_card: ok')

const { error: checkErr } = await boss.from('plan_checklist_items').insert({
  card_id: card.id,
  title: 'Ship it',
  position: 0,
})
assert(!checkErr, `checklist: ${checkErr?.message}`)
results.push('boss.checklist: ok')

const target = [...board.plan_lists].sort((a, b) => a.position - b.position)[1].id
const { error: moveErr } = await boss.from('plan_cards').update({ list_id: target }).eq('id', card.id)
assert(!moveErr, `move: ${moveErr?.message}`)
results.push('boss.move_card: ok')

await boss.auth.signOut()

const admin = await asUser('admin@hakumautocare.com', 'HakumAdmin2026!')
const { data: seen, error: readErr } = await admin.from('plan_cards').select('id, title').eq('id', card.id).maybeSingle()
assert(!readErr && seen?.id === card.id, `admin read: ${readErr?.message || 'missing'}`)
results.push('admin.read_card: ok')

const { data: hacked, error: denyErr } = await admin
  .from('plan_cards')
  .update({ title: 'HACK' })
  .eq('id', card.id)
  .select('id')
assert(!denyErr, `admin update transport: ${denyErr?.message}`)
assert(!hacked?.length, 'admin update must affect 0 rows (RLS)')
results.push('admin.write_denied: ok')

const { data: deleted, error: denyDel } = await admin.from('plan_cards').delete().eq('id', card.id).select('id')
assert(!denyDel, `admin delete transport: ${denyDel?.message}`)
assert(!deleted?.length, 'admin delete must affect 0 rows (RLS)')
results.push('admin.delete_denied: ok')

const { data: stillThere } = await admin.from('plan_cards').select('title').eq('id', card.id).maybeSingle()
assert(stillThere?.title === title, 'card title unchanged after admin write attempts')
results.push('admin.write_noop: ok')

await admin.auth.signOut()

const boss2 = await asUser('bossmich@hakumautocare.com', 'HakumBoss2026!')
const { error: cleanErr } = await boss2.from('plan_cards').delete().eq('id', card.id)
assert(!cleanErr, `cleanup: ${cleanErr?.message}`)
results.push('boss.cleanup: ok')
await boss2.auth.signOut()

console.log(results.map((r) => `✔ ${r}`).join('\n'))
console.log('e2e-planning: ok')
