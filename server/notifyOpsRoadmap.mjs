/**
 * Ops Lab activity → inbox + web push for SA / ASA / BA / Operations Lead.
 */
import { createClient } from '@supabase/supabase-js'
import { NOTIFY_EVENTS } from '../src/lib/notifyRouting.js'
import { notifyRecipients, resolveStaffRecipients } from './webPush.mjs'
import { buildOpsLabNotifyCopy } from '../src/lib/opsRoadmap.js'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function notifyOpsLabActivity(input = {}) {
  const copy = buildOpsLabNotifyCopy(input)
  const db = admin()
  const recipients = await resolveStaffRecipients(db, { ...NOTIFY_EVENTS.ops_lab, excludeId: input.actorId || null })
  const deepLinked = recipients.map((r) => ({ ...r, url: copy.url }))
  return { ...(await notifyRecipients(db, deepLinked, copy)), copy }
}
