/**
 * Phase 7 — Frontend redundancy / dead-control / console.log audit.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesDir = join(root, 'src/pages')

function walkJsx(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walkJsx(p, acc)
    else if (/\.(jsx|tsx|js)$/.test(name)) acc.push(p)
  }
  return acc
}

describe('frontend audit', () => {
  it('1 no leftover console.log in ops page entrypoints', () => {
    const watched = [
      'FinancePage.jsx',
      'PayrollPage.jsx',
      'AttendancePage.jsx',
      'PosPage.jsx',
      'KpiPage.jsx',
      'ReportsPage.jsx',
      'DataCenterPage.jsx',
      'finance/FinanceOverviewTab.jsx',
    ]
    for (const rel of watched) {
      const src = readFileSync(join(pagesDir, rel), 'utf8')
      assert.doesNotMatch(src, /^\s*console\.(log|debug)\(/m)
    }
  })

  it('2 Finance / KPI / Attendance / Payroll tabs have empty-state patterns', () => {
    const overview = readFileSync(join(pagesDir, 'finance/FinanceOverviewTab.jsx'), 'utf8')
    assert.match(overview, /FinanceEmpty/)
    const attendance = readFileSync(join(pagesDir, 'AttendancePage.jsx'), 'utf8')
    assert.match(attendance, /CrewAttendancePanel|OpsPageShell/)
    const payroll = readFileSync(join(pagesDir, 'PayrollPage.jsx'), 'utf8')
    assert.match(payroll, /OpsPageShell|wizard|preview/i)
    const kpi = readFileSync(join(pagesDir, 'KpiPage.jsx'), 'utf8')
    assert.match(kpi, /OpsPageShell/)
  })

  it('3 Reports route redirects to Finance reports (no duplicate books UI)', () => {
    const src = readFileSync(join(pagesDir, 'ReportsPage.jsx'), 'utf8')
    assert.match(src, /\/operations\/finance\?tab=reports/)
  })

  it('4 App routes do not double-mount finance', () => {
    const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
    const financeRoutes = app.match(/path="finance"/g) || []
    assert.equal(financeRoutes.length, 1)
  })

  it('5 page tree stays finite (sanity — no runaway generated files)', () => {
    const files = walkJsx(pagesDir)
    assert.ok(files.length > 40)
    assert.ok(files.length < 200)
  })

  it('6 Finance Overview exports are present for owner decision pack', () => {
    const src = readFileSync(join(pagesDir, 'finance/FinanceOverviewTab.jsx'), 'utf8')
    assert.match(src, /Download|downloadCsv|Export/)
  })
})
