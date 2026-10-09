import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { allowRoute } from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = join(root, 'supabase', 'migrations')

/**
 * Every RLS policy in force, keyed by table + name.
 *
 * Two facts about this repo make the obvious approach wrong:
 *
 *  1. The policy in force is the LAST one a migration defines for that NAME.
 *  2. **Policies are permissive and combined with OR.** A table can hold many
 *     policies at once, and a restrictive new policy does not narrow anything —
 *     it widens it. Reading a single migration, or a single policy name, happily
 *     reports a table as protected while an older `for all` policy still grants
 *     the operation. BUG-069/070 fixed `expenses_delete` and the hole stayed open
 *     because "Admins manage expenses" (`for all`, guarded by is_admin()) was
 *     never dropped.
 *
 * So the question is never "is this policy restrictive" but "does ANY policy on
 * this table grant this operation to this role".
 */
function effectivePolicies() {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  const map = new Map()
  for (const f of files) {
    const body = readFileSync(join(migrationsDir, f), 'utf8')
      .split(/\r?\n/)
      .filter((l) => !l.trimStart().startsWith('--'))
      .join('\n')

    // Walk statements IN FILE ORDER so a DROP removes an earlier CREATE.
    // Replaying only the creates reports policies a later migration already
    // removed — the exact mistake that made the BUG-069 fix look sufficient.
    //
    // Both name groups must accept quoted names containing spaces:
    // "Admin has full access to customers". Using \w+ or [^"\s]+ matches nothing
    // and reports an empty schema instead of failing loudly.
    const statements = []
    const dropRe = /drop\s+policy\s+(?:if\s+exists\s+)("([^"]+)"|([\w]+))\s+on\s+(public\.\w+)/gi
    const createRe = /create\s+policy\s+("[^"]+"|[\w]+)\s+on\s+(public\.\w+)\s+for\s+(delete|update|insert|all|select)([\s\S]{0,700}?);/gi
    let m
    while ((m = dropRe.exec(body))) statements.push({ at: m.index, drop: { name: m[2] || m[3], table: m[4] } })
    while ((m = createRe.exec(body))) {
      statements.push({
        at: m.index,
        create: { name: m[1].replace(/"/g, ''), table: m[2], cmd: m[3].toLowerCase(), text: m[0], file: f },
      })
    }
    statements.sort((a, b) => a.at - b.at)
    for (const s of statements) {
      if (s.drop) map.delete(`${s.drop.table}|${s.drop.name}`)
      else map.set(`${s.create.table}|${s.create.name}`, s.create)
    }
  }
  return [...map.values()]
}

const POLICIES = effectivePolicies()

/** Does ANY policy grant this operation on this table to is_admin()? */
function grantsAdmin(table, op) {
  return POLICIES.filter(
    (p) => p.table === table && (p.cmd === op || p.cmd === 'all') && /is_admin\(\)/.test(p.text),
  )
}

describe('no policy leaves Branch Admin able to destroy customer or money data', () => {
  it('the scan actually sees the policies — otherwise every check below is vacuous', () => {
    assert.ok(POLICIES.length > 100, `policy scan found only ${POLICIES.length}`)
    assert.ok(
      POLICIES.some((p) => p.table === 'public.customers'),
      'the scan found no customers policies at all — the regex is wrong, not the schema',
    )
  })

  it('is_admin() really does include a Branch Admin', () => {
    const sql = readFileSync(join(migrationsDir, '20260726020000_rbac_assistant_super_admin.sql'), 'utf8')
    assert.match(
      sql,
      /create or replace function public\.is_admin\(\)[\s\S]{0,300}?current_user_role\(\) in \('admin'/,
      'premise: is_admin() is true for role = admin',
    )
  })

  it('Branch Admin cannot DELETE a customer', () => {
    const offenders = grantsAdmin('public.customers', 'delete')
    assert.deepEqual(
      offenders.map((p) => `${p.name} [${p.cmd}] from ${p.file}`),
      [],
      'deleting a customer cascades away loyalty, memberships, notes and reviews',
    )
  })

  it('Branch Admin cannot write the transaction log at all', () => {
    for (const op of ['insert', 'update', 'delete']) {
      const offenders = grantsAdmin('public.transactions', op)
      assert.deepEqual(
        offenders.map((p) => `${p.name} [${p.cmd}] from ${p.file}`),
        [],
        `Branch Admin holds ${op} on transactions`,
      )
    }
  })

  it('Branch Admin cannot UPDATE or DELETE an expense', () => {
    for (const op of ['update', 'delete']) {
      const offenders = grantsAdmin('public.expenses', op)
      assert.deepEqual(
        offenders.map((p) => `${p.name} [${p.cmd}] from ${p.file}`),
        [],
        `Branch Admin holds ${op} on expenses — the Books route denies it, so PostgREST is the only boundary`,
      )
    }
  })

  it('no `for all` policy on these three tables grants is_admin()', () => {
    for (const table of ['public.customers', 'public.transactions', 'public.expenses']) {
      const broad = POLICIES.filter((p) => p.table === table && p.cmd === 'all')
      assert.deepEqual(
        broad.map((p) => `${p.name} from ${p.file}`),
        [],
        `a FOR ALL policy on ${table} re-grants every operation`,
      )
    }
  })

  it('the dropping migration is present and guarded, since the policies are still live in production', () => {
    const p = effectivePolicies()
    assert.ok(p.some((x) => x.table === 'public.customers'), 'sanity')
    const m = readFileSync(
      join(migrationsDir, '20261010130000_drop_permissive_admin_for_all_policies.sql'),
      'utf8',
    )
    for (const name of [
      'Admin has full access to customers',
      'Admin has full access to transactions',
      'Admins manage expenses',
    ]) {
      assert.ok(
        m.includes(`drop policy if exists "${name}"`),
        `the migration must explicitly drop "${name}" — a restrictive policy alongside it would not narrow anything`,
      )
    }
    assert.match(m, /raise exception/, 'the migration must abort rather than half-apply')
    // One `raise exception` anywhere is not enough: each of the three tables needs
    // its own drift guard, or removing one still leaves a plausible green.
    for (const [table, phrase] of [
      ['customers', 'customers: permissive policy already absent'],
      ['transactions', 'transactions: permissive policy already absent'],
      ['expenses', 'expenses: permissive policy already absent'],
    ]) {
      assert.ok(
        m.includes(phrase),
        `the migration must abort when the ${table} permissive policy is already gone`,
      )
    }
  })

  it('Branch Admin cannot address a notification to anyone else', () => {
    const offenders = POLICIES.filter(
      (p) => p.table === 'public.user_notifications' && p.cmd === 'insert' && /is_admin\(\)/.test(p.text),
    )
    assert.deepEqual(
      offenders.map((p) => `${p.name} from ${p.file}`),
      [],
      'with check (is_admin()) puts no constraint on user_id, so a BA can notify the owner',
    )
  })

  it('the notification insert policy lets only Super Admin address someone else', () => {
    const p = POLICIES.find((x) => x.table === 'public.user_notifications' && x.cmd === 'insert')
    assert.ok(p, 'no insert policy on user_notifications at all')
    assert.match(p.text, /is_super_admin\(\)/)
    assert.match(p.text, /user_id\s*=\s*\(\s*select\s+auth\.uid\(\)\s*\)/)
  })

  it('the app_settings split stays deliberate — attendance_roles is Super Admin only', () => {
    for (const cmd of ['insert', 'update', 'delete']) {
      const p = POLICIES.find((x) => x.table === 'public.app_settings' && x.cmd === cmd)
      assert.ok(p, `no ${cmd} policy on app_settings`)
      assert.match(
        p.text,
        /key\s*=\s*'attendance_roles'\s+and\s+public\.is_super_admin\(\)/,
        `app_settings ${cmd} must keep attendance_roles Super Admin only`,
      )
    }
  })

  it('Branch Admin keeps the access its job needs', () => {
    // Removing DELETE must not break the queue and POS, which create and update
    // customers all day. The grant is a role array, not is_admin(), so assert on
    // the role check that actually exists rather than on a predicate that would
    // pass for the wrong reason.
    const grantsAdminRole = (table, cmd) =>
      POLICIES.some(
        (p) =>
          p.table === table &&
          p.cmd === cmd &&
          /current_user_role\(\)\s*=\s*any\s*\(\s*array\[/.test(p.text) &&
          /'admin'::text/.test(p.text),
      )
    assert.ok(grantsAdminRole('public.customers', 'insert'), 'Branch Admin must still create a customer at POS')
    assert.ok(grantsAdminRole('public.customers', 'update'), 'Branch Admin must still update a customer')
    assert.equal(allowRoute({ role: 'admin' }, 'finance'), false, 'premise: BA is denied the Books route')
  })
})