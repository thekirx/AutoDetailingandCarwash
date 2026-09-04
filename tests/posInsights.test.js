import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  POS_SHELL_TABS,
  POS_SETTINGS_TAB,
  POS_WORKFLOW_STEPS,
  buildPosWashPoolPreview,
  posVisibleShellTabs,
  resolvePosShellTab,
  summarizePendingHandoffs,
  summarizeTodayPos,
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

  it('builds wash pool preview from car-wash sales and attendance', () => {
    const preview = buildPosWashPoolPreview({
      carWashMinor: 100000,
      washPoolPct: 35,
      attendanceRows: [{ status: 'present' }, { status: 'late' }],
    })
    assert.equal(preview.poolMinor, 35000)
    assert.equal(preview.onSiteCount, 2)
    assert.equal(preview.presentCount, 1)
    assert.equal(preview.lateCount, 1)
  })

  it('ships workflow guide steps', () => {
    assert.ok(POS_WORKFLOW_STEPS.length >= 4)
    assert.ok(POS_WORKFLOW_STEPS.some((s) => s.id === 'queue'))
  })
})

describe('POS redesign seams', () => {
  it('PosPage embeds settings tab, guide, and salary preview', () => {
    const pos = readFileSync(join(root, 'src/pages/PosPage.jsx'), 'utf8')
    assert.match(pos, /PosGuideCard/)
    assert.match(pos, /PosSettingsPanel/)
    assert.match(pos, /PosSalaryPreviewCard/)
    assert.match(pos, /POS_SETTINGS_TAB/)
    assert.match(pos, /OpsPageShell/)
    assert.match(pos, /hakum-pos/)
    assert.match(pos, /settings\/pos/)
  })

  it('PosSettingsPage delegates to shared panel', () => {
    const page = readFileSync(join(root, 'src/pages/settings/PosSettingsPage.jsx'), 'utf8')
    assert.match(page, /PosSettingsPanel/)
    assert.doesNotMatch(page, /from\('@\/lib\/supabase'\)/)
  })
})
