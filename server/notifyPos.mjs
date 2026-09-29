/**
 * POS register → Super Admin / ASA / branch-admin inbox + push.
 */
import { createClient } from '@supabase/supabase-js'
import { NOTIFY_EVENTS } from '../src/lib/notifyRouting.js'
import { notifyRecipients, resolveStaffRecipients } from './webPush.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function buildPosNotifyCopy({
  event,
  branch = '',
  amountMinor = 0,
  title = '',
  entityId = '',
} = {}) {
  const site = String(branch || 'unspecified').trim() || 'unspecified'
  const pesos = Math.round((Number(amountMinor) || 0) / 100)
  const money = `₱${pesos.toLocaleString('en-PH')}`
  const id = String(entityId || Date.now())
  if (event === 'expense') {
    return {
      kind: 'pos_expense',
      title: 'POS expense',
      body: `${title || 'Expense'} · ${money} @ ${site}`,
      url: '/operations/pos?tab=expenses',
      tag: `pos-expense-${id}`,
    }
  }
  return {
    kind: 'pos_sale',
    title: 'POS sale',
    body: `Walk-in ${money} @ ${site}`,
    url: '/operations/pos',
    tag: `pos-sale-${id}`,
  }
}

export async function notifyPosEvent(input = {}) {
  const copy = buildPosNotifyCopy(input)
  const db = admin()
  const branch = String(input.branch || '').trim().toLowerCase() || null
  const recipients = await resolveStaffRecipients(db, { ...NOTIFY_EVENTS.pos, branch, excludeId: input.actorId || null })
  const deepLinked = recipients.map((r) => ({ ...r, url: copy.url }))
  return { ...(await notifyRecipients(db, deepLinked, copy)), copy }
}
