/**
 * P1-1: service_reviews must not be world-readable/writable for every authenticated user.
 * Seam: public.service_reviews RLS policies in the follow-up migration.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('service_reviews RLS contract', () => {
  it('replaces open authenticated insert/select with owner + ops policies', async () => {
    const sql = await readFile(
      join(root, 'supabase/migrations/20260813120000_service_reviews_rls.sql'),
      'utf8',
    )
    assert.match(sql, /drop policy if exists service_reviews_select_ops/i)
    assert.match(sql, /drop policy if exists service_reviews_insert_authenticated/i)
    assert.match(sql, /customer_id\s*=\s*\(select auth\.uid\(\)\)/i)
    assert.match(sql, /current_user_role\(\).*BossMich/s)
    assert.match(sql, /status\s*=\s*'completed'/)
    assert.doesNotMatch(
      sql,
      /create policy service_reviews_insert_authenticated[\s\S]*with check\s*\(\s*true\s*\)/i,
    )
    assert.doesNotMatch(
      sql,
      /create policy service_reviews_select_ops[\s\S]*using\s*\(\s*true\s*\)/i,
    )
  })

  it('allows rating archived completed visits', async () => {
    const sql = await readFile(
      join(root, 'supabase/migrations/20260904120000_service_reviews_allow_archived_completed.sql'),
      'utf8',
    )
    assert.match(sql, /service_reviews_insert_own/)
    assert.match(sql, /status\s*=\s*'completed'/)
    assert.doesNotMatch(sql, /is_archived/)
  })
})
