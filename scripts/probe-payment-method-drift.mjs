/**
 * READ-ONLY. Does the sales table hold payment_method values the Daily Sheet's
 * server-side cash total and the POS screen classify differently?
 *
 * BUG-081 gave `drawerPaymentBucket()` one definition of cash for JavaScript:
 *   blank/absent -> cash, trimmed + lowercased, unrecognised -> other.
 *
 * The SQL that stamps `totals` on the sheet still asks its own question:
 *
 *   lower(coalesce(payment_method, 'cash')) = 'cash'
 *
 * `coalesce` substitutes for NULL but passes '' straight through, and there is
 * no `trim()`. So a stored '', ' cash' or 'cash ' counts as cash on the POS
 * screen and as NOT cash in daily_sheet_server_totals. That is the same class of
 * bug as BUG-081, in the one implementation BUG-081 did not touch, and it feeds
 * cashMinor -> expectedCashMinor -> overShortMinor -- the drawer reconciliation.
 *
 * This probe only ever SELECTs. It writes nothing.
 *
 *   node scripts/probe-payment-method-drift.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drawerPaymentBucket } from '../src/lib/paymentMethods.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i).trim()
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim()
}

const URL_ = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
  process.exit(1)
}

const db = createClient(URL_, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

/** A read that failed must not look like a read that found nothing. */
function readOrFail(label, res) {
  if (res.error) throw new Error(`${label} read failed: ${res.error.message}`)
  return res.data
}

/** Exactly what daily_sheet_server_totals does. */
const sqlSaysCash = (v) =>
  String(v == null ? 'cash' : v).toLowerCase() === 'cash'

const rows = readOrFail('sales', await db
  .from('sales')
  .select('id, payment_method, status, total_minor, occurred_at, branch')
  .order('occurred_at', { ascending: false })
  .limit(2000))

console.log(`sales rows sampled: ${(rows || []).length}`)

const drift = new Map()
for (const r of rows || []) {
  const js = drawerPaymentBucket(r.payment_method) === 'cash'
  const sql = sqlSaysCash(r.payment_method)
  if (js === sql) continue
  const key = JSON.stringify(r.payment_method)
  const cur = drift.get(key) || { value: r.payment_method, rows: 0, minor: 0, paidMinor: 0 }
  cur.rows += 1
  cur.minor += Number(r.total_minor || 0)
  if (r.status === 'paid') cur.paidMinor += Number(r.total_minor || 0)
  drift.set(key, cur)
}

if (!drift.size) {
  console.log('\nCLEAN — every sampled payment_method classifies the same in JS and SQL.')
  console.log('The divergence is latent: reachable only if a blank or padded method is ever stored.')
} else {
  console.log(`\nDRIFT — ${drift.size} distinct stored value(s) classify differently:\n`)
  for (const d of [...drift.values()].sort((a, b) => b.paidMinor - a.paidMinor)) {
    console.log(
      `  payment_method=${d.value === null ? 'NULL' : JSON.stringify(d.value)}` +
        `  rows=${d.rows}  total=${(d.minor / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` +
        `  paid=${(d.paidMinor / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
    )
    console.log('    JS  drawerPaymentBucket -> cash   (counts into the drawer)')
    console.log('    SQL  lower(coalesce(...))        -> not cash (missing from the drawer)')
  }
  const worst = [...drift.values()].reduce((a, b) => (b.paidMinor > a.paidMinor ? b : a))
  console.log(
    `\nWorst case: a BA whose counted drawer is correct is told the drawer is short by up to` +
      ` ₱${(worst.paidMinor / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
  )
}

// How the POS picks the method in the first place — is a blank value even storable?
//
// readOrFail returns res.data, NOT the response, so this must not destructure
// `{ data: one }` from it. That shape always yields undefined and printed
// "(no paid rows sampled)" on every run, for 988 rows that demonstrably exist.
// A probe that states a falsehood in its own output costs the reader's trust in
// everything else it says.
const one = readOrFail(
  'sales sample row',
  await db.from('sales').select('payment_method, status').eq('status', 'paid').order('occurred_at', { ascending: false }).limit(1),
) || []
console.log(`\nsample paid row payment_method: ${one[0] ? JSON.stringify(one[0].payment_method) : '(no paid rows sampled)'}`)