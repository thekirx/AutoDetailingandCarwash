import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migration = readFileSync(
  join(root, 'supabase/migrations/20260801140000_atomic_queue_numbers.sql'),
  'utf8',
)

describe('Atomic queue number allocator (DB-P0-1)', () => {
  it('defines counter table + assign_daily_queue_number + before-insert trigger', () => {
    assert.match(migration, /create table if not exists public\.queue_number_counters/)
    assert.match(migration, /create or replace function public\.assign_daily_queue_number/)
    assert.match(migration, /for update/i)
    assert.match(migration, /trg_assign_booking_queue_number/)
    assert.match(migration, /before insert on public\.bookings/i)
  })

  it('does not UNIQUE bookings queue_number (multi-service visits share numbers)', () => {
    assert.doesNotMatch(
      migration,
      /unique\s*\(\s*branch\s*,\s*queue_date\s*,\s*queue_number\s*\)/i,
    )
    assert.match(migration, /bookings_branch_queue_date_number_idx/)
  })

  it('seeds counters from existing bookings and uses Manila calendar date', () => {
    assert.match(migration, /Asia\/Manila/)
    assert.match(migration, /on conflict \(branch, queue_date\) do update/)
  })
})
