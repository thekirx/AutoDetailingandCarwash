/**
 * POS register → Super Admin / ASA / branch-admin inbox + push.
 */
import { createClient } from '@supabase/supabase-js'
import { resolveComplaintNotifyUserIds } from './notifyOpsForm.mjs'
import { sendWebPushToUsers } from './webPush.mjs'

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
  status = '',
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
  if (event === 'cash_advance') {
    const approved = String(status || '') === 'resolved'
    return {
      kind: 'pos_cash_advance',
      title: approved ? 'Cash advance approved' : 'Cash advance declined',
      body: `${title || 'Employee'} · ${money} @ ${site}`,
      url: '/operations/pos?tab=cash-advance',
      tag: `pos-ca-${id}`,
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

export async function notifyPosEvent(input = {}) {
  const copy = buildPosNotifyCopy(input)
  const db = admin()
  const branch = String(input.branch || '').trim().toLowerCase() || null
  const userIds = await resolveComplaintNotifyUserIds(db, branch)
  const inbox = await writeInbox(db, userIds, copy)
  let push = { sent: 0 }
  if (userIds.length) {
    try {
      push = await sendWebPushToUsers({
        userIds,
        title: copy.title,
        body: copy.body,
        url: copy.url,
        tag: copy.tag,
        kind: copy.kind,
      })
    } catch (err) {
      push = { error: String(err.message || err) }
    }
  }
  return { targets: userIds.length, inbox, push, copy }
}
