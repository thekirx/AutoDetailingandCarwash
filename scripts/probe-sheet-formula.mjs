/**
 * READ-ONLY: check the probe's arithmetic against the app's ACTUAL formula.
 *
 * src/lib/salesSummary.js rollupSales():
 *   grossMinor  = Σ(total + discount)   over paid + refunded
 *   discounts   = Σ discount             over paid + refunded
 *   refunds     = Σ total                over refunded
 *   net         = Σ total                over paid only
 *   byMethod    = Σ total                over paid only   <- sums to NET, not gross
 *
 * Therefore the true invariants are:
 *   net      == gross - discounts - refunds
 *   byMethod == net
 *
 * The first version of probe-daily-sheets.mjs asserted `net == gross - discounts`
 * and `byMethod == gross`, which is simply the wrong formula whenever a day has
 * a discount or a refund. Every finding it produced from those two checks was a
 * false positive. This verifies the corrected formula against real data before
 * anything is changed.
 *
 *   node scripts/probe-sheet-formula.mjs
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
const n = (v) => Number(v || 0)

const rows = []
for (let from = 0; ; from += 500) {
  const { data, error } = await db
    .from('daily_sheets')
    .select('id, branch, business_date, status, totals')
    .range(from, from + 499)
  if (error) { console.error('read failed:', error.message); process.exit(1) }
  rows.push(...(data || []))
  if (!data || data.length < 500) break
}

console.log(`sheets: ${rows.length}\n`)

let oldNetFail = 0
let newNetFail = 0
let oldMethodFail = 0
let newMethodFail = 0
const newFailures = []
const refundDays = []

for (const sh of rows) {
  const t = sh.totals || {}
  if (t.netMinor === undefined) continue

  // OLD (wrong) formula
  if (n(t.grossMinor) - n(t.discountsMinor) !== n(t.netMinor)) oldNetFail++
  const bm = t.byMethod ? Object.values(t.byMethod).reduce((a, b) => a + n(b), 0) : 0
  if (bm !== n(t.grossMinor)) oldMethodFail++

  // NEW formula, taken from rollupSales
  const expectNet = n(t.grossMinor) - n(t.discountsMinor) - n(t.refundsMinor)
  if (expectNet !== n(t.netMinor)) {
    newNetFail++
    newFailures.push({ branch: sh.branch, date: sh.business_date, why: 'net', gross: n(t.grossMinor), disc: n(t.discountsMinor), ref: n(t.refundsMinor), net: n(t.netMinor), expectNet })
  }
  if (bm !== n(t.netMinor)) {
    newMethodFail++
    newFailures.push({ branch: sh.branch, date: sh.business_date, why: 'byMethod!=net', byMethod: bm, net: n(t.netMinor) })
  }
  if (n(t.refundsMinor)) refundDays.push({ branch: sh.branch, date: sh.business_date, refunds: n(t.refundsMinor) })
}

console.log('=== how many sheets each formula flags ===')
console.log(`  OLD  net    != gross - discounts : ${oldNetFail}`)
console.log(`  NEW  net    != gross - disc - ref: ${newNetFail}`)
console.log(`  OLD  byMethod != gross           : ${oldMethodFail}`)
console.log(`  NEW  byMethod != net             : ${newMethodFail}`)
console.log(`\n  sheets carrying a refund: ${refundDays.length}`)
for (const r of refundDays.slice(0, 10)) console.log(`    ${r.branch}/${r.date} refunds=${r.refunds / 100}`)

if (newFailures.length) {
  console.log(`\n=== ${newFailures.length} REAL failure(s) under the corrected formula ===`)
  for (const f of newFailures.slice(0, 15)) console.log('  ', JSON.stringify(f))
} else {
  console.log('\n=== every sheet satisfies the corrected formula (net and byMethod) ===')
}

console.log('\n(read-only probe — no writes issued)')