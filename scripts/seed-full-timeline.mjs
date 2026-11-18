#!/usr/bin/env node
/**
 * June 2025 – November 2026 Full-System Seed CLI (18 months, all 11 staff roles + customer).
 *
 * Usage:
 *   node scripts/seed-full-timeline.mjs                  # DRY RUN: prints full 18-month plan & role summary, touches nothing
 *   node scripts/seed-full-timeline.mjs --include-sep    # DRY RUN including September 2026 daily ops
 *   node scripts/seed-full-timeline.mjs --days=30        # DRY RUN with every calendar day per month
 *   node scripts/seed-full-timeline.mjs --apply          # Writes the [seed:jun2025-nov2026] dataset to Supabase
 *
 * Cleanup:
 *   Run scripts/seed/wipe-full-timeline.sql in Supabase SQL editor.
 */

import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import {
  FULL_TIMELINE_TAG,
  FULL_TIMELINE_MONTHS,
  ALL_SYSTEM_ROLES,
  buildFullTimelinePlan,
} from './seed/fullTimelinePlan.mjs'
import { loadCatalog } from './seed/september2026Db.mjs'

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  }
}

/** PostgREST requires uniform object keys across every row in a bulk batch. */
function uniform(rows) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  return rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] === undefined ? null : r[k]])))
}

async function insertRows(db, table, rows, { chunkSize = 350, upsert = null } = {}) {
  if (!rows?.length) return
  const normalized = uniform(rows)
  for (let i = 0; i < normalized.length; i += chunkSize) {
    const chunk = normalized.slice(i, i + chunkSize)
    const query = upsert ? db.from(table).upsert(chunk, upsert) : db.from(table).insert(chunk)
    const { error } = await query
    if (error) throw new Error(`${table} insert (${i}..${i + chunk.length}): ${error.message}`)
  }
}

const pesos = (minor) =>
  `₱${(minor / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function parseArgs(argv) {
  const apply = argv.includes('--apply')
  const includeSep = argv.includes('--include-sep')
  const daysArg = argv.find((a) => a.startsWith('--days='))
  const daysPerMonth = daysArg ? Math.max(1, Math.min(31, Number(daysArg.split('=')[1]) || 6)) : 6
  return { apply, includeSep, daysPerMonth }
}

export function buildSyntheticCatalogAndStaff() {
  const priceMap = (s, m, l, xl) => ({ small: s, medium: m, large: l, extra_large: xl })
  const catalog = {
    services: {
      'express-wash-package': { id: 'svc-express', name: 'Express Wash Package', pay_category: 'package', prices: priceMap(18000, 22000, 26000, 30000) },
      'premium-car-wash': { id: 'svc-premium', name: 'Premium Car Wash', pay_category: 'carwash', prices: priceMap(25000, 30000, 35000, 42000) },
      'engine-wash': { id: 'svc-engine', name: 'Engine Wash', pay_category: 'carwash', prices: priceMap(35000, 40000, 45000, 50000) },
      'full-care-package': { id: 'svc-full-care', name: 'Full Care Package', pay_category: 'package', prices: priceMap(65000, 75000, 85000, 95000) },
      'hakum-custom-package': { id: 'svc-custom', name: 'Hakum Custom Package', pay_category: 'package', prices: priceMap(85000, 95000, 110000, 130000) },
      'interior-detailing': { id: 'svc-int-det', name: 'Interior Detailing', pay_category: 'detailing', prices: priceMap(350000, 420000, 500000, 580000) },
      'full-exterior-detailing': { id: 'svc-ext-det', name: 'Full Exterior Detailing', pay_category: 'detailing', prices: priceMap(450000, 550000, 650000, 750000) },
      'paint-maintenance': { id: 'svc-paint-maint', name: 'Ceramic Paint Maintenance', pay_category: 'detailing', prices: priceMap(250000, 260000, 280000, 300000) },
      'glass-detailing': { id: 'svc-glass-det', name: 'Glass Detailing', pay_category: 'detailing', prices: priceMap(180000, 200000, 220000, 250000) },
      'ceramic-coating': { id: 'svc-ceramic', name: 'Ultimate Ceramic Coating', pay_category: 'detailing', prices: priceMap(1650000, 1950000, 2150000, 2400000) },
      'paint-protection-film': { id: 'svc-ppf', name: 'Front PPF + Coating Package', pay_category: 'ppf', prices: priceMap(4800000, 5500000, 5500000, 6000000) },
      'nano-ceramic-tint': { id: 'svc-tint', name: 'Nano Ceramic Tint', pay_category: 'detailing', prices: priceMap(550000, 650000, 750000, 850000) },
    },
    products: [
      { id: 'prod-1', name: 'Hakum Air Freshener', price_minor: 15000 },
      { id: 'prod-2', name: 'Microfiber Drying Towel', price_minor: 35000 },
      { id: 'prod-3', name: 'Ceramic Quick Detailer Spray', price_minor: 65000 },
      { id: 'prod-4', name: 'Iced Americano (Lounge)', price_minor: 12000 },
    ],
    accounts: {
      10: 'acct-10-meals',
      11: 'acct-11-apparel',
      12: 'acct-12-chemicals',
      13: 'acct-13-supplies',
      14: 'acct-14-salaries',
      15: 'acct-15-equipment',
      16: 'acct-16-repairs',
      17: 'acct-17-marketing',
      19: 'acct-19-utilities',
    },
    compensationSettings: {
      wash_pool_pct: 35,
      ceramic_crew_solo_pct: 20,
      ceramic_crew_split_pct: 10,
      ceramic_detailer_split_pct: 10,
      attendance_present_weight: 1,
      attendance_late_weight: 0.7,
    },
  }
  const staff = {
    sa: 'staff-sa-bossmich',
    asa: 'staff-asa-lucy',
    operationsLead: 'staff-ops-lead',
    sales: 'staff-sales-exec',
    marketing: 'staff-marketing-lead',
    videoEditor: 'staff-video-editor',
    investor: 'staff-investor',
    namesById: {
      'staff-bacoor-wtl-1': 'Jaycee',
      'staff-bacoor-wtl-2': 'Ronnel',
      'staff-bacoor-dtl-1': 'TL Test Account',
      'staff-bacoor-det-1': 'Demo Detailer',
      'staff-bacoor-crew-1': 'Crew One',
      'staff-bacoor-crew-2': 'Crew Two',
      'staff-bacoor-crew-3': 'Crew Bacoor Three',
      'staff-batangas-wtl-1': 'Kyle',
      'staff-batangas-dtl-1': 'Rex',
      'staff-batangas-det-1': 'Batangas Detailer',
      'staff-batangas-crew-1': 'Crew Three',
      'staff-batangas-crew-2': 'Batangas Crew Two',
    },
    dailyRatesById: {},
    bacoor: {
      ba: 'staff-bacoor-ba',
      washTl: ['staff-bacoor-wtl-1', 'staff-bacoor-wtl-2'],
      detailTl: ['staff-bacoor-dtl-1'],
      detailers: ['staff-bacoor-det-1'],
      crew: ['staff-bacoor-crew-1', 'staff-bacoor-crew-2', 'staff-bacoor-crew-3'],
    },
    batangas: {
      ba: 'staff-batangas-ba',
      washTl: ['staff-batangas-wtl-1'],
      detailTl: ['staff-batangas-dtl-1'],
      detailers: ['staff-batangas-det-1'],
      crew: ['staff-batangas-crew-1', 'staff-batangas-crew-2'],
    },
  }
  return { catalog, staff }
}

async function loadLiveStaffRoster(db) {
  const { data: profiles, error } = await db
    .from('staff_profiles')
    .select('id, full_name, role, branch_slug, monthly_salary_minor, daily_rate_minor, is_active, is_archived')
    .eq('is_active', true)
  if (error) throw new Error(`staff_profiles load: ${error.message}`)
  const active = (profiles || []).filter((p) => !p.is_archived)
  const byRole = (role) => active.find((p) => p.role === role)?.id || null
  const byBranchRole = (branch, role) =>
    active.filter((p) => p.branch_slug === branch && p.role === role).map((p) => p.id)

  const sa = byRole('BossMich')
  const asa = byRole('assistant_super_admin') || sa

  const buildBranchTeam = (branch) => {
    const admins = byBranchRole(branch, 'admin')
    const tls = byBranchRole(branch, 'team_lead')
    const detailers = byBranchRole(branch, 'detailer')
    const crew = byBranchRole(branch, 'staff')
    return {
      ba: admins[0] || sa,
      washTl: tls.length ? tls.slice(0, 2) : [sa],
      detailTl: tls.length > 1 ? [tls[tls.length - 1]] : tls.length ? [tls[0]] : [sa],
      detailers: detailers.length ? detailers : [sa],
      crew: crew.length ? crew : [sa],
    }
  }

  const defaultSalaryByRole = {
    assistant_super_admin: 2600000,
    operations_lead: 2400000,
    sales: 2000000,
    marketing: 2000000,
    video_editor: 1900000,
    admin: 1800000,
  }
  const officeRoles = Object.keys(defaultSalaryByRole)
  const officeRoster = active
    .filter((p) => officeRoles.includes(p.role) && !/\(Seed\)/i.test(p.full_name || ''))
    .map((p) => ({
      id: p.id,
      role: p.role,
      branch_slug: p.branch_slug === 'batangas' ? 'batangas' : 'bacoor',
      monthly_salary_minor:
        Number(p.monthly_salary_minor) > 0
          ? Number(p.monthly_salary_minor)
          : defaultSalaryByRole[p.role] || 1800000,
      full_name: p.full_name || p.role,
    }))

  return {
    sa,
    asa,
    operationsLead: byRole('operations_lead') || sa,
    sales: byRole('sales') || sa,
    marketing: byRole('marketing') || sa,
    videoEditor: byRole('video_editor') || sa,
    investor: byRole('investor') || sa,
    namesById: Object.fromEntries(active.map((p) => [p.id, p.full_name])),
    dailyRatesById: Object.fromEntries(
      active.map((p) => [p.id, Number(p.daily_rate_minor) > 0 ? Number(p.daily_rate_minor) : 45000]),
    ),
    bacoor: buildBranchTeam('bacoor'),
    batangas: buildBranchTeam('batangas'),
    officeRoster: officeRoster.length ? officeRoster : undefined,
  }
}

async function enrichLiveCatalog(db, baseCatalog) {
  const [svcRes, prodRes, acctRes, tierRes, compRes, boardRes, listRes, catRes, formRes] = await Promise.all([
    db.from('services').select('id, slug, pay_category'),
    db.from('products').select('id, name, price_minor, is_active, stock_category').eq('is_active', true),
    db.from('expense_categories').select('id, code, name'),
    db.from('membership_tiers').select('id, name, discount_percent').eq('is_active', true),
    db.from('compensation_settings').select('*').eq('id', 1).maybeSingle(),
    db.from('plan_boards').select('id, name').eq('name', 'Planner').maybeSingle(),
    db.from('plan_lists').select('id, board_id, title, position').order('position'),
    db.from('plan_categories').select('id, name').order('position'),
    db.from('ops_forms').select('id, slug, kind, is_active').eq('is_active', true),
  ])

  const svcMeta = new Map((svcRes.data || []).map((s) => [s.slug, s]))
  for (const [slug, svc] of Object.entries(baseCatalog.services)) {
    const m = svcMeta.get(slug)
    if (m) svc.pay_category = m.pay_category
  }

  const posProducts = (prodRes.data || []).filter((p) => Number(p.price_minor) > 0)
  if (posProducts.length) baseCatalog.products = posProducts

  const acctMap = { ...baseCatalog.accounts }
  for (const a of acctRes.data || []) {
    if (a.code) acctMap[String(a.code)] = a.id
  }
  baseCatalog.accounts = acctMap
  if (tierRes.data?.length) baseCatalog.membershipTiers = tierRes.data
  if (compRes.data) baseCatalog.compensationSettings = compRes.data

  const plannerBoardId = boardRes.data?.id
  baseCatalog.planLists = (listRes.data || []).filter((l) => !plannerBoardId || l.board_id === plannerBoardId)
  baseCatalog.planCategories = catRes.data || []
  baseCatalog.opsForms = formRes.data || []
  return baseCatalog
}

async function main() {
  loadEnv()
  const { apply, includeSep, daysPerMonth } = parseArgs(process.argv.slice(2))
  const skipOpsMonths = includeSep ? [] : ['2026-09']

  let db = null
  let catalog = null
  let staff = null
  let existingSheetKeys = []
  let existingAttendanceKeys = []

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (url && key) {
    db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const baseCatalog = await loadCatalog(db)
    catalog = await enrichLiveCatalog(db, baseCatalog)
    staff = await loadLiveStaffRoster(db)

    const [{ data: sheetKeys }, { data: attKeys }] = await Promise.all([
      db.from('daily_sheets').select('branch, business_date'),
      db.from('staff_attendance').select('staff_id, attendance_date'),
    ])
    existingSheetKeys = (sheetKeys || []).map((s) => `${s.branch}:${s.business_date}`)
    existingAttendanceKeys = (attKeys || []).map((a) => `${a.staff_id}:${a.attendance_date}`)
  } else {
    if (apply) {
      throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for --apply')
    }
    const syn = buildSyntheticCatalogAndStaff()
    catalog = syn.catalog
    staff = syn.staff
  }

  const plan = buildFullTimelinePlan({
    catalog,
    staff,
    months: FULL_TIMELINE_MONTHS,
    skipOpsMonths,
    existingSheetKeys,
    existingAttendanceKeys,
    daysPerMonth,
    maxDate: '2026-11-18',
  })

  const e = plan.expected
  console.log(`\nJune 2025 – November 2026 Full-System Seed Plan  (${apply ? 'APPLY' : 'DRY RUN'})  tag=${FULL_TIMELINE_TAG}`)
  console.log(`  Timeline:         ${FULL_TIMELINE_MONTHS[0]} .. ${FULL_TIMELINE_MONTHS[FULL_TIMELINE_MONTHS.length - 1]} (${e.monthsCovered} months, ${e.opsMonthsSeeded} ops months, ${daysPerMonth} sample days/mo/branch)`)
  console.log(`  Roles covered:    ${ALL_SYSTEM_ROLES.join(', ')}`)
  console.log(`  Customers:        ${e.customers} (notify_sms=false on 100%) · Vehicles: ${e.vehicles} · Memberships: ${e.customerMemberships}`)
  console.log(`  Loyalty & CRM:    ${e.loyaltyLedger} ledger · ${e.customerReferrals} referrals · ${e.birthdayPerks} bday perks · ${e.customerNotes} notes`)
  console.log(`  Queue & Bookings: ${e.bookings} bookings · ${e.attendance} attendance rows · ${e.maintenance} maintenance schedules`)
  console.log(`  POS Sales:        ${e.sales.paid} paid (${pesos(e.netSalesMinor)}) · ${e.sales.refunded} refunded · ${e.sales.voided} voided · ${e.saleLines} line items`)
  console.log(`  Daily Sheets:     ${e.sheets} sheets · ${e.sheetLines} lines · ${e.dailySheetExpenses} posted expenses · ${e.bills} monthly bills`)
  console.log(`  Office Payroll:   ${e.payslips} payslips (${pesos(e.payrollTotalMinor)}) · ${e.payrollLocks} locked periods`)
  console.log(`  Ops & Governance: ${e.planCards} planner cards · ${e.opsFormSubmissions} forms · ${e.restockRequests} restocks · ${e.inventoryRecons} recons · ${e.contactInquiries} inquiries · ${e.serviceReviews} reviews\n`)

  if (!apply) {
    console.log('Dry run complete — pass --apply to write to Supabase.')
    return
  }

  const { count: existingBookingCount, error: guardErr } = await db
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .like('notes', `%${FULL_TIMELINE_TAG}%`)
  if (guardErr) throw new Error(`bookings guard check: ${guardErr.message}`)

  const { count: existingSaleCount } = await db
    .from('sales')
    .select('id', { count: 'exact', head: true })
    .like('notes', `%${FULL_TIMELINE_TAG}%`)
  if (existingSaleCount > 0 && !process.argv.includes('--resume')) {
    throw new Error(
      `Found ${existingSaleCount} existing ${FULL_TIMELINE_TAG} sale(s). Pass --resume or run scripts/seed/wipe-full-timeline.sql first.`,
    )
  }

  console.log('1/7 Checking & inserting customers, vehicles, memberships, notes & referrals...')
  const { data: existingCusts } = await db
    .from('customers')
    .select('id, email')
    .like('email', '%@seed.hakumautocare.local')
    .limit(2000)

  if (existingCusts && existingCusts.length >= plan.customers.length) {
    console.log(`  Reusing ${existingCusts.length} existing seed customers & their vehicles...`)
    const existingIds = existingCusts.map((c) => c.id)
    const existingVehs = []
    for (let i = 0; i < existingIds.length; i += 150) {
      const chunk = existingIds.slice(i, i + 150)
      const { data: vChunk } = await db
        .from('vehicles')
        .select('id, customer_id, plate_number')
        .in('customer_id', chunk)
      if (vChunk?.length) existingVehs.push(...vChunk)
      await db.from('customers').update({ is_archived: false }).in('id', chunk)
    }

    const custIdByEmail = new Map(existingCusts.map((c) => [c.email, c.id]))
    const vehIdByPlate = new Map(existingVehs.map((v) => [v.plate_number, v.id]))
    const cMap = new Map(plan.customers.map((c) => [c.id, custIdByEmail.get(c.email) || c.id]))
    const vMap = new Map(plan.vehicles.map((v) => [v.id, vehIdByPlate.get(v.plate_number) || v.id]))
    const remapCust = (idVal) => (idVal ? cMap.get(idVal) || idVal : idVal)
    const remapVeh = (idVal) => (idVal ? vMap.get(idVal) || idVal : idVal)
    for (const r of plan.bookings) {
      r.customer_id = remapCust(r.customer_id)
      r.vehicle_id = remapVeh(r.vehicle_id)
    }
    for (const r of plan.maintenance) {
      r.customer_id = remapCust(r.customer_id)
      r.vehicle_id = remapVeh(r.vehicle_id)
    }
    for (const r of plan.sales) r.customer_id = remapCust(r.customer_id)
    for (const r of plan.loyaltyLedger) r.customer_id = remapCust(r.customer_id)
    for (const r of plan.serviceReviews) r.customer_id = remapCust(r.customer_id)
  } else {
    await insertRows(db, 'customers', plan.customers, { upsert: { onConflict: 'id' } })
    await insertRows(db, 'vehicles', plan.vehicles, { upsert: { onConflict: 'id', ignoreDuplicates: true } })
    await insertRows(db, 'customer_memberships', plan.customerMemberships, { upsert: { onConflict: 'id', ignoreDuplicates: true } })
    await insertRows(db, 'customer_notes', plan.customerNotes, { upsert: { onConflict: 'id', ignoreDuplicates: true } })
    await insertRows(db, 'customer_referrals', plan.customerReferrals, { upsert: { onConflict: 'id', ignoreDuplicates: true } })
    await insertRows(db, 'customer_referral_rewards', plan.customerReferralRewards, { upsert: { onConflict: 'id', ignoreDuplicates: true } })
    await insertRows(db, 'customer_birthday_perks', plan.birthdayPerks, { upsert: { onConflict: 'id', ignoreDuplicates: true } })
  }

  console.log('2/7 Checking & inserting attendance, bookings, queue assignments/events & maintenance...')
  await insertRows(db, 'staff_attendance', plan.attendance, {
    upsert: { onConflict: 'staff_id,attendance_date', ignoreDuplicates: true },
  })
  if (existingBookingCount >= plan.bookings.length) {
    console.log(`  Reusing ${existingBookingCount} existing seed bookings...`)
    const existingBks = []
    for (let from = 0; ; from += 1000) {
      const { data: bChunk, error: bErr } = await db
        .from('bookings')
        .select('id, branch, queue_date, queue_number, vehicle_plate, notes')
        .like('notes', `%${FULL_TIMELINE_TAG}%`)
        .range(from, from + 999)
      if (bErr) throw new Error(`bookings load: ${bErr.message}`)
      if (!bChunk?.length) break
      existingBks.push(...bChunk)
      if (bChunk.length < 1000) break
    }
    const bkKey = (b) => `${b.branch}|${b.queue_date}|${b.queue_number}|${b.vehicle_plate}`
    const liveBkMap = new Map(existingBks.map((b) => [bkKey(b), b.id]))
    const bkRemap = new Map(plan.bookings.map((b) => [b.id, liveBkMap.get(bkKey(b)) || b.id]))
    const remapBk = (idVal) => (idVal ? bkRemap.get(idVal) || idVal : idVal)
    for (const r of plan.queueAssignments) r.booking_id = remapBk(r.booking_id)
    for (const r of plan.queueEvents) r.booking_id = remapBk(r.booking_id)
    for (const r of plan.maintenance) r.booking_id = remapBk(r.booking_id)
    for (const r of plan.sales) r.booking_id = remapBk(r.booking_id)
    for (const r of plan.serviceReviews) r.booking_id = remapBk(r.booking_id)
  } else {
    await insertRows(db, 'bookings', plan.bookings, { chunkSize: 200, upsert: { onConflict: 'id', ignoreDuplicates: true } })
  }
  await insertRows(db, 'queue_assignments', plan.queueAssignments, { upsert: { onConflict: 'id', ignoreDuplicates: true } })
  await insertRows(db, 'queue_events', plan.queueEvents, { chunkSize: 500, upsert: { onConflict: 'id', ignoreDuplicates: true } })
  await insertRows(db, 'vehicle_maintenance_schedules', plan.maintenance, { upsert: { onConflict: 'id', ignoreDuplicates: true } })

  console.log('3/7 Inserting POS sales, line items & loyalty ledger...')
  await insertRows(db, 'sales', plan.sales, { upsert: { onConflict: 'id', ignoreDuplicates: true } })
  await insertRows(db, 'sale_line_items', plan.saleLines, { chunkSize: 500, upsert: { onConflict: 'id', ignoreDuplicates: true } })
  await insertRows(db, 'loyalty_ledger', plan.loyaltyLedger, { chunkSize: 500, upsert: { onConflict: 'id', ignoreDuplicates: true } })

  console.log('4/7 Inserting daily sheets, lines & posted daily expenses/salaries...')
  await insertRows(db, 'daily_sheets', plan.dailySheets, { upsert: { onConflict: 'id', ignoreDuplicates: true } })
  await insertRows(db, 'daily_sheet_lines', plan.dailySheetLines, { chunkSize: 500, upsert: { onConflict: 'id', ignoreDuplicates: true } })
  await insertRows(db, 'expenses', plan.dailySheetExpenses, { chunkSize: 500, upsert: { onConflict: 'id', ignoreDuplicates: true } })

  console.log('5/7 Inserting monthly bills & semi-monthly office payroll (payslips, expenses, locks)...')
  await insertRows(db, 'expenses', plan.bills, { upsert: { onConflict: 'id', ignoreDuplicates: true } })
  await insertRows(db, 'payslips', plan.payslips, {
    upsert: { onConflict: 'staff_id,period_start,period_end', ignoreDuplicates: true },
  })
  await insertRows(db, 'expenses', plan.payrollExpenses, { upsert: { onConflict: 'id', ignoreDuplicates: true } })
  await insertRows(db, 'payroll_period_locks', plan.payrollLocks, {
    upsert: { onConflict: 'branch,period_start,period_end', ignoreDuplicates: true },
  })

  console.log('6/7 Inserting planner cards, assignees, form submissions, inquiries, restocks, recons, reviews & broadcasts...')
  await insertRows(db, 'plan_cards', plan.planCards, { upsert: { onConflict: 'id', ignoreDuplicates: true } })
  await insertRows(db, 'plan_card_assignees', plan.planCardAssignees, { upsert: { onConflict: 'id', ignoreDuplicates: true } })
  await insertRows(db, 'ops_form_submissions', plan.opsFormSubmissions, { upsert: { onConflict: 'id', ignoreDuplicates: true } })
  await insertRows(db, 'contact_inquiries', plan.contactInquiries, { upsert: { onConflict: 'id', ignoreDuplicates: true } })
  await insertRows(db, 'restock_requests', plan.restockRequests, { upsert: { onConflict: 'id', ignoreDuplicates: true } })
  await insertRows(db, 'inventory_recons', plan.inventoryRecons, { upsert: { onConflict: 'id', ignoreDuplicates: true } })
  await insertRows(db, 'inventory_recon_lines', plan.inventoryReconLines, { upsert: { onConflict: 'id', ignoreDuplicates: true } })
  await insertRows(db, 'service_reviews', plan.serviceReviews, { upsert: { onConflict: 'id', ignoreDuplicates: true } })
  await insertRows(db, 'notification_broadcasts', plan.notificationBroadcasts, { upsert: { onConflict: 'id', ignoreDuplicates: true } })

  console.log('\n7/7 Done! Full June 2025 – November 2026 seed applied to Supabase.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('\nSEED FAILED:', err.message)
    process.exit(1)
  })
}
