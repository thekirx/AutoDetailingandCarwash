import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
const sql = readFileSync(new URL('../supabase/migrations/20261105070344_points_shop.sql', import.meta.url), 'utf8')
test('migration guards sized legacy claims and carries only pending unsized claims', () => {
  assert.match(sql, /Pending sized claims need manual resolution/)
  assert.match(sql, /jsonb_array_length\(.*size_options/)
  assert.match(sql, /created_at.*\n/)
  assert.match(sql, /where r.status = 'pending'/)
  assert.match(sql, /interval '10 days'/)
})
test('claim stock deduction matches exactly one branch and size', () => {
  assert.match(sql, /and size_key = v_size\s+and qty >= 1/)
  assert.match(sql, /drop function if exists public.redeem_accessory\(uuid, uuid, text\)/)
})
test('codes are private and RPCs are service only', () => {
  assert.match(sql, /using \(customer_id = auth.uid\(\)\)/)
  for (const rpc of ['redeem_accessory', 'handover_redemption', 'expire_redemptions']) {
    assert.match(sql, new RegExp(`revoke all on function public.${rpc}.*from public, anon, authenticated`))
  }
})
