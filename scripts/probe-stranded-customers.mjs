/**
 * READ-ONLY: do the two stranded hand-offs point at real customers, or test
 * rows?
 *
 * The previous probe reported "customer MISSING" for both. That was WRONG and
 * the cause is worth recording: I asked for `customers.name`, which does not
 * exist, so PostgREST returned an error alongside the empty result and the
 * absence of rows was read as "no such customer". The uuid was populated the
 * whole time. Always print the error; a guessed column and a missing row look
 * identical otherwise.
 *
 *   node scripts/probe-stranded-customers.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i)
  if (!process.env[k]) process.env[k] = line.slice(i + 1)
}
const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set'); process.exit(1) }

const db = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

// Discover the real columns first — never guess.
const probe = await db.from('customers').select('*').limit(1)
if (probe.error) { console.error('customers unreadable:', probe.error.message); process.exit(1) }
const cols = Object.keys((probe.data && probe.data[0]) || {})
console.log(`customers columns: ${cols.join(', ')}\n`)

const ids = [
  '3f9e758e-90e8-4ee6-8730-80d7c0e6972c',
  '86984842-bf54-4476-88bd-aa291b6b0c5d',
]
const labels = ['handoff 3dc882e1  PHP 297.50', 'handoff c8dfab00  PHP 5,100.00']

for (let i = 0; i < ids.length; i++) {
  const id = ids[i]
  const { data, error } = await db.from('customers').select('*').eq('id', id).maybeSingle()
  console.log('================================================')
  console.log(labels[i])
  if (error) {
    console.log(`  ERROR: ${error.message}`)
    continue
  }
  if (!data) {
    console.log('  no row for this id (and no error — this is a genuine absence)')
    continue
  }
  console.log('  row exists. Every column:')
  for (const [k, v] of Object.entries(data)) {
    const s = v === null || v === undefined ? 'NULL' : String(v)
    console.log(`    ${k.padEnd(24)} ${s.length > 90 ? `${s.slice(0, 90)}…` : s}`)
  }
}

// Cross-check: how many customers look like test rows at all?
const { data: all } = await db.from('customers').select('*')
const nameCol = cols.find((c) => /full_name|^(name|display_name)$/.test(c)) || null
if (nameCol) {
  const testish = all.filter((c) => /test|walk-?in|demo|seed|sample/i.test(String(c[nameCol] || '')))
  console.log(`\ncustomers whose ${nameCol} looks like a test row: ${testish.length} of ${all.length}`)
  for (const c of testish.slice(0, 12)) console.log(`   ${c[nameCol]}  (${c.email ?? 'no email'})`)
}

console.log('\n(read-only probe — no writes issued)')