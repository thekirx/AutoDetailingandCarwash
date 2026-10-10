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

  it('Branch Admin cannot read the whole company inbox', () => {
    // BUG-079. The read policy is `user_id = auth.uid() or public.is_admin()`,
    // and is_admin() is true for role = 'admin' — a Branch Admin. The original
    // policy was written as "Admins can read inbox for support (optional)", which
    // means the owner's Super Admin, not every store manager.
    //
    // This is not latent. NotificationBell is the only reader and it selects with
    // NO user_id filter — it relies entirely on RLS — so a Branch Admin's bell
    // renders the newest 20 notifications belonging to the entire company: other
    // branches' customers, plates, services, and crew payroll alerts.
    const offenders = POLICIES.filter(
      (p) => p.table === 'public.user_notifications' && (p.cmd === 'select' || p.cmd === 'all') && /is_admin\(\)/.test(p.text),
    )
    assert.deepEqual(
      offenders.map((p) => `${p.name} [${p.cmd}] from ${p.file}`),
      [],
      'a BA read policy puts every user\'s notification titles and bodies in scope',
    )
  })

  it('the notification read policy is own rows plus Super Admin, nothing wider', () => {
    const p = POLICIES.find((x) => x.table === 'public.user_notifications' && x.cmd === 'select')
    assert.ok(p, 'no select policy on user_notifications at all')
    // Compare the whole USING clause, not for the presence of a token. Asserting
    // `/is_super_admin\(\)/` also passes for `is_super_admin() and false`, which
    // grants Super Admin nothing — a narrowing that silently turns the bell off
    // for the owner is worse than the leak it closes.
    const using = /\busing\s*\(([\s\S]*?)\)\s*;?\s*$/i.exec(p.text)?.[1] || ''
    assert.ok(using, `could not read the USING clause from: ${p.text}`)
    const normalized = using.replace(/\s+/g, ' ').trim().toLowerCase()
    assert.equal(
      normalized,
      'user_id = (select auth.uid()) or public.is_super_admin()',
      `the read predicate drifted from own-rows-plus-Super-Admin: ${normalized}`,
    )
  })

  it('the notification narrowing migration carries both of its safety guards', () => {
    // These guards are the entire reason it is safe to run against production.
    // Without them, running it against a database this team has already changed
    // would silently replace a policy nobody has read.
    const m = readFileSync(
      join(migrationsDir, '20261010140000_scope_notification_reads.sql'),
      'utf8',
    )
    assert.match(
      m,
      /if v_current is distinct from '[\s\S]{0,300}?' then\s*\r?\n\s*raise exception 'user_notifications_select has drifted/,
      'the migration must abort rather than replace a policy whose predicate it has not read',
    )
    assert.match(
      m,
      /from pg_proc p[\s\S]{0,400}?raise exception 'public\.is_super_admin\(\) is missing/,
      'the replacement depends on is_super_admin(); if it is absent the migration would deny Super Admin too',
    )
    assert.match(m, /drop policy if exists user_notifications_select/, 'the old name must be dropped, not just shadowed')
    assert.match(
      m,
      /raise exception 'user_notifications_select is missing/,
      'a missing policy is a reason to stop, not to guess',
    )
  })

  it('the owner verification script proves the bell still works after narrowing', () => {
    // The verification script is what the owner actually runs. If it only checks
    // that the leak is gone, a migration that also darkened every bell passes it.
    const v = readFileSync(join(root, 'scripts', 'verify-after-rls-migration.sql'), 'utf8')
    assert.match(
      v,
      /no policy would let a user read their own inbox/,
      'the script must prove own-rows still readable, not only that the cross-user read is gone',
    )
    assert.match(v, /Super Admin lost the support read/, 'and that Super Admin kept the affordance')
    assert.match(
      v,
      /20261010140000_scope_notification_reads\.sql/,
      'the script must name the third migration in the apply order',
    )
  })

  it('no `for all` policy on user_notifications re-grants the read', () => {
    const broad = POLICIES.filter((p) => p.table === 'public.user_notifications' && p.cmd === 'all')
    assert.deepEqual(
      broad.map((p) => `${p.name} from ${p.file}`),
      [],
      'a FOR ALL policy here would hand back the cross-user read the narrowing removed',
    )
  })

  it('narrowing the read is safe — nothing in the app reads another user\'s inbox', () => {
    // The "don't break daily operations" counterpart for this narrowing. The bell
    // reads unfiltered, so if any screen genuinely needed a cross-user inbox this
    // migration would silently empty it. Fail here instead.
    const files = readdirSync(join(root, 'src'), { recursive: true })
    const readers = []
    for (const rel of files) {
      if (!/\.(js|jsx|mjs)$/.test(rel)) continue
      const text = readFileSync(join(root, 'src', rel), 'utf8')
      if (!/from\('user_notifications'\)/.test(text)) continue
      // A read that scopes itself to the signed-in user is fine.
      const scoped = /\.eq\(\s*'user_id'/.test(text) || /\.eq\(\s*'id'\s*,\s*row/.test(text)
      readers.push({ file: `src/${rel}`, scoped })
    }
    assert.ok(readers.length > 0, 'no reader found — the parse is wrong, not the app')
    assert.deepEqual(
      readers.filter((r) => !r.scoped).map((r) => r.file),
      [],
      'an unfiltered read now returns only the caller\'s own rows; that is the intent, but name it here',
    )
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

  it('removing Branch Admin transaction writes is safe — RLS never applied there', () => {
    // The queue hands a ticket to payment by inserting into `transactions`. If
    // that insert ran as the caller, narrowing the policy would break the
    // daily handoff. Every definition of that function is SECURITY DEFINER, so
    // the write bypasses RLS entirely and the narrowing costs nothing.
    //
    // This is the "don't destroy daily operations" guarantee for the migration:
    // if someone later adds a client-side transaction write, this fails rather
    // than the POS breaking in production after the migration runs.
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
    const writers = []
    for (const f of files) {
      const body = readFileSync(join(migrationsDir, f), 'utf8')
      for (const part of body.split(/(?=create\s+or\s+replace\s+function)/i)) {
        if (!/insert\s+into\s+(public\.)?transactions/i.test(part)) continue
        const name = /create\s+or\s+replace\s+function\s+([\w.]+)/i.exec(part)
        writers.push({ file: f, fn: name ? name[1] : '(not in a function)', definer: /security\s+definer/i.test(part) })
      }
    }
    assert.ok(writers.length > 0, 'no writer found — the parse is wrong, not the schema')
    const invoker = writers.filter((w) => !w.definer)
    assert.deepEqual(
      invoker.map((w) => `${w.fn} in ${w.file}`),
      [],
      'a transaction write runs as the caller, so narrowing the RLS policy would break it',
    )
  })

  it('nothing in the app reads or writes `transactions` through the client', () => {
    // Confirms the same thing from the other side: no direct PostgREST call can
    // be relying on a grant this migration removes.
    const direct = []
    for (const dir of ['src', 'api', 'server']) {
      let files = []
      try {
        files = readdirSync(join(root, dir), { recursive: true })
      } catch {
        continue
      }
      for (const rel of files) {
        if (!/\.(js|jsx|mjs)$/.test(rel)) continue
        let text
        try {
          text = readFileSync(join(root, dir, rel), 'utf8')
        } catch {
          continue
        }
        if (/from\('transactions'\)/.test(text)) direct.push(`${dir}/${rel}`)
      }
    }
    assert.deepEqual(direct, [], `direct client access to transactions: ${direct.join(', ')}`)
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