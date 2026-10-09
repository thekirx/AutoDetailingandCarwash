import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  filterSheets,
  groupSheetsByPeriod,
  sheetChecklist,
  sheetHistoryRange,
  sheetPeriodLabel,
  weekStart,
} from '../src/lib/dailySheet.js'
import { posVisibleShellTabs, resolvePosShellTab } from '../src/lib/posInsights.js'

const sheet = (business_date, status, net, profit, gap = 0) => ({
  id: business_date,
  business_date,
  status,
  branch: 'bacoor',
  totals: { netMinor: net, netProfitMinor: profit, expensesMinor: 100, salariesMinor: 200, overShortMinor: gap },
})

describe('Daily Sheet history', () => {
  it('weeks start on Monday (Oct 9 2026 is a Friday)', () => {
    assert.equal(weekStart('2026-10-09'), '2026-10-05')
    assert.equal(weekStart('2026-10-05'), '2026-10-05')
    assert.equal(weekStart('2026-10-11'), '2026-10-05')
    assert.equal(weekStart('2026-10-12'), '2026-10-12')
  })

  it('groups into weeks and months, newest first, with totals and status counts', () => {
    const rows = [sheet('2026-10-02', 'approved', 1000, 700), sheet('2026-10-06', 'approved', 2000, 1500, -50), sheet('2026-10-09', 'submitted', 500, 300), sheet('2026-09-30', 'approved', 100, 50)]
    const weeks = groupSheetsByPeriod(rows, 'week')
    assert.deepEqual(weeks.map((w) => w.key), ['2026-10-05', '2026-09-28'])
    assert.equal(weeks[0].count, 2)
    assert.equal(weeks[1].count, 2, 'Oct 2 (Fri) belongs to the week of Sep 28')
    assert.equal(weeks[0].netMinor, 2500)
    assert.equal(weeks[0].overShortMinor, -50)
    assert.equal(weeks[0].pending, 1)
    assert.equal(weeks[0].approved, 1)
    assert.deepEqual(weeks[0].rows.map((r) => r.business_date), ['2026-10-09', '2026-10-06'])
    const months = groupSheetsByPeriod(rows, 'month')
    assert.deepEqual(months.map((m) => m.key), ['2026-10', '2026-09'])
    assert.equal(months[0].count, 3)
    assert.equal(groupSheetsByPeriod(rows, 'day').length, 4)
    assert.deepEqual(groupSheetsByPeriod([], 'week'), [])
  })

  it('quick presets end today', () => {
    assert.deepEqual(sheetHistoryRange('week', '2026-10-09'), { from: '2026-10-05', to: '2026-10-09' })
    assert.deepEqual(sheetHistoryRange('month', '2026-10-09'), { from: '2026-10-01', to: '2026-10-09' })
    assert.deepEqual(sheetHistoryRange('last30', '2026-10-09'), { from: '2026-09-10', to: '2026-10-09' })
    assert.deepEqual(sheetHistoryRange('last90', '2026-10-09'), { from: '2026-07-12', to: '2026-10-09' })
  })

  it('labels periods for people', () => {
    assert.match(sheetPeriodLabel('2026-10-05', 'week'), /Oct 5 – Oct 11, 2026/)
    assert.equal(sheetPeriodLabel('2026-10', 'month'), 'October 2026')
    assert.match(sheetPeriodLabel('2026-10-09', 'day'), /Friday/)
  })

  it('searches by ISO date, spoken date or weekday', () => {
    const rows = [sheet('2026-10-09', 'approved', 1, 1), sheet('2026-10-08', 'approved', 1, 1)]
    assert.deepEqual(filterSheets(rows, { search: '2026-10-09' }).map((r) => r.id), ['2026-10-09'])
    assert.deepEqual(filterSheets(rows, { search: 'oct 9' }).map((r) => r.id), ['2026-10-09'])
    assert.deepEqual(filterSheets(rows, { search: 'thursday' }).map((r) => r.id), ['2026-10-08'])
    assert.equal(filterSheets(rows, { search: 'nope' }).length, 0)
  })

  it('cash advances are optional: a sheet with none can submit once float and count are in', () => {
    const c = sheetChecklist({ sheet: { opening_float_minor: 100000, counted_cash_minor: 100000 }, lines: [], sales: [] })
    assert.equal(c.canSubmit, true)
    assert.deepEqual(c.missing, [])
    const half = sheetChecklist({ sheet: { opening_float_minor: 100000, counted_cash_minor: 100000 }, lines: [{ kind: 'ca_release', amount_minor: 5000 }], sales: [] })
    assert.equal(half.canSubmit, false, 'a started cash advance still needs its staff member')
  })

  it('History tab shows with the Daily sheet tab and hides with it', () => {
    assert.deepEqual(posVisibleShellTabs({ canSheet: true }), ['checkout', 'sheet', 'history', 'dashboard'])
    assert.deepEqual(posVisibleShellTabs({ canSheet: false }), ['checkout', 'dashboard'])
    assert.equal(resolvePosShellTab('history', { canSheet: true }), 'history')
    assert.equal(resolvePosShellTab('history', { canSheet: false }), 'checkout')
  })

  it('read-only POS (investor) shows Today + Sheet history and never checkout or the sheet editor', () => {
    assert.deepEqual(posVisibleShellTabs({ readOnly: true }), ['dashboard', 'history'])
    assert.equal(resolvePosShellTab(null, { readOnly: true }), 'dashboard')
    assert.equal(resolvePosShellTab('checkout', { readOnly: true }), 'dashboard')
    assert.equal(resolvePosShellTab('sheet', { readOnly: true }), 'dashboard')
    assert.equal(resolvePosShellTab('settings', { readOnly: true, canSettings: true }), 'dashboard')
    assert.equal(resolvePosShellTab('history', { readOnly: true }), 'history')
  })
})
