import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  defaultWeekHours,
  formatHoursSummary,
  isOpenNow,
  manilaParts,
  normalizeTimeInput,
  normalizeWeekHours,
  openNowLabel,
  validateWeekHours,
} from '../src/lib/branchOperatingHours.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('branch operating hours', () => {
  it('normalizes a full week and rejects close-before-open', () => {
    const week = normalizeWeekHours(
      [{ day_of_week: 1, opens_at: '09:00:00', closes_at: '17:00', is_closed: false }],
      'bacoor',
    )
    assert.equal(week.length, 7)
    assert.equal(week[1].opens_at, '09:00')
    assert.equal(week[0].opens_at, '08:00')
    assert.equal(normalizeTimeInput('8:00'), null)
    assert.equal(validateWeekHours([{ is_closed: false, opens_at: '18:00', closes_at: '09:00' }]), 'Close time must be after open time (same day).')
  })

  it('summarizes daily and mixed weeks', () => {
    assert.equal(formatHoursSummary(defaultWeekHours('bacoor')), 'Daily 8 AM–6 PM')
    const mixed = defaultWeekHours('bacoor').map((row) =>
      row.day_of_week === 0 ? { ...row, is_closed: true, opens_at: null, closes_at: null } : row,
    )
    assert.match(formatHoursSummary(mixed), /closed/i)
  })

  it('open-now uses Asia/Manila weekday + clock', () => {
    const { dayOfWeek, hhmm } = manilaParts(new Date('2026-08-20T04:00:00.000Z')) // Thu 12:00 PHT
    assert.equal(dayOfWeek, 4)
    assert.equal(hhmm, '12:00')
    const week = defaultWeekHours('bacoor')
    assert.equal(isOpenNow(week, new Date('2026-08-20T04:00:00.000Z')), true)
    assert.equal(isOpenNow(week, new Date('2026-08-20T12:00:00.000Z')), false) // 20:00 PHT
    assert.equal(openNowLabel(week, new Date('2026-08-20T04:00:00.000Z')), 'Open now')
  })

  it('migration creates table + RLS; Branches page shows live hours', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260820170000_branch_operating_hours_table.sql'),
      'utf8',
    )
    assert.match(sql, /create table if not exists public\.branch_operating_hours/)
    assert.match(sql, /Anyone can read branch hours/)
    assert.match(sql, /asa_has_grant\('branches'\)/)

    const admin = readFileSync(join(root, 'src/lib/adminApi.js'), 'utf8')
    assert.match(admin, /saveBranchOperatingHours/)
    assert.match(admin, /listBranchOperatingHours/)

    const manage = readFileSync(join(root, 'src/pages/BranchesManagePage.jsx'), 'utf8')
    assert.match(manage, /Operating hours/)
    assert.match(manage, /saveBranchOperatingHours/)

    const pub = readFileSync(join(root, 'src/pages/PublicPages.jsx'), 'utf8')
    assert.match(pub, /formatHoursSummary/)
    assert.match(pub, /branch_operating_hours|fetchPublicBranchHours|hoursBySlug/)
  })
})
