import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = join(root, 'supabase/migrations')
const migrationName = readdirSync(migrationsDir).find((name) =>
  name.endsWith('_restore_public_read_policies.sql'),
)

describe('public content RLS contract', () => {
  it('keeps anonymous reads separate from staff-only authorization helpers', () => {
    assert.ok(migrationName, 'missing restore_public_read_policies migration')

    const sql = readFileSync(join(migrationsDir, migrationName), 'utf8')
    const policies = {
      branches: {
        publicPredicate: /not\s+is_archived[\s\S]*is_active[\s\S]*coming_soon/i,
        staffHelper: /is_admin\(\)|current_user_branch\(\)|user_has_branch_access/i,
      },
      blogs: {
        publicPredicate: /is_published\s*=\s*true[\s\S]*status\s*=\s*'published'/i,
        staffHelper: /staff_profiles|asa_has_grant/i,
      },
      events: {
        publicPredicate: /is_published\s*=\s*true/i,
        staffHelper: /is_super_admin\(\)|current_user_role\(\)|asa_has_grant/i,
      },
      services: {
        publicPredicate: /is_active\s*=\s*true[\s\S]*is_archived\s*=\s*false/i,
        staffHelper: /is_staff\(\)|is_super_admin\(\)|asa_has_grant/i,
      },
      membership_tiers: {
        publicPredicate: /is_active\s*=\s*true/i,
        staffHelper: /is_super_admin\(\)|asa_has_grant/i,
      },
      loyalty_milestones: {
        publicPredicate: /is_active\s*=\s*true/i,
        staffHelper: /is_super_admin\(\)|asa_has_grant/i,
      },
    }

    for (const [table, { publicPredicate, staffHelper }] of Object.entries(policies)) {
      assert.match(sql, new RegExp(`drop policy if exists ${table}_select`, 'i'))
      const anonPolicy = sql.match(
        new RegExp(`create policy ${table}_select_anon[\\s\\S]*?;`, 'i'),
      )
      const authenticatedPolicy = sql.match(
        new RegExp(`create policy ${table}_select_authenticated[\\s\\S]*?;`, 'i'),
      )

      assert.ok(anonPolicy, `missing anonymous ${table} policy`)
      assert.match(anonPolicy[0], new RegExp(`on public\\.${table}[\\s\\S]*to anon`, 'i'))
      assert.match(anonPolicy[0], publicPredicate)
      assert.doesNotMatch(anonPolicy[0], staffHelper)

      assert.ok(authenticatedPolicy, `missing authenticated ${table} policy`)
      assert.match(
        authenticatedPolicy[0],
        new RegExp(`on public\\.${table}[\\s\\S]*to authenticated`, 'i'),
      )
      assert.match(authenticatedPolicy[0], publicPredicate)
      assert.match(authenticatedPolicy[0], staffHelper)
    }

    assert.doesNotMatch(sql, /public_queue_(counts|numbers|floor)/i)
  })
})
