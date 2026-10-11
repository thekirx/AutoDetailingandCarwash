/** POS dashboard helpers — stats, pending queue, plain-language workflow copy. */

// Pay queue lives on the checkout page; a legacy ?tab=pending link resolves there.
export const POS_SHELL_TABS = Object.freeze(['checkout', 'sheet', 'history', 'dashboard'])
export const POS_SETTINGS_TAB = 'settings'
const LEGACY_POS_TABS = Object.freeze({ expenses: 'sheet' })

/** View-only POS (investor): today's numbers + Daily Sheet history. */
export const POS_READ_ONLY_TABS = Object.freeze(['dashboard', 'history'])

/** Tabs shown in the shell; Daily sheet / settings only for roles that can use them. */
export function posVisibleShellTabs({ canSettings = false, canSheet = true, readOnly = false } = {}) {
  if (readOnly) return [...POS_READ_ONLY_TABS]
  const tabs = POS_SHELL_TABS.filter((t) => canSheet || (t !== 'sheet' && t !== 'history'))
  return canSettings ? [...tabs, POS_SETTINGS_TAB] : tabs
}

export function resolvePosShellTab(tabParam, { canSettings = false, canSheet = true, readOnly = false } = {}) {
  const allowed = posVisibleShellTabs({ canSettings, canSheet, readOnly })
  const tab = LEGACY_POS_TABS[tabParam] || tabParam
  return allowed.includes(tab) ? tab : allowed[0]
}

/** Queue ticket label shown on the counter, e.g. Q-007. */
export function formatQueueTicket(booking) {
  return booking?.queue_number != null ? `Q-${String(booking.queue_number).padStart(3, '0')}` : 'Queue'
}

/** Minutes a car has waited to pay before its ticket is flagged on the counter. */
export const POS_LONG_WAIT_MIN = 20

/** Whole minutes since a ticket was sent to pay, or null when the time is missing. */
export function waitMinutes(createdAt, now = Date.now()) {
  const ms = now - new Date(createdAt).getTime()
  return createdAt && Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 60000)) : null
}

/** "Just now", "12 min", "1 h 5 min", "3 days". */
export function formatWaitMinutes(min) {
  if (min == null) return ''
  if (min < 1) return 'Just now'
  if (min < 60) return `${min} min`
  if (min >= 1440) {
    const d = Math.floor(min / 1440)
    return `${d} ${d === 1 ? 'day' : 'days'}`
  }
  const h = Math.floor(min / 60)
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`
}

/** Pending handoffs waiting for payment. */
export function summarizePendingHandoffs(handoffs = []) {
  const rows = handoffs || []
  const count = rows.length
  const totalMinor = rows.reduce((sum, row) => {
    const booking = row.bookings || {}
    return sum + Number(row.amount_minor ?? booking.final_price_minor ?? booking.price_minor ?? 0)
  }, 0)
  return { count, totalMinor }
}

/** Today strip for hero tiles. */
export function summarizeTodayPos({
  todayStats = null,
  handoffs = [],
  todayExpenses = [],
  expenseFilter = () => true,
} = {}) {
  const pending = summarizePendingHandoffs(handoffs)
  const expenseMinor = (todayExpenses || []).filter(expenseFilter).reduce(
    (sum, row) => sum + Number(row.total_minor || 0),
    0,
  )
  return {
    salesMinor: Number(todayStats?.total_sales_minor || 0),
    paidCount: Number(todayStats?.paid_count ?? 0),
    pendingCount: pending.count,
    pendingMinor: pending.totalMinor,
    avgTicketMinor: Number(todayStats?.average_ticket_minor || 0),
    expenseMinor,
  }
}

/** Non-technical workflow steps shown in the POS guide. */
export const POS_WORKFLOW_STEPS = Object.freeze([
  {
    id: 'sell',
    title: 'Sell',
    body: 'Tap merch or coffee to ring it up. Link a customer if you have their phone, then take payment.',
  },
  {
    id: 'queue',
    title: 'Waiting to pay',
    body: 'Cars the floor sends to pay line up above the catalogue. Tap one to open its ticket, add any merch the customer wants, and charge it all together.',
  },
  {
    id: 'sheet',
    title: 'Daily sheet',
    body: 'Through the day, add expenses and cash advances on the Daily sheet. Crew pay is suggested from attendance and sales.',
  },
  {
    id: 'close',
    title: 'Submit for approval',
    body: 'Count the drawer and submit the sheet. Pay the crew only after the owner approves.',
  },
])
