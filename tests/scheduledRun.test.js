import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { cronAuthorized } from '../server/scheduledRun.mjs'

test('a cron secret match is the only header that passes, and a blank secret never does', () => {
  const prev = process.env.CRON_SECRET
  process.env.CRON_SECRET = ''
  assert.equal(cronAuthorized({ headers: { authorization: 'Bearer ' } }), false)
  process.env.CRON_SECRET = 'nightly'
  assert.equal(cronAuthorized({ headers: { authorization: 'Bearer nightly' } }), true)
  assert.equal(cronAuthorized({ headers: { Authorization: 'Bearer nightly' } }), true)
  assert.equal(cronAuthorized({ headers: { authorization: 'Bearer other' } }), false)
  if (prev == null) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = prev
})

test('reminder jobs share one scheduled-run gate, and the discount uses one payable price', () => {
  const gate = readFileSync(new URL('../server/scheduledRun.mjs', import.meta.url), 'utf8')
  const booking = readFileSync(new URL('../server/bookingRemindersApi.mjs', import.meta.url), 'utf8')
  const maintenance = readFileSync(new URL('../server/maintenanceRemindersApi.mjs', import.meta.url), 'utf8')
  const birthday = readFileSync(new URL('../server/birthdayGreetingsApi.mjs', import.meta.url), 'utf8')
  const sql = readFileSync(new URL('../supabase/migrations/20261017191000_booking_payable_minor.sql', import.meta.url), 'utf8')
  assert.match(gate, /export async function scheduledRunGate/)
  for (const file of [booking, maintenance, birthday]) {
    assert.match(file, /scheduledRunGate/)
    assert.doesNotMatch(file, /function cronAuthorized/)
  }
  assert.equal((sql.match(/coalesce\(nullif\(/g) || []).length, 1)
  assert.equal((sql.match(/booking_payable_minor\(/g) || []).length, 4)
})
