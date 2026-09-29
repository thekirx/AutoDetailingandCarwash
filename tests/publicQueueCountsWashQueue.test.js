import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migration = readFileSync(
  join(root, 'supabase/migrations/20260928200000_public_queue_counts_match_wash_queue.sql'),
  'utf8',
)

describe('public_queue_counts matches the Team Lead Car Wash Queue', () => {
  it('stays grouped per branch', () => {
    assert.match(migration, /group by v\.branch/)
    assert.match(migration, /group by branch, visit_key/)
  })

  it('excludes multi-day detailing (Bookings board, not the wash queue)', () => {
    assert.match(migration, /pay_category, 'general'\)\) <> 'detailing'/)
    for (const slug of ['ceramic-coating', 'paint-maintenance', 'nano-ceramic-tint', 'paint-protection-film']) {
      assert.match(migration, new RegExp(`'${slug}'`))
    }
  })

  it('counts one per visit, not per service line', () => {
    assert.match(migration, /coalesce\(b\.visit_group_id, b\.id\) as visit_key/)
  })

  it('exposes no customer PII and stays readable by anon', () => {
    assert.doesNotMatch(migration, /customer_(name|phone|email)|vehicle_plate/)
    assert.match(migration, /grant select on public\.public_queue_counts to anon, authenticated/)
  })
})
