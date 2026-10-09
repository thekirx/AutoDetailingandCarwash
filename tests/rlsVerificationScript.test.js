import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = join(root, 'supabase', 'migrations')

/** Effective policy set after replaying create/drop in file order. */
function effectivePolicies() {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  const map = new Map()
  for (const f of files) {
    const body = readFileSync(join(migrationsDir, f), 'utf8')
      .split(/\r?\n/)
      .filter((l) => !l.trimStart().startsWith('--'))
      .join('\n')
    const st = []
    const dropRe = /drop\s+policy\s+(?:if\s+exists\s+)("([^"]+)"|([\w]+))\s+on\s+(public\.\w+)/gi
    const createRe = /create\s+policy\s+("[^"]+"|[\w]+)\s+on\s+(public\.\w+)\s+for\s+(delete|update|insert|all|select)([\s\S]{0,700}?);/gi
    let m
    while ((m = dropRe.exec(body))) st.push({ at: m.index, d: { name: m[2] || m[3], table: m[4] } })
    while ((m = createRe.exec(body))) {
      st.push({ at: m.index, c: { name: m[1].replace(/"/g, ''), table: m[2], cmd: m[3].toLowerCase(), text: m[0] } })
    }
    st.sort((a, b) => a.at - b.at)
    for (const s of st) {
      if (s.d) map.delete(`${s.d.table}|${s.d.name}`)
      else map.set(`${s.c.table}|${s.c.name}`, s.c)
    }
  }
  return [...map.values()]
}

const P = effectivePolicies()
const on = (t) => P.filter((p) => p.table === t)

describe('the post-migration verification script matches what the migrations actually produce', () => {
  it('is not sitting in supabase/migrations, where the CLI would run it', () => {
    const files = readdirSync(migrationsDir)
    const verify = files.filter((f) => /verify/i.test(f))
    assert.deepEqual(verify, [], 'a verification script in migrations/ gets executed by `db push`')
    assert.ok(readFileSync(join(root, 'scripts', 'verify-after-rls-migration.sql'), 'utf8').length > 0)
  })

  it('is read-only, so it cannot alter what it measures', () => {
    const sql = readFileSync(join(root, 'scripts', 'verify-after-rls-migration.sql'), 'utf8')
    const body = sql.replace(/--.*$/gm, '')
    // Match statement forms, not the words: this script legitimately contains
    // the policy name 'customers_delete' and the literal cmd = 'DELETE', and a
    // bare /\bdelete\b/ flags both as writes.
    const STATEMENTS = [
      /\binsert\s+into\b/i,
      /\bupdate\s+\w[\w.]*\s+set\b/i,
      /\bdelete\s+from\b/i,
      /\bdrop\s+(table|policy|schema|function)\b/i,
      /\balter\s+table\b/i,
      /\btruncate\b/i,
      /\bcreate\s+(policy|table|or\s+replace)/i,
    ]
    for (const re of STATEMENTS) {
      assert.ok(!re.test(body), `verification script is not read-only: matches ${re}`)
    }
  })

  it('covers all three Critical fixes, not just the first one', () => {
    const sql = readFileSync(join(root, 'scripts', 'verify-after-rls-migration.sql'), 'utf8')
    for (const table of ['customers', 'transactions', 'expenses']) {
      assert.ok(sql.includes(`'${table}'`), `no check for ${table}`)
    }
    assert.ok(sql.includes('daily_sheet_line_id'), 'no check that sheet-posted expenses are protected')
    assert.ok(sql.includes('user_notifications'), 'no check that notification spoofing is closed')
  })

  // Each assertion below re-states one of the script's verdicts against the
  // policy state the migrations produce. If a future migration reopens a hole,
  // the script the owner relies on would say PASS while the hole is open —
  // these fail instead.
  it('verdict 1: no FOR ALL policy survives on the three tables', () => {
    const broad = ['public.customers', 'public.transactions', 'public.expenses'].flatMap((t) =>
      on(t).filter((p) => p.cmd === 'all'),
    )
    assert.deepEqual(broad.map((p) => `${p.table}:${p.name}`), [])
  })

  it('verdict 2: no DELETE-capable policy on those tables grants is_admin()', () => {
    const offenders = ['public.customers', 'public.transactions', 'public.expenses'].flatMap((t) =>
      on(t).filter((p) => (p.cmd === 'delete' || p.cmd === 'all') && /is_admin\(\)/.test(p.text)),
    )
    assert.deepEqual(offenders.map((p) => `${p.table}:${p.name}`), [])
  })

  it('verdict 3: every expense write policy carries the daily_sheet_line_id guard', () => {
    const unguarded = on('public.expenses').filter(
      (p) => ['update', 'delete', 'all'].includes(p.cmd) && !/daily_sheet_line_id is null/i.test(p.text),
    )
    assert.deepEqual(unguarded.map((p) => p.name), [])
  })

  it('verdict 4: the notification insert policy scopes user_id', () => {
    const p = on('public.user_notifications').find((x) => x.cmd === 'insert')
    assert.ok(p && /user_id\s*=\s*\(\s*select\s+auth\.uid\(\)\s*\)/.test(p.text))
  })

  it('verdict 5: the NOT BROKEN checks are all still true after the fix', () => {
    // These are the ones that would silently break the queue and POS.
    assert.ok(on('public.customers').some((p) => p.cmd === 'insert' && /admin/.test(p.text)), 'customers INSERT')
    assert.ok(on('public.customers').some((p) => p.cmd === 'update' && /admin/.test(p.text)), 'customers UPDATE')
    assert.ok(on('public.customers').some((p) => p.cmd === 'select' && /admin/.test(p.text)), 'customers SELECT')
    assert.ok(on('public.expenses').some((p) => p.cmd === 'select'), 'expenses SELECT')
    assert.ok(on('public.transactions').some((p) => p.cmd === 'select'), 'transactions SELECT')
  })
})