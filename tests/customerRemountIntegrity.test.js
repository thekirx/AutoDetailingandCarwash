import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CUSTOMER_REFERENCING_TABLES } from '../server/provisionCustomer.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = join(root, 'supabase', 'migrations')

/**
 * Every table in the schema that holds a FK to `customers(id)`, derived from the
 * migrations themselves. This is the list the remount must either move or
 * explicitly accept losing — a hardcoded list in the source would go stale the
 * moment someone adds a column, and a stale list is exactly the bug this file
 * exists to prevent.
 */
function customerForeignKeys() {
  const found = new Map()
  for (const file of readdirSync(migrationsDir)) {
    if (!file.endsWith('.sql')) continue
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    // Strip line comments: prose about a fixed bug names the code it replaced,
    // and a commented-out constraint is not a constraint.
    const body = sql.split(/\r?\n/).filter((l) => !l.trimStart().startsWith('--')).join('\n')
    const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?\s*\(([\s\S]*?)\n\);/gi
    let m
    while ((m = re.exec(body))) {
      const [, table, cols] = m
      const colRe = /customer_id\s+uuid\s+[^,]*?references\s+(?:public\.)?customers\s*\(\s*id\s*\)\s*(on\s+delete\s+\w+)?/gi
      const hit = colRe.exec(cols)
      if (hit) found.set(table, (hit[1] || 'no action').toLowerCase())
    }
  }
  return found
}

describe('customer remount cannot orphan or destroy history', () => {
  it('derives at least the known customer-referencing tables from the migrations', () => {
    const fks = customerForeignKeys()
    // Guards the derivation itself: if this regex stops matching the schema,
    // every assertion below would silently pass on an empty list.
    assert.ok(fks.size >= 6, `expected several customer FKs, derived ${fks.size}: ${[...fks.keys()]}`)
    for (const known of ['loyalty_ledger', 'customer_memberships', 'customer_birthday_perks', 'sales']) {
      assert.ok(fks.has(known), `derivation missed ${known}`)
    }
  })

  it('moves every table whose FK would block or cascade the old-row delete', () => {
    const fks = customerForeignKeys()
    // The derived rule is the raw clause, e.g. "on delete cascade".
    const ruleOf = (v) => (v.includes('cascade') ? 'cascade' : v.includes('restrict') ? 'restrict' : 'set null')
    const destructive = [...fks.entries()].filter(([, rule]) => ['restrict', 'cascade'].includes(ruleOf(rule)))
    assert.ok(destructive.length > 0, `expected restrict/cascade customer FKs in the schema, derived ${JSON.stringify([...fks])}`)

    for (const [table] of destructive) {
      assert.ok(
        CUSTOMER_REFERENCING_TABLES.has(table),
        `${table} has a ${fks.get(table)} FK to customers(id) but the remount does not move it — ` +
          `deleting the old row either fails silently or cascades the history away`,
      )
    }
  })

  it('moves the tables the remount already handled, plus the loyalty/membership rows', () => {
    for (const table of ['bookings', 'vehicles', 'sales', 'loyalty_ledger', 'customer_memberships', 'customer_birthday_perks']) {
      assert.ok(CUSTOMER_REFERENCING_TABLES.has(table), `${table} missing from the remount plan`)
    }
  })

  it('moves the referencing rows before deleting the old customer row', () => {
    // Derived from the source, not from a helper that restates the constants:
    // a plan object can claim any ordering while the function does something else.
    const source = readFileSync(join(root, 'server', 'provisionCustomer.mjs'), 'utf8')
    const fnStart = source.indexOf('async function remountCustomerOntoAuthUid')
    assert.ok(fnStart > -1, 'remountCustomerOntoAuthUid not found')
    const fnEnd = source.indexOf('\nexport async function handleProvisionRequest', fnStart)
    const body = source.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined)

    const moveAt = body.indexOf('CUSTOMER_REFERENCING_TABLES')
    const deleteAt = body.indexOf(".from('customers').delete()")
    assert.ok(moveAt > -1, 'the referencing-table move is gone from the remount')
    assert.ok(deleteAt > -1, 'the old-row delete is gone from the remount')
    assert.ok(moveAt < deleteAt, 'deleting the old row before re-pointing history destroys it')

    // A `&& false` style guard would skip the delete while every other
    // assertion still passed, so the guard itself has to be real.
    assert.ok(
      /if \(fromId !== toId\) \{/.test(body),
      'the old-row delete must run whenever the ids actually differ',
    )
  })

  it('surfaces a failed delete instead of reporting a successful link', () => {
    const source = readFileSync(join(root, 'server', 'provisionCustomer.mjs'), 'utf8')
    const body = source
    const deleteCalls = body.match(/from\('customers'\)\s*\.\s*delete\(\)/g) || []
    assert.equal(deleteCalls.length, 1, 'expected exactly one old-row delete')
    // An un-checked delete returns { error } rather than throwing; the caller
    // would then answer 200 with a duplicate customer row left behind.
    assert.ok(
      /const\s*\{[^}]*error[^}]*\}\s*=\s*await\s*admin\s*\n?\s*\.from\('customers'\)\s*\n?\s*\.delete\(\)/.test(body),
      'the customers delete must destructure and check its error',
    )
  })
})