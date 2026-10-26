import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  POS_SHELL_TABS,
  POS_SETTINGS_TAB,
  POS_WORKFLOW_STEPS,
  posVisibleShellTabs,
  resolvePosShellTab,
  summarizePendingHandoffs,
  summarizeTodayPos,
  waitMinutes,
  formatWaitMinutes,
} from '../src/lib/posInsights.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('posInsights', () => {
  it('summarizes pending handoffs with total minor', () => {
    const summary = summarizePendingHandoffs([
      { amount_minor: 50000, bookings: {} },
      { bookings: { final_price_minor: 25000 } },
    ])
    assert.equal(summary.count, 2)
    assert.equal(summary.totalMinor, 75000)
  })

  it('labels how long a car has waited to pay', () => {
    const now = Date.parse('2026-10-09T10:00:00Z')
    assert.equal(waitMinutes('2026-10-09T09:47:30Z', now), 12)
    assert.equal(waitMinutes('2026-10-09T10:05:00Z', now), 0)
    assert.equal(waitMinutes(null, now), null)
    assert.equal(waitMinutes('not a date', now), null)
    assert.deepEqual(
      [0, 12, 60, 65, 1440, 14646, null].map(formatWaitMinutes),
      ['Just now', '12 min', '1 h', '1 h 5 min', '1 day', '10 days', ''],
    )
  })

  it('summarizes today POS stats', () => {
    const stats = summarizeTodayPos({
      todayStats: { total_sales_minor: 100000, paid_count: 3, average_ticket_minor: 33333 },
      handoffs: [{ amount_minor: 20000, bookings: {} }],
      todayExpenses: [{ total_minor: 5000 }],
      expenseFilter: () => true,
    })
    assert.equal(stats.salesMinor, 100000)
    assert.equal(stats.paidCount, 3)
    assert.equal(stats.pendingCount, 1)
    assert.equal(stats.expenseMinor, 5000)
  })

  it('adds settings tab only when allowed', () => {
    assert.deepEqual(posVisibleShellTabs({ canSettings: false }), [...POS_SHELL_TABS])
    assert.equal(posVisibleShellTabs({ canSettings: true }).at(-1), POS_SETTINGS_TAB)
    assert.equal(resolvePosShellTab('settings', { canSettings: false }), 'checkout')
    assert.equal(resolvePosShellTab('settings', { canSettings: true }), 'settings')
  })

  it('sends old Pay queue links to the combined checkout page', () => {
    assert.equal(resolvePosShellTab('pending'), 'checkout')
    assert.equal(resolvePosShellTab(null), 'checkout')
  })

  it('sends old Expenses links to the Daily sheet, hidden for roles that cannot fill it', () => {
    assert.deepEqual([...POS_SHELL_TABS], ['checkout', 'sheet', 'history', 'dashboard', 'advances'])
    assert.equal(resolvePosShellTab('expenses'), 'sheet')
    assert.equal(resolvePosShellTab('sheet', { canSheet: false }), 'checkout')
    assert.equal(resolvePosShellTab('advances', { canSheet: false }), 'advances')
    assert.deepEqual(posVisibleShellTabs({ canSheet: false }), ['checkout', 'dashboard', 'advances'])
  })

  it('ships workflow guide steps', () => {
    assert.ok(POS_WORKFLOW_STEPS.length >= 4)
    assert.ok(POS_WORKFLOW_STEPS.some((s) => s.id === 'queue'))
  })
})

describe('POS redesign seams', () => {
  it('PosPage embeds settings tab, guide, Daily sheet and Today panels', () => {
    const pos = readFileSync(join(root, 'src/pages/PosPage.jsx'), 'utf8')
    assert.match(pos, /PosGuideCard/)
    assert.match(pos, /PosSettingsPanel/)
    assert.match(pos, /<DailySheetPanel/)
    assert.match(pos, /<PosTodayPanel/)
    assert.doesNotMatch(pos, /ShiftCloseWizard|End of shift|PosSalaryPreviewCard/)
    assert.match(pos, /POS_SETTINGS_TAB/)
    assert.match(pos, /OpsPageShell/)
    assert.match(pos, /hakum-pos/)
    assert.match(pos, /canWritePosSettings/)
  })

  it('Sell tab puts Waiting to pay and the catalogue first, Sales today below them', () => {
    const pos = readFileSync(join(root, 'src/pages/PosPage.jsx'), 'utf8')
    const count = (needle) => pos.split(needle).length - 1

    // The first version of this test compared three `indexOf` positions and
    // nothing else. Revert-proving it showed that was a fake guard: wrapping
    // the stats board in `{false && ...}` removes "Sales today" from the Sell
    // tab entirely — a user-visible regression — while every test stayed green,
    // because the JSX text never moved. String position is not rendering.
    //
    // So: each panel must appear exactly once (a second occurrence elsewhere in
    // the file means it has moved to another tab), and the stats board must not
    // sit behind a condition.
    assert.equal(count('<PosOpenTickets'), 1, 'Waiting to pay must render in exactly one place')
    assert.equal(count('<PosStatsBoard'), 1, 'Sales today must render in exactly one place')

    const tickets = pos.indexOf('<PosOpenTickets')
    const order = pos.indexOf('aria-label="Current order"')
    const stats = pos.indexOf('<PosStatsBoard')
    assert.ok(tickets > 0 && order > tickets && stats > order, 'tickets, then catalogue, then stats')

    const statsLine = pos.split(/\r?\n/).find((l) => l.includes('<PosStatsBoard')) || ''
    assert.ok(
      !/&&|\?/.test(statsLine),
      `Sales today must render unconditionally in the Sell tab, found: ${statsLine.trim()}`,
    )
  })

  it('PosSettingsPage delegates to shared panel', () => {
    const page = readFileSync(join(root, 'src/pages/settings/PosSettingsPage.jsx'), 'utf8')
    assert.match(page, /PosSettingsPanel/)
    assert.doesNotMatch(page, /from\('@\/lib\/supabase'\)/)
  })
})
