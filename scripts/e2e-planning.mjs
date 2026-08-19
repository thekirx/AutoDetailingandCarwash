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

const stamp = Date.now()
const { data: cat, error: catIns } = await boss
  .from('plan_categories')
  .insert({ name: `E2E cat ${stamp}`, color: '#052699', position: 99 })
  .select('id, name, color')
  .single()
assert(!catIns && cat?.id, `category insert: ${catIns?.message}`)
const { error: catUp } = await boss.from('plan_categories').update({ color: '#c4a35a' }).eq('id', cat.id)
assert(!catUp, `category update: ${catUp?.message}`)
const { data: catGot, error: catGet } = await boss.from('plan_categories').select('id, color').eq('id', cat.id).single()
assert(!catGet && catGot?.color === '#c4a35a', `category retrieve: ${catGet?.message || catGot?.color}`)
const { error: catOnCard } = await boss.from('plan_cards').update({ category_id: cat.id }).eq('id', card.id)
assert(!catOnCard, `card category: ${catOnCard?.message}`)
results.push('boss.category_crud: ok')

const { data: tmpBoard, error: tbErr } = await boss
  .from('plan_boards')
  .insert({ name: `E2E Planner ${stamp}` })
  .select('id, name')
  .single()
assert(!tbErr && tmpBoard?.id, `board insert: ${tbErr?.message}`)
const { error: seedListsErr } = await boss.from('plan_lists').insert([
  { board_id: tmpBoard.id, title: 'Upcoming', position: 0 },
  { board_id: tmpBoard.id, title: 'In Progress', position: 1 },
  { board_id: tmpBoard.id, title: 'Done', position: 2 },
  { board_id: tmpBoard.id, title: 'New', position: 3 },
])
assert(!seedListsErr, `list insert: ${seedListsErr?.message}`)
const { data: fetchedBoard, error: fetchBoardErr } = await boss
  .from('plan_boards')
  .select('id, name, plan_lists(id, title, position)')
  .eq('id', tmpBoard.id)
  .single()
assert(!fetchBoardErr && (fetchedBoard?.plan_lists || []).length === 4, `board retrieve: ${fetchBoardErr?.message}`)
const extra = fetchedBoard.plan_lists.find((l) => l.title === 'New')
assert(extra?.id, 'extra list missing')
const { error: listRename } = await boss.from('plan_lists').update({ title: 'Intake' }).eq('id', extra.id)
assert(!listRename, `list rename: ${listRename?.message}`)
const { data: renamed, error: renamedErr } = await boss.from('plan_lists').select('title').eq('id', extra.id).single()
assert(!renamedErr && renamed?.title === 'Intake', `list retrieve: ${renamedErr?.message}`)
const { error: listDel } = await boss.from('plan_lists').delete().eq('id', extra.id)
assert(!listDel, `list delete: ${listDel?.message}`)
results.push('boss.board_list_crud: ok')

const { data: tmpl, error: tmplIns } = await boss
  .from('plan_checklist_templates')
  .insert({ name: `E2E tmpl ${stamp}`, position: 0 })
  .select('id')
  .single()
assert(!tmplIns && tmpl?.id, `template insert: ${tmplIns?.message}`)
const { error: tmplItemErr } = await boss
  .from('plan_checklist_template_items')
  .insert({ template_id: tmpl.id, title: 'Wipe', position: 0 })
assert(!tmplItemErr, `template item: ${tmplItemErr?.message}`)
const { data: tmplGot, error: tmplGet } = await boss
  .from('plan_checklist_templates')
  .select('id, name, plan_checklist_template_items(id, title)')
  .eq('id', tmpl.id)
  .single()
assert(!tmplGet && tmplGot?.plan_checklist_template_items?.length === 1, `template retrieve: ${tmplGet?.message}`)
results.push('boss.template_crud: ok')

const crew = await asUser('staff1@hakumautocare.com', 'HakumStaff2026!')
const staffId = (await crew.auth.getUser()).data.user?.id
assert(staffId, 'staff1 session')
const { error: staffCatErr } = await crew.from('plan_categories').insert({
  name: `E2E staff cat ${stamp}`,
  color: '#052699',
  position: 0,
})
assert(staffCatErr, 'staff must not write categories')
await crew.auth.signOut()

const { error: assignErr } = await boss.from('plan_card_assignees').insert({
  card_id: card.id,
  staff_id: staffId,
  status: 'todo',
})
assert(!assignErr, `assign: ${assignErr?.message}`)

const crew2 = await asUser('staff1@hakumautocare.com', 'HakumStaff2026!')
const { data: mine, error: mineErr } = await crew2
  .from('plan_card_assignees')
  .select('id, status, plan_cards(id, title, list_id, plan_lists(id, title))')
  .eq('card_id', card.id)
  .maybeSingle()
assert(!mineErr && mine?.plan_cards?.id === card.id, `staff retrieve: ${mineErr?.message || 'missing'}`)
assert(mine.plan_cards.plan_lists?.title, 'staff nested list')
results.push('staff.retrieve_assigned: ok')
await crew2.auth.signOut()

await boss.auth.signOut()

const admin = await asUser('admin@hakumautocare.com', 'HakumAdmin2026!')
const { data: seen, error: readErr } = await admin.from('plan_cards').select('id, title').eq('id', card.id).maybeSingle()
assert(!readErr && seen?.id === card.id, `admin read: ${readErr?.message || 'missing'}`)
results.push('admin.read_card: ok')

const { error: adminUpErr } = await admin
  .from('plan_cards')
  .update({ title: `${title} (admin)` })
  .eq('id', card.id)
assert(!adminUpErr, `admin update: ${adminUpErr?.message}`)
results.push('admin.update_card: ok')

await admin.auth.signOut()

const boss2 = await asUser('bossmich@hakumautocare.com', 'HakumBoss2026!')
const { error: catNull } = await boss2.from('plan_categories').delete().eq('id', cat.id)
assert(!catNull, `category delete: ${catNull?.message}`)
const { data: cardAfterCat, error: cardAfterErr } = await boss2.from('plan_cards').select('category_id').eq('id', card.id).single()
assert(!cardAfterErr && cardAfterCat?.category_id == null, 'category delete sets card null')
const { error: tmplDel } = await boss2.from('plan_checklist_templates').delete().eq('id', tmpl.id)
assert(!tmplDel, `template delete: ${tmplDel?.message}`)
const { error: boardDel } = await boss2.from('plan_boards').delete().eq('id', tmpBoard.id)
assert(!boardDel, `board delete: ${boardDel?.message}`)
const { error: cleanErr } = await boss2.from('plan_cards').delete().eq('id', card.id)
assert(!cleanErr, `cleanup: ${cleanErr?.message}`)
results.push('boss.cleanup: ok')
await boss2.auth.signOut()

console.log(results.map((r) => `✔ ${r}`).join('\n'))
console.log('e2e-planning: ok')
