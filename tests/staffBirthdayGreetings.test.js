import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { listStaffBirthdaysToday, staffBirthdayTag } from '../server/staffBirthdayGreetings.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('staff birthday greetings', () => {
  it('uses a stable yearly tag and never SMS', () => {
    assert.equal(staffBirthdayTag('abc', 2026), 'staff-birthday-abc-2026')
    const src = readFileSync(join(root, 'server/staffBirthdayGreetings.mjs'), 'utf8')
    assert.match(src, /inbox_push_only|inbox \+ web push/i)
    assert.doesNotMatch(src, /busybeeSendSms|sendSms/)
    const api = readFileSync(join(root, 'server/birthdayGreetingsApi.mjs'), 'utf8')
    assert.match(api, /runStaffBirthdayGreetings/)
  })

  it('queries valid staff_profiles columns (never nonexistent home_branch)', async () => {
    const selectedCols = []
    const db = {
      from(table) {
        assert.equal(table, 'staff_profiles')
        return {
          select(cols) {
            selectedCols.push(cols)
            return this
          },
          eq() {
            return this
          },
          not() {
            return Promise.resolve({
              data: [{ id: 'st-1', full_name: 'Ana Cruz', date_of_birth: '1995-11-24', is_active: true, branch_slug: 'bacoor' }],
              error: null,
            })
          },
        }
      },
    }
    const res = await listStaffBirthdaysToday(db, new Date('2026-11-24T04:00:00.000Z'))
    assert.equal(selectedCols.length, 1)
    assert.doesNotMatch(selectedCols[0], /home_branch/)
    assert.match(selectedCols[0], /branch_slug/)
    assert.equal(res.staff.length, 1)
    assert.equal(res.staff[0].id, 'st-1')
  })
})
