/**
 * Planner assign — inbox + web push to the people on the card.
 */
import { createClient } from '@supabase/supabase-js'
import { NOTIFY_EVENTS } from '../src/lib/notifyRouting.js'
import { buildPlannerAssignNotify } from '../src/lib/plannerTasks.js'
import { notifyRecipients, resolveStaffRecipients } from './webPush.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
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
  if (!ids.length) return { targets: 0, skipped: true, reason: 'not_assignees', copy }

  const recipients = await resolveStaffRecipients(db, { ...NOTIFY_EVENTS.planner_task, ids })
  return { ...(await notifyRecipients(db, recipients, copy)), copy }
}
