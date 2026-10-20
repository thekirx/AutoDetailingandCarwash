import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { staffBirthdayTag } from '../server/staffBirthdayGreetings.mjs'

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
})
