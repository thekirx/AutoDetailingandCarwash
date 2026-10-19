import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  birthdaysInMonth,
  formatStaffBirthdayMd,
  staffBirthdaysToday,
  staffNeedsBirthday,
} from '../src/lib/staffBirthday.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('staff birthdays', () => {
  it('filters month board and today list', () => {
    const people = [
      { id: '1', full_name: 'Ana', date_of_birth: '1990-10-05' },
      { id: '2', full_name: 'Ben', date_of_birth: '1992-03-12' },
      { id: '3', full_name: 'Cara', date_of_birth: '1988-10-19' },
    ]
    const oct = birthdaysInMonth(people, { month: 10, todayKey: '2026-10-19' })
    assert.equal(oct.length, 2)
    assert.equal(oct[0].full_name, 'Ana')
    assert.equal(formatStaffBirthdayMd('1990-10-05'), '10-05')
    assert.equal(staffNeedsBirthday({ id: 'x' }), true)
    assert.equal(staffNeedsBirthday({ id: 'x', date_of_birth: '1990-01-01' }), false)
    const today = staffBirthdaysToday(people, new Date('2026-10-19T12:00:00+08:00'))
    assert.equal(today.some((r) => r.full_name === 'Cara'), true)
  })

  it('ships migration, settings save, and Attendance month board', () => {
    const migration = readFileSync(join(root, 'supabase/migrations/20261019130000_staff_birthday.sql'), 'utf8')
    const modal = readFileSync(join(root, 'src/components/UserSettingsModal.jsx'), 'utf8')
    const panel = readFileSync(join(root, 'src/pages/crew/CrewAttendancePanels.jsx'), 'utf8')
    const auth = readFileSync(join(root, 'src/auth/AuthProvider.jsx'), 'utf8')
    assert.match(migration, /date_of_birth/)
    assert.match(migration, /save_own_staff_birthday/)
    assert.match(migration, /staff_birthdays_month/)
    assert.match(modal, /save_own_staff_birthday/)
    assert.match(panel, /Birthdays this month/)
    assert.match(auth, /date_of_birth/)
  })
})
