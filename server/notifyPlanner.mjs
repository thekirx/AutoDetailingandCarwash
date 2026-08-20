/**
 * Planner assign — inbox + web push to the people on the card.
 */
import { createClient } from '@supabase/supabase-js'
import { buildPlannerAssignNotify } from '../src/lib/plannerTasks.js'
import { sendWebPushToUsers } from './webPush.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function writeInbox(db, userIds, copy) {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  if (!ids.length) return { inserted: 0 }
  const rows = ids.map((user_id) => ({
    user_id,
    kind: copy.kind,
    title: copy.title,
    body: copy.body,
    url: copy.url,
    tag: copy.tag,
  }))
  const { error } = await db.from('user_notifications').insert(rows)
  return error ? { error: error.message } : { inserted: rows.length }
}

export async function notifyPlannerAssignees({ cardId, userIds, title } = {}) {
  const copy = buildPlannerAssignNotify({ title, cardId })
  const requested = [...new Set((userIds || []).filter(Boolean))]
  if (!cardId || !requested.length) {
    return { skipped: true, reason: 'no_targets', copy }
  }

  const db = admin()
  const { data: assignees, error } = await db
    .from('plan_card_assignees')
    .select('staff_id')
    .eq('card_id', cardId)
    .in('staff_id', requested)
  if (error) return { error: error.message, copy }

  const ids = [...new Set((assignees || []).map((row) => row.staff_id).filter(Boolean))]
  const result = { targets: ids.length, inbox: null, push: null, copy }
  if (!ids.length) {
    result.skipped = true
    result.reason = 'not_assignees'
    return result
  }

  result.inbox = await writeInbox(db, ids, copy)
  try {
    result.push = await sendWebPushToUsers({
      userIds: ids,
      title: copy.title,
      body: copy.body,
      url: copy.url,
      tag: copy.tag,
      kind: copy.kind,
    })
  } catch (err) {
    result.push = { error: String(err.message || err) }
  }
  return result
}
