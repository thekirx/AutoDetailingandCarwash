/* global document */
/**
 * 1) signupCustomer returns existing_history after orphan walk-in.
 * 2) Account home renders EXISTING_HISTORY_MESSAGE when sessionStorage flag is set.
 *
 * Session: Node sign-in with demo customer → inject supabase auth into the browser
 * (avoids /signin chip + lookup flakes under headless).
 *
 *   BASE_URL=http://127.0.0.1:5174 node scripts/e2e-history-banner.mjs
 */
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { CUSTOMER_DEMO_ACCOUNT } from '../src/lib/demoAccounts.js'
import { EXISTING_HISTORY_MESSAGE } from '../src/lib/vehicleTransfer.js'
import { signupCustomer } from '../server/customerSignup.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i > 0 && !process.env[line.slice(0, i)]) process.env[line.slice(0, i)] = line.slice(i + 1)
  }
}

const base = (process.env.BASE_URL || 'http://127.0.0.1:5174').replace(/\/$/, '')
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
assert.ok(url && anon && service, 'missing SUPABASE env')

const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
const stamp = Date.now().toString().slice(-7)
const PHONE = `0920${stamp}`.slice(0, 11)
const PHONE_SPACED = `${PHONE.slice(0, 4)} ${PHONE.slice(4, 7)} ${PHONE.slice(7)}`
const PLATE = `HBN${stamp.slice(-4)}`
const PASS = `QaBanner${stamp}!a`
const outDir = join(root, 'e2e-evidence', 'history-banner')
mkdirSync(outDir, { recursive: true })
const created = { bookings: [], authIds: [] }
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(ok ? 'PASS' : 'FAIL', name, detail)
}

function authStorageKey(supabaseUrl) {
  const host = new URL(supabaseUrl).hostname
  const ref = host.split('.')[0]
  return `sb-${ref}-auth-token`
}

try {
  const { data: svc } = await admin
    .from('services')
    .select('id, price_minor')
    .eq('is_active', true)
    .eq('is_archived', false)
    .gt('price_minor', 0)
    .limit(1)
    .single()

  const { data: booking, error: bErr } = await admin
    .from('bookings')
    .insert({
      customer_id: null,
      customer_name: 'Walk-in Banner QA',
      customer_phone: PHONE_SPACED,
      vehicle_plate: PLATE,
      vehicle_make: 'Honda',
      vehicle_model: 'City',
      vehicle_type: 'medium',
      service_id: svc.id,
      branch: 'bacoor',
      status: 'completed',
      price_minor: svc.price_minor,
      final_price_minor: svc.price_minor,
      scheduled_start: new Date().toISOString(),
      waiting_at: new Date().toISOString(),
      notes: 'QA history banner',
      is_archived: false,
    })
    .select('id')
    .single()
  if (bErr) throw bErr
  created.bookings.push(booking.id)

  const signed = await signupCustomer({
    body: {
      phone: PHONE,
      full_name: `Qa Banner ${stamp}`,
      plate: PLATE,
      date_of_birth: '1992-03-10',
      password: PASS,
      confirm: PASS,
      accepted_terms: true,
    },
    requestOrigin: base,
  })
  created.authIds.push(signed.user_id)
  check('signup existing_history', signed.existing_history === true, JSON.stringify(signed))

  const customer = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: sessionWrap, error: signErr } = await customer.auth.signInWithPassword({
    email: CUSTOMER_DEMO_ACCOUNT.email,
    password: CUSTOMER_DEMO_ACCOUNT.password,
  })
  if (signErr) throw new Error(`demo customer login: ${signErr.message}`)
  const session = sessionWrap.session
  check('demo customer session', Boolean(session?.access_token))

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 })
    const key = authStorageKey(url)
    await page.evaluate(
      (storageKey, sess, consent) => {
        localStorage.setItem('hakum-cookie-consent', consent)
        localStorage.setItem(storageKey, JSON.stringify(sess))
        sessionStorage.setItem('hakum-existing-history', '1')
      },
      key,
      session,
      'essential',
    )
    await page.goto(`${base}/account`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page
      .waitForFunction(() => !/^Loading/i.test((document.body?.innerText || '').trim()), { timeout: 30000 })
      .catch(() => null)
    await page.waitForSelector('p[role="status"], .capp', { timeout: 20000 }).catch(() => null)
    await new Promise((r) => setTimeout(r, 1000))

    const statusText = await page.evaluate(() => {
      const el = [...document.querySelectorAll('p[role="status"]')].find((p) =>
        /existing history/i.test(p.textContent || ''),
      )
      return el ? el.textContent.trim() : ''
    })
    const body = await page.evaluate(() => (document.body?.innerText || '').slice(0, 400))
    check('banner role=status present', Boolean(statusText), statusText || body)
    check('banner shows existing-history sentence', statusText === EXISTING_HISTORY_MESSAGE, statusText)
    await page.screenshot({ path: join(outDir, 'account-history-banner.png') })
  } finally {
    await browser.close()
  }
} catch (err) {
  check('script ran to completion', false, err.message)
  console.error(err)
} finally {
  if (created.bookings.length) await admin.from('bookings').delete().in('id', created.bookings)
  for (const id of created.authIds) {
    await admin.from('vehicles').delete().eq('customer_id', id)
    await admin.from('customers').delete().eq('id', id)
    await admin.auth.admin.deleteUser(id)
  }
  console.log('cleanup done')
}

const failed = results.filter((r) => !r.ok).length
console.log(`${results.length - failed}/${results.length} PASS`)
process.exit(failed ? 1 : 0)
