/** Shared Supabase access for the September 2026 seed + its verifier (service role from .env; never prints keys). */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    if (!process.env[k]) process.env[k] = line.slice(i + 1).replace(/^["']|["']$/g, '')
  }
}

export const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey) throw new Error('missing SUPABASE_URL / anon key / SUPABASE_SERVICE_ROLE_KEY')

const opts = { auth: { autoRefreshToken: false, persistSession: false } }
export const admin = createClient(url, serviceKey, opts)

export const SEED_PASSWORD = 'HakumSeed2026!'
export const ACCOUNTS = {
  ba: ['admin@hakumautocare.com', 'HakumAdmin2026!'],
  sa: ['bossmich@hakumautocare.com', 'HakumBoss2026!'],
  asa: ['assistant@hakumautocare.com', 'HakumAsa2026!'],
}
export const BATANGAS_SEED_STAFF = [
  { key: 'ba', email: 'ba.batangas@seed.hakum.test', full_name: 'Batangas Branch Admin (Seed)', role: 'admin' },
  { key: 'crew1', email: 'crew1.batangas@seed.hakum.test', full_name: 'Batangas Crew One (Seed)', role: 'staff' },
  { key: 'crew2', email: 'crew2.batangas@seed.hakum.test', full_name: 'Batangas Crew Two (Seed)', role: 'staff' },
  { key: 'detailer', email: 'detailer.batangas@seed.hakum.test', full_name: 'Batangas Detailer (Seed)', role: 'detailer' },
]
/** Same select as src/lib/dailySheetApi.js SALE_SELECT (the POS Daily sheet + Floor Board read this shape). */
export const SALE_SELECT =
  'id, branch, status, total_minor, discount_minor, payment_method, occurred_at, booking_id, bookings(services(name, pay_category)), sale_line_items(item_type, line_total_minor, name, quantity, service_id, product_id, services(name, slug, pay_category, salary_pct), products(name, tags, category))'

export const must = (res, what) => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

export async function login([email, password]) {
  const client = createClient(url, anonKey, opts)
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session) throw new Error(`login ${email}: ${error?.message}`)
  return client
}

/** Page through a PostgREST query 1000 rows at a time. */
export async function pageAll(build) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const data = must(await build().range(from, from + 999), 'page')
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

export async function loadCatalog() {
  const slugs = ['premium-car-wash', 'express-wash-package', 'hakum-custom-package', 'full-care-package', 'interior-detailing', 'full-exterior-detailing', 'glass-detailing', 'engine-wash', 'paint-maintenance', 'nano-ceramic-tint', 'ceramic-coating', 'paint-protection-film']
  const services = must(await admin.from('services').select('id, name, slug, service_size_prices(size_slug, price_minor)').in('slug', slugs), 'services')
  const catalog = { services: {}, products: [], accounts: {} }
  for (const s of services) {
    const prices = Object.fromEntries((s.service_size_prices || []).map((p) => [p.size_slug, p.price_minor]))
    for (const size of ['small', 'medium', 'large', 'extra_large']) if (!(prices[size] > 0)) throw new Error(`${s.slug} has no ${size} price`)
    catalog.services[s.slug] = { id: s.id, name: s.name, prices }
  }
  const missing = slugs.filter((s) => !catalog.services[s])
  if (missing.length) throw new Error(`missing services: ${missing.join(', ')}`)
  const products = must(await admin.from('products').select('id, name, price_minor').in('name', ['Interior Freshener', 'Microfiber Towel Pack', 'Ceramic Top-Up Kit']), 'products')
  if (products.length !== 3) throw new Error('expected 3 seed products')
  catalog.products = products
  const accounts = must(await admin.from('expense_categories').select('id, code').in('code', ['10', '12', '13', '16', '19']), 'accounts')
  catalog.accounts = Object.fromEntries(accounts.map((a) => [a.code, a.id]))
  return catalog
}

/** Seed Batangas staff ids by key (null when not created yet). */
export async function findBatangasStaff() {
  const rows = must(await admin.from('staff_profiles').select('id, login_email').in('login_email', BATANGAS_SEED_STAFF.map((s) => s.email)), 'seed staff')
  return Object.fromEntries(BATANGAS_SEED_STAFF.map((s) => [s.key, rows.find((r) => r.login_email === s.email)?.id || null]))
}

export async function loadStaff(batangas) {
  const rows = must(await admin.from('staff_profiles').select('id, full_name, role, branch_slug, login_email').eq('is_active', true).in('branch_slug', ['bacoor', 'batangas']), 'staff')
  const byEmail = (e) => rows.find((r) => r.login_email === e)?.id
  const of = (branch, role) => rows.filter((r) => r.branch_slug === branch && r.role === role && !String(r.login_email || '').endsWith('@seed.hakum.test'))
  const sa = must(await admin.from('staff_profiles').select('id').eq('login_email', ACCOUNTS.sa[0]).maybeSingle(), 'sa')
  const asa = must(await admin.from('staff_profiles').select('id').eq('login_email', ACCOUNTS.asa[0]).maybeSingle(), 'asa')
  const bacoor = {
    ba: byEmail(ACCOUNTS.ba[0]),
    tl: of('bacoor', 'team_lead')[0]?.id,
    crew: of('bacoor', 'staff').map((r) => r.id),
    detailer: of('bacoor', 'detailer')[0]?.id,
  }
  const batangasTeam = { ba: batangas.ba, tl: of('batangas', 'team_lead')[0]?.id, crew: [batangas.crew1, batangas.crew2], detailer: batangas.detailer }
  for (const [name, team] of Object.entries({ bacoor, batangas: batangasTeam })) {
    if (!team.ba || !team.tl || !team.crew.length || !team.detailer) throw new Error(`${name} team incomplete: ${JSON.stringify(team)}`)
  }
  return { sa: sa?.id, asa: asa?.id, bacoor, batangas: batangasTeam }
}
