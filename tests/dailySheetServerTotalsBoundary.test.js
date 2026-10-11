import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * `daily_sheet_server_totals` returns "permission denied for function" for Super
 * Admin, Branch Admin and ASA alike. That looked like a live defect on the money
 * path and sat unexplained for a while.
 *
 * It is not a defect. The migration revokes EXECUTE from public/anon/authenticated
 * at creation and never grants it back; no client or API handler calls it. The only
 * caller is submit_daily_sheet, which is itself SECURITY DEFINER, so the definer's
 * rights apply and the revoke does not block it.
 *
 * The reason this is pinned rather than documented in prose: the symptom is
 * indistinguishable from a broken RPC, so the obvious repair is to GRANT it. That
 * repair would be a security regression, not a fix. The function takes an arbitrary
 * sheet uuid, selects that sheet with no branch check, and runs SECURITY DEFINER --
 * so granting it to `authenticated` would let any signed-in crew member read the
 * money totals of any branch in the company. The all-clear has to be mechanical.
 */

/** Line comments first: a `--` can hide a block-comment terminator that would
 *  otherwise be left dangling to swallow the code after it. */
function stripSqlComments(sql) {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

const GRANT_RE = /grant\s+execute\s+on\s+function\s+public\.daily_sheet_server_totals\s*\([^)]*\)\s*to\s+([^;]+);/gi

/** Every grantee the function has been handed to, across all migrations. */
function findExecuteGrants(sql) {
  return [...stripSqlComments(sql).matchAll(GRANT_RE)].map((m) => m[1].trim().toLowerCase())
}

/** Each `create or replace function` in a migration, with its header and body. */
function functionDefinitions(sql) {
  const re = /create\s+or\s+replace\s+function\s+public\.([a-z0-9_]+)\s*\([^)]*\)([\s\S]*?)\bas\s+\$\$([\s\S]*?)\$\$/gi
  return [...stripSqlComments(sql).matchAll(re)].map((m) => ({ name: m[1], header: m[2], body: m[3] }))
}

/** Functions that call `callee` from inside their own body. */
function callersOf(defs, callee) {
  const re = new RegExp(`\\b${callee}\\s*\\(`, 'i')
  return defs.filter((d) => re.test(d.body))
}

const isDefiner = (def) => /security\s+definer/i.test(def.header)

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationDir = join(root, 'supabase', 'migrations')
const migrations = readdirSync(migrationDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => ({ file: f, sql: readFileSync(join(migrationDir, f), 'utf8') }))

const allSql = migrations.map((m) => m.sql).join('\n')

/** Client and server-side code that could actually invoke the RPC. */
function clientSurface() {
  const out = []
  for (const dir of ['src', 'api', 'server']) {
    const walk = (d) => {
      let entries = []
      try {
        entries = readdirSync(d, { withFileTypes: true })
      } catch {
        return
      }
      for (const e of entries) {
        const p = join(d, e.name)
        if (e.isDirectory()) walk(p)
        else if (/\.(js|jsx|mjs)$/.test(e.name)) out.push(p)
      }
    }
    walk(join(root, dir))
  }
  return out
}

describe('daily_sheet_server_totals is revoked on purpose, and stays that way', () => {
  it('the origin migration revokes EXECUTE from every requester', () => {
    const origin = migrations.find((m) => m.file.startsWith('20261001090000'))
    assert.ok(origin, 'the originating migration is gone -- re-verify before assuming anything below')
    const sql = stripSqlComments(origin.sql)
    assert.match(
      sql,
      /revoke\s+all\s+on\s+function\s+public\.daily_sheet_server_totals\(uuid\)\s+from\s+public,\s*anon,\s*authenticated;/i,
      'the revoke is missing, so "permission denied" would be an accident rather than a decision',
    )
  })

  it('no migration anywhere grants it to a requester', () => {
    assert.deepEqual(findExecuteGrants(allSql), [], 'a GRANT would expose every branch\u2019s totals to any signed-in user')
  })

  it('every definition of it is SECURITY DEFINER, so the RLS bypass is deliberate', () => {
    const defs = functionDefinitions(allSql).filter((d) => d.name === 'daily_sheet_server_totals')
    assert.ok(defs.length > 0, 'no definition found -- if it was dropped, this file is asserting against nothing')
    for (const d of defs) {
      assert.ok(isDefiner(d), `${d.name} is no longer SECURITY DEFINER; the revoke is no longer the thing protecting the data`)
    }
  })

  it('every internal caller is SECURITY DEFINER too -- otherwise the revoke breaks the money path', () => {
    // submit_daily_sheet reads the totals to enforce the over/short note rule. If
    // that caller ever lost SECURITY DEFINER it would start failing on a permission
    // error, at submit time, on a real trading day.
    const callers = callersOf(functionDefinitions(allSql), 'daily_sheet_server_totals')
    assert.ok(callers.length > 0, 'the only caller went away -- confirm submit_daily_sheet still enforces the over/short rule')
    for (const c of callers) {
      assert.ok(isDefiner(c), `${c.name} calls the totals but is not SECURITY DEFINER, so the revoke blocks it`)
    }
  })

  it('no client or API handler calls it', () => {
    const files = clientSurface()
    assert.ok(files.length > 20, 'the surface scan found almost nothing; it is probably looking in the wrong place')
    const hits = files.filter((f) => /daily_sheet_server_totals/.test(readFileSync(f, 'utf8').replace(/^\s*\/\/.*$/gm, '')))
    assert.deepEqual(hits.map((f) => relative(root, f)), [], 'a new caller needs the branch check this function does not have')
  })
})

describe('the detectors above can actually fail', () => {
  // A guard whose control does not remove the thing it guards is decoration.
  const real = migrations.find((m) => m.file.startsWith('20261001090000')).sql

  it('finds a grant that is really there', () => {
    const withGrant = `${real}\ngrant execute on function public.daily_sheet_server_totals(uuid) to authenticated;`
    assert.deepEqual(findExecuteGrants(withGrant), ['authenticated'])
  })

  it('does not mistake the BUG-086 guard prose for a grant', () => {
    // 20261010170000 mentions the function by name repeatedly, including inside
    // a comment explaining its own guard. A naive grep matches all of it.
    const b86 = migrations.find((m) => m.file.startsWith('20261010170000')).sql
    assert.ok(b86.includes('daily_sheet_server_totals'), 'fixture drifted')
    assert.deepEqual(findExecuteGrants(b86), [], 'comment stripping is not working')
    assert.ok(b86.includes("p.proname = 'daily_sheet_server_totals'"), 'fixture drifted')
    assert.ok(
      functionDefinitions(b86).some((d) => d.name === 'daily_sheet_server_totals'),
      'a call inside the drift guard must not be read as a function definition',
    )
  })

  it('sees a caller that lost SECURITY DEFINER', () => {
    const weakened = real.replace('create or replace function public.submit_daily_sheet', 'create or replace function public.submit_daily_sheet')
    const defs = functionDefinitions(weakened).filter((d) => d.body.includes('daily_sheet_server_totals('))
    assert.ok(defs.length > 0, 'fixture drifted: no caller found to weaken')
    const broken = defs.map((d) => ({ ...d, header: d.header.replace(/security\s+definer/i, 'security invoker') }))
    assert.ok(broken.some((d) => !isDefiner(d)), 'the definer check cannot fail, so it proves nothing')
  })
})