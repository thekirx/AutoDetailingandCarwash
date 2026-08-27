/** POS dashboard helpers — stats, pending queue, plain-language workflow copy. */

export const POS_SHELL_TABS = Object.freeze(['checkout', 'pending', 'expenses', 'dashboard'])
export const POS_SETTINGS_TAB = 'settings'

/** Tabs shown in the shell; settings only when caller has settings access. */
export function posVisibleShellTabs({ canSettings = false } = {}) {
  return canSettings ? [...POS_SHELL_TABS, POS_SETTINGS_TAB] : [...POS_SHELL_TABS]
}

export function resolvePosShellTab(tabParam, { canSettings = false } = {}) {
  const allowed = posVisibleShellTabs({ canSettings })
  return allowed.includes(tabParam) ? tabParam : 'checkout'
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
    body: 'Pick services or merch, add to cart, link the customer if you have their phone, then take payment.',
  },
  {
    id: 'queue',
    title: 'Pay queue',
    body: 'When the floor sends a car to pay, it appears in Pay queue. Open the ticket, confirm the amount, and complete payment.',
  },
  {
    id: 'expenses',
    title: 'Expenses',
    body: 'Record petty cash and supplies under Expenses. Salary-related kinds feed end-of-shift and Payroll review.',
  },
  {
    id: 'close',
    title: 'End of shift',
    body: 'Count cash and payment totals, submit end of shift. Finance reviews, then Payroll uses attendance + today sales for crew pay.',
  },
])

/** Wash-pool preview from car-wash sales + attendance weights. */
export function buildPosWashPoolPreview({
  carWashMinor = 0,
  washPoolPct = 0,
  attendanceRows = [],
  rules = {},
} = {}) {
  const pct = Number(washPoolPct) || Number(rules?.wash_pool_pct) || 0
  const poolMinor = Math.round((Number(carWashMinor) || 0) * (pct / 100))
  const onSite = (attendanceRows || []).filter((row) => row.status === 'present' || row.status === 'late')
  return {
    carWashMinor: Number(carWashMinor) || 0,
    washPoolPct: pct,
    poolMinor,
    onSiteCount: onSite.length,
    presentCount: onSite.filter((r) => r.status === 'present').length,
    lateCount: onSite.filter((r) => r.status === 'late').length,
  }
}
