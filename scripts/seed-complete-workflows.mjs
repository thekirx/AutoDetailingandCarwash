#!/usr/bin/env node
/**
 * Completes the 18-month calendar, live Today (2026-11-18) floor/attendance/queue/detailing
 * workflows, Finance vendors/bills/waiting sheets, Complaints, Rewards redemptions,
 * Inventory stock movements, and Demo Customer portal state.
 *
 * Uses [seed:jun2025-nov2026] tag and deterministic 00202611-... UUIDs. Zero outbound SMS.
 *
 * Usage:
 *   node scripts/seed-complete-workflows.mjs           # DRY RUN
 *   node scripts/seed-complete-workflows.mjs --apply   # Apply to Supabase
 */

import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { computeSheetTotals, suggestSalaries } from '../src/lib/dailySheet.js'
import {
  FULL_TIMELINE_TAG,
  makeUuidFactory,
  mulberry32,
  manilaAt,
  plusMinutes,
  tagTimeline,
} from './seed/fullTimelinePlan.mjs'
import { loadCatalog } from './seed/september2026Db.mjs'

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const idx = line.indexOf('=')
      if (idx > 0) {
        const k = line.slice(0, idx).trim()
        const v = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
        if (/^[A-Z0-9_]+$/.test(k) && !process.env[k]) process.env[k] = v
      }
    }
  }
}

function uniform(rows) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  return rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] === undefined ? null : r[k]])))
}

async function upsertRows(db, table, rows, { chunkSize = 350, onConflict = 'id', ignoreDuplicates = true } = {}) {
  if (!rows?.length) return
  const normalized = uniform(rows)
  for (let i = 0; i < normalized.length; i += chunkSize) {
    const chunk = normalized.slice(i, i + chunkSize)
    const { error } = await db.from(table).upsert(chunk, { onConflict, ignoreDuplicates })
    if (error) throw new Error(`${table} upsert (${i}..${i + chunk.length}): ${error.message}`)
  }
}

const DEMO_CUSTOMER_ID = '413c4487-2dfb-4e5f-8667-67f8e251f186'
const TODAY = '2026-11-18'

const EXTRA_DAYS_PER_MONTH = [4, 8, 9, 12, 14, 17, 18, 21, 22, 24, 27, 28]
const EXTRA_NOV_DAYS = ['2026-11-01', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-16', '2026-11-17']

function lineKindForService(slug, payCategory) {
  const s = String(slug || '').toLowerCase()
  const cat = String(payCategory || '').toLowerCase()
  if (cat === 'ppf' || s === 'paint-protection-film' || s.includes('ppf')) return 'ppf'
  if (['ceramic-coating', 'paint-maintenance', 'nano-ceramic-tint'].includes(s) || cat === 'detailing') {
    return 'detailing'
  }
  if (cat === 'package' || s.includes('package')) return 'package'
  return 'service'
}

function buildExtraOperatingDaysList() {
  const days = []
  const months = [
    '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
    '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-10',
  ]
  for (const ym of months) {
    const [y, m] = ym.split('-').map(Number)
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
    for (const d of EXTRA_DAYS_PER_MONTH) {
      if (d <= last) days.push(`${ym}-${String(d).padStart(2, '0')}`)
    }
  }
  days.push(...EXTRA_NOV_DAYS)
  return days
}

async function main() {
  loadEnv()
  const apply = process.argv.includes('--apply')
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const baseCatalog = await loadCatalog(db)

  const [
    svcRes,
    prodRes,
    acctRes,
    tierRes,
    compRes,
    staffRes,
    custRes,
    vehRes,
    sheetRes,
    attRes,
    voucherRes,
    existingVendorsRes,
    todayBkCountRes,
    sampleBksRes,
  ] = await Promise.all([
    db.from('services').select('id, slug, pay_category'),
    db.from('products').select('id, name, price_minor, points_price, is_active, stock_category').eq('is_active', true),
    db.from('expense_categories').select('id, code, name'),
    db.from('membership_tiers').select('id, name, discount_percent').eq('is_active', true),
    db.from('compensation_settings').select('*').eq('id', 1).maybeSingle(),
    db.from('staff_profiles').select('id, full_name, role, branch_slug, daily_rate_minor, is_active, is_archived').eq('is_active', true),
    db.from('customers').select('id, full_name, email, phone, loyalty_points').eq('is_archived', false).order('created_at', { ascending: false }).limit(800),
    db.from('vehicles').select('id, customer_id, plate_number, vehicle_make, vehicle_model, vehicle_year, vehicle_type').eq('is_archived', false).limit(1000),
    db.from('daily_sheets').select('branch, business_date'),
    db.from('staff_attendance').select('staff_id, attendance_date'),
    db.from('promo_vouchers').select('id, code, title, discount_percent, max_uses, uses_count').eq('is_active', true),
    db.from('vendors').select('id, name'),
    db.from('bookings').select('id', { count: 'exact', head: true }).eq('queue_date', TODAY).like('notes', `%${FULL_TIMELINE_TAG}%`),
    db.from('bookings').select('id, customer_id, branch, queue_date').eq('status', 'completed').like('notes', `%${FULL_TIMELINE_TAG}%`).order('created_at', { ascending: false }).limit(20),
  ])

  for (const [slug, svc] of Object.entries(baseCatalog.services)) {
    const meta = (svcRes.data || []).find((s) => s.slug === slug)
    if (meta) svc.pay_category = meta.pay_category
  }
  const products = (prodRes.data || []).filter((p) => Number(p.price_minor) > 0)
  const accounts = Object.fromEntries((acctRes.data || []).filter((a) => a.code).map((a) => [String(a.code), a.id]))
  const salaryAcctId = accounts['14']
  const compSettings = compRes.data || {}
  const activeStaff = (staffRes.data || []).filter((p) => !p.is_archived)
  const namesById = Object.fromEntries(activeStaff.map((p) => [p.id, p.full_name]))
  const dailyRatesById = Object.fromEntries(activeStaff.map((p) => [p.id, Number(p.daily_rate_minor) > 0 ? Number(p.daily_rate_minor) : 45000]))

  const saId = activeStaff.find((p) => p.role === 'BossMich')?.id
  const asaId = activeStaff.find((p) => p.role === 'assistant_super_admin')?.id || saId
  const branchTeam = (branch) => {
    const ba = activeStaff.find((p) => p.branch_slug === branch && p.role === 'admin')?.id || saId
    const tls = activeStaff.filter((p) => p.branch_slug === branch && p.role === 'team_lead').map((p) => p.id)
    const detailers = activeStaff.filter((p) => p.branch_slug === branch && p.role === 'detailer').map((p) => p.id)
    const crew = activeStaff.filter((p) => p.branch_slug === branch && p.role === 'staff').map((p) => p.id)
    return {
      ba,
      washTl: tls.slice(0, 2).length ? tls.slice(0, 2) : [saId],
      detailTl: tls.length ? [tls[tls.length - 1]] : [saId],
      detailers: detailers.length ? detailers : [saId],
      crew: crew.length ? crew : [saId],
    }
  }
  const teams = { bacoor: branchTeam('bacoor'), batangas: branchTeam('batangas') }

  // Index customers + their primary vehicle
  const vehByCust = new Map()
  for (const v of vehRes.data || []) {
    if (!vehByCust.has(v.customer_id)) vehByCust.set(v.customer_id, v)
  }
  const usableCustomers = (custRes.data || [])
    .filter((c) => vehByCust.has(c.id))
    .map((c) => ({ customer: c, vehicle: vehByCust.get(c.id) }))
  const demoEntry = usableCustomers.find((u) => u.customer.id === DEMO_CUSTOMER_ID) || usableCustomers[0]

  const existingSheetSet = new Set((sheetRes.data || []).map((s) => `${s.branch}:${s.business_date}`))
  const existingAttSet = new Set((attRes.data || []).map((a) => `${a.staff_id}:${a.attendance_date}`))

  const rand = mulberry32(0x20261118)
  const id = makeUuidFactory(0x202611)
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1))
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]

  // 1. Real Vendors & Monthly Bill Links
  const vendorDefs = [
    { key: 'rent_bacoor', name: 'Bacoor Commercial Holdings Inc.', contact: 'leasing@bacoorholdings.ph', notes: tagTimeline('Bacoor branch property lease') },
    { key: 'rent_batangas', name: 'Batangas Shop Properties Corp.', contact: 'admin@batangasrealty.ph', notes: tagTimeline('Batangas branch property lease') },
    { key: 'power', name: 'Meralco / Batangas II Electric Cooperative', contact: 'billing@utility-grid.ph', notes: tagTimeline('Monthly branch electricity') },
    { key: 'fiber', name: 'PLDT Enterprise Fiber', contact: 'enterprise@pldt.com.ph', notes: tagTimeline('Branch POS & CCTV fiber internet') },
    { key: 'chemicals', name: "ClearPro & Meguiar's PH Supply", contact: 'orders@detailingsupply.ph', notes: tagTimeline('Coating, PPF & wash chemical supplier') },
    { key: 'meta', name: 'Meta Business Ads PH', contact: 'ads-billing@meta.com', notes: tagTimeline('Facebook & Instagram performance ads') },
  ]
  const existingVendorByName = new Map((existingVendorsRes.data || []).map((v) => [v.name, v.id]))
  const vendorIds = {}
  const vendorsToInsert = []
  for (const vd of vendorDefs) {
    if (existingVendorByName.has(vd.name)) {
      vendorIds[vd.key] = existingVendorByName.get(vd.name)
    } else {
      const vid = id()
      vendorIds[vd.key] = vid
      vendorsToInsert.push({ id: vid, name: vd.name, contact: vd.contact, notes: vd.notes, is_active: true })
    }
  }

  // 2. Plan additional operating days + Nov 1-17 + Live Today (2026-11-18)
  const plan = {
    vendors: vendorsToInsert,
    attendance: [],
    bookings: [],
    queueAssignments: [],
    queueEvents: [],
    sales: [],
    saleLines: [],
    loyaltyLedger: [],
    dailySheets: [],
    dailySheetLines: [],
    dailySheetExpenses: [],
    complaints: [],
    accessoryRedemptions: [],
    promoVoucherRedemptions: [],
    stockMovements: [],
    demoMemberships: [],
  }

  const addAtt = (staffId, branch, date, roleName, status, min) => {
    const key = `${staffId}:${date}`
    const fullName = namesById[staffId] || roleName
    const rec = {
      staff_id: staffId,
      full_name: fullName,
      role: roleName,
      status,
      checked_in_at: manilaAt(date, min),
      daily_rate_minor: dailyRatesById[staffId] || 45000,
    }
    if (!existingAttSet.has(key)) {
      existingAttSet.add(key)
      plan.attendance.push({
        id: id(),
        staff_id: staffId,
        branch_slug: branch,
        attendance_date: date,
        status,
        checked_in_at: manilaAt(date, min),
        checked_out_at: date === TODAY ? null : manilaAt(date, 19 * 60),
        marked_by: teams[branch].ba,
        source: 'manual',
        notes: tagTimeline(`Attendance ${date}`),
        created_at: manilaAt(date, min),
      })
    }
    return rec
  }

  const pushCompletedTicket = ({ branch, date, qNum, startMin, slug, entry, tlId, crewId, roleKind, atDone = true }) => {
    const svc = baseCatalog.services[slug]
    const size = ['small', 'medium', 'large', 'extra_large'].includes(entry.vehicle.vehicle_type) ? entry.vehicle.vehicle_type : 'medium'
    const price = svc.prices[size]
    const createdAt = manilaAt(date, startMin)
    const inProgAt = plusMinutes(createdAt, 6)
    const checkAt = plusMinutes(inProgAt, roleKind === 'detailing' ? 240 : 25)
    const payAt = plusMinutes(checkAt, 5)
    const doneAt = plusMinutes(payAt, 4)
    const team = teams[branch]

    const bkId = id()
    plan.bookings.push({
      id: bkId,
      branch,
      customer_id: entry.customer.id,
      service_id: svc.id,
      vehicle_id: entry.vehicle.id,
      customer_name: entry.customer.full_name,
      customer_email: entry.customer.email,
      customer_phone: entry.customer.phone,
      vehicle_make: entry.vehicle.vehicle_make,
      vehicle_model: entry.vehicle.vehicle_model,
      vehicle_year: entry.vehicle.vehicle_year || 2022,
      vehicle_plate: entry.vehicle.plate_number,
      vehicle_type: size,
      scheduled_start: createdAt,
      queue_date: date,
      queue_number: qNum,
      status: 'completed',
      referral_source: pick(['social_media', 'facebook_ads', 'facebook_page', 'talked_to_employee']),
      referred_by_name: null,
      notes: tagTimeline(`Completed ${svc.name} (${date})`),
      created_at: createdAt,
      created_by: team.ba,
      team_lead_id: tlId,
      in_progress_at: inProgAt,
      final_checking_at: checkAt,
      for_payment_at: payAt,
      completed_at: doneAt,
      price_minor: price,
      final_price_minor: price,
    })

    plan.queueAssignments.push({
      id: id(),
      booking_id: bkId,
      staff_id: crewId,
      assigned_by: tlId,
      status: 'released',
      started_at: inProgAt,
      released_at: checkAt,
      completed_at: checkAt,
      created_at: inProgAt,
    })

    plan.queueEvents.push(
      { id: id(), booking_id: bkId, branch, old_status: null, new_status: 'waiting', changed_by: team.ba, created_at: createdAt },
      { id: id(), booking_id: bkId, branch, old_status: 'waiting', new_status: 'in_progress', changed_by: tlId, created_at: inProgAt },
      { id: id(), booking_id: bkId, branch, old_status: 'in_progress', new_status: 'final_checking', changed_by: tlId, created_at: checkAt },
      { id: id(), booking_id: bkId, branch, old_status: 'final_checking', new_status: 'for_payment', changed_by: tlId, created_at: payAt },
      { id: id(), booking_id: bkId, branch, old_status: 'for_payment', new_status: 'completed', changed_by: team.ba, created_at: doneAt },
    )

    if (!atDone) return null

    const saleId = id()
    const items = [{ type: 'service', id: svc.id, slug, pay_category: svc.pay_category, name: svc.name, price, qty: 1 }]
    if (qNum % 4 === 0 && products.length) {
      const p = pick(products)
      items.push({ type: 'product', id: p.id, name: p.name, price: p.price_minor, qty: 1 })
    }
    let subtotal = 0
    const saleLineRows = []
    for (const it of items) {
      const lineTotal = it.price * it.qty
      subtotal += lineTotal
      const lineKind = it.type === 'product' ? 'merch' : lineKindForService(it.slug, it.pay_category)
      const line = {
        id: id(),
        sale_id: saleId,
        item_type: it.type,
        service_id: it.type === 'service' ? it.id : null,
        product_id: it.type === 'product' ? it.id : null,
        name: it.name,
        quantity: it.qty,
        unit_price_minor: it.price,
        line_total_minor: lineTotal,
        line_kind: lineKind,
        created_at: doneAt,
      }
      plan.saleLines.push(line)
      saleLineRows.push({
        ...line,
        services: it.type === 'service' ? { name: it.name, slug: it.slug, pay_category: it.pay_category } : null,
        products: it.type === 'product' ? { name: it.name, tags: [], category: 'merchandise' } : null,
      })
    }

    const method = pick(['cash', 'cash', 'gcash', 'card', 'split'])
    const cashMinor = method === 'split' ? Math.floor(subtotal / 2) : null
    const gcashMinor = method === 'split' ? subtotal - cashMinor : null
    const sale = {
      id: saleId,
      branch,
      customer_id: entry.customer.id,
      booking_id: bkId,
      status: 'paid',
      payment_method: method,
      payment_ref: method === 'gcash' || method === 'split' ? `GC${int(10000000, 99999999)}` : method === 'card' ? `CD-${int(1000, 9999)}` : null,
      cash_minor: cashMinor,
      gcash_minor: gcashMinor,
      subtotal_minor: subtotal,
      discount_minor: 0,
      discount_reason: null,
      total_minor: subtotal,
      currency: 'PHP',
      notes: tagTimeline(`Settled ${svc.name} (${date})`),
      recorded_by: team.ba,
      occurred_at: doneAt,
      created_at: doneAt,
    }
    plan.sales.push(sale)
    plan.loyaltyLedger.push({
      id: id(),
      customer_id: entry.customer.id,
      delta: Math.max(10, Math.round(subtotal / 1000)),
      reason: tagTimeline('service_sale'),
      sale_id: saleId,
      created_at: doneAt,
    })

    return {
      ...sale,
      bookings: { services: { name: svc.name, pay_category: svc.pay_category || 'carwash' } },
      sale_line_items: saleLineRows,
    }
  }

  // Generate missing historical operating days (2025-06 .. 2026-11-17) + realistic Daily Sheets
  const extraDays = buildExtraOperatingDaysList()
  for (const date of extraDays) {
    for (const branch of ['bacoor', 'batangas']) {
      if (existingSheetSet.has(`${branch}:${date}`)) continue
      existingSheetSet.add(`${branch}:${date}`)

      const team = teams[branch]
      const washTl = pick(team.washTl)
      const detailTl = pick(team.detailTl)
      const detailer = pick(team.detailers)
      const onDutyCrew = team.crew.slice(0, branch === 'bacoor' ? 3 : 2)

      const attToday = [
        addAtt(washTl, branch, date, 'team_lead', 'present', 7 * 60 + 50),
        ...(detailTl !== washTl ? [addAtt(detailTl, branch, date, 'team_lead', 'present', 7 * 60 + 52)] : []),
        addAtt(detailer, branch, date, 'detailer', 'present', 7 * 60 + 55),
        ...onDutyCrew.map((cid, idx) => addAtt(cid, branch, date, 'staff', 'present', 7 * 60 + 54 + idx)),
      ]

      const daySales = []
      const washCount = branch === 'bacoor' ? 10 : 7
      for (let w = 0; w < washCount; w += 1) {
        const entry = pick(usableCustomers)
        const slug = pick(['express-wash-package', 'premium-car-wash', 'premium-car-wash', 'full-care-package', 'hakum-custom-package', 'engine-wash'])
        const s = pushCompletedTicket({
          branch,
          date,
          qNum: w + 1,
          startMin: 8 * 60 + w * 42,
          slug,
          entry,
          tlId: washTl,
          crewId: onDutyCrew[w % onDutyCrew.length],
          roleKind: 'carwash',
        })
        if (s) daySales.push(s)
      }

      // Daily detailing/PPF/tint job for healthy gross margin
      const detEntry = pick(usableCustomers)
      const detSlug = pick(['ceramic-coating', 'nano-ceramic-tint', 'interior-detailing', 'full-exterior-detailing', 'paint-maintenance', 'glass-detailing', ...(date.endsWith('08') || date.endsWith('22') ? ['paint-protection-film'] : [])])
      const detSale = pushCompletedTicket({
        branch,
        date,
        qNum: 1,
        startMin: 9 * 60 + 15,
        slug: detSlug,
        entry: detEntry,
        tlId: detailTl,
        crewId: detailer,
        roleKind: 'detailing',
      })
      if (detSale) daySales.push(detSale)

      // Daily Sheet + Lines + Posted Expenses
      const sheetId = id()
      const isSubmittedWaiting = date === '2026-11-17' && branch === 'batangas'
      const isReturnedDemo = date === '2026-11-14' && branch === 'bacoor'
      const sheetStatus = isSubmittedWaiting ? 'submitted' : isReturnedDemo ? 'returned' : 'approved'

      const dailyRates = Object.fromEntries(attToday.map((a) => [a.staff_id, a.daily_rate_minor]))
      const suggestions = suggestSalaries({ date, branch, sales: daySales, attendance: attToday, rules: compSettings, dailyRates })

      const lines = []
      let sortIdx = 0
      const addMealId = id()
      const mealAmt = int(40, 75) * 500
      lines.push({
        id: addMealId,
        sheet_id: sheetId,
        kind: 'expense',
        staff_id: null,
        account_id: accounts['10'],
        description: 'Crew lunch & merienda',
        suggested_minor: null,
        amount_minor: mealAmt,
        reason: null,
        paid_from: 'cash',
        sort: sortIdx++,
        created_at: manilaAt(date, 19 * 60),
      })
      if (sheetStatus === 'approved') {
        plan.dailySheetExpenses.push({
          id: id(),
          title: 'Crew lunch & merienda',
          description: `daily_sheet:${sheetId}:${addMealId} ${FULL_TIMELINE_TAG}`,
          quantity: 1,
          unit_cost_minor: mealAmt,
          total_minor: mealAmt,
          branch,
          category_id: accounts['10'],
          status: 'paid',
          expense_kind: 'daily',
          daily_sheet_line_id: addMealId,
          paid_from: 'cash',
          created_by: team.ba,
          approved_by: saId,
          paid_by: saId,
          created_at: manilaAt(date, 12 * 60),
        })
      }

      for (const s of suggestions) {
        if (!(s.suggested_minor > 0)) continue
        const lnId = id()
        lines.push({
          id: lnId,
          sheet_id: sheetId,
          kind: 'salary',
          staff_id: s.staff_id,
          account_id: null,
          description: null,
          suggested_minor: s.suggested_minor,
          amount_minor: s.suggested_minor,
          reason: null,
          paid_from: 'cash',
          sort: sortIdx++,
          created_at: manilaAt(date, 19 * 60),
        })
        if (sheetStatus === 'approved') {
          plan.dailySheetExpenses.push({
            id: id(),
            title: `Salary · ${s.staff_name}`,
            description: `daily_sheet:${sheetId}:${lnId} ${FULL_TIMELINE_TAG}`,
            quantity: 1,
            unit_cost_minor: s.suggested_minor,
            total_minor: s.suggested_minor,
            branch,
            category_id: salaryAcctId,
            status: 'paid',
            expense_kind: s.role === 'detailer' ? 'salary_detailer' : 'salary_carwash',
            daily_sheet_line_id: lnId,
            paid_from: 'cash',
            created_by: team.ba,
            approved_by: saId,
            paid_by: saId,
            created_at: manilaAt(date, 12 * 60),
          })
        }
      }

      let preCount = computeSheetTotals({ sales: daySales, lines, countedCashMinor: null })
      if (preCount.expectedCashMinor < 0) {
        const postedMap = new Map(plan.dailySheetExpenses.map((e) => [e.daily_sheet_line_id, e]))
        for (const ln of lines) {
          if (preCount.expectedCashMinor >= 0) break
          if (ln.paid_from !== 'gcash') {
            ln.paid_from = 'gcash'
            const ex = postedMap.get(ln.id)
            if (ex) ex.paid_from = 'gcash'
            preCount = computeSheetTotals({ sales: daySales, lines, countedCashMinor: null })
          }
        }
      }
      const countedCashMinor = Math.max(0, preCount.expectedCashMinor)
      const totals = computeSheetTotals({ sales: daySales, lines, countedCashMinor })

      plan.dailySheets.push({
        id: sheetId,
        branch,
        business_date: date,
        status: sheetStatus,
        opening_float_minor: 0,
        counted_cash_minor: countedCashMinor,
        totals,
        notes: tagTimeline(`Daily sheet ${date}`),
        review_note: isReturnedDemo ? 'Verify GCash wash count receipt before approval' : null,
        created_by: team.ba,
        submitted_by: team.ba,
        submitted_at: manilaAt(date, 19 * 60 + 15),
        reviewed_by: sheetStatus === 'submitted' ? null : asaId,
        reviewed_at: sheetStatus === 'submitted' ? null : manilaAt(date, 20 * 60),
        created_at: manilaAt(date, 19 * 60),
      })
      plan.dailySheetLines.push(...lines)
    }
  }

  // 3. LIVE TODAY (2026-11-18) Workforce Attendance + Active Carwash & Detailing Queue + Morning POS Sales
  const hasTodaySeed = (todayBkCountRes.count || 0) > 0
  if (!hasTodaySeed) {
    for (const branch of ['bacoor', 'batangas']) {
    const team = teams[branch]
    const washTl = team.washTl[0]
    const detailTl = team.detailTl[0]
    const detailer = team.detailers[0]
    const crewList = team.crew.slice(0, branch === 'bacoor' ? 3 : 2)

    addAtt(team.ba, branch, TODAY, 'admin', 'present', 7 * 60 + 48)
    addAtt(washTl, branch, TODAY, 'team_lead', 'present', 7 * 60 + 50)
    if (detailTl !== washTl) addAtt(detailTl, branch, TODAY, 'team_lead', 'present', 7 * 60 + 52)
    addAtt(detailer, branch, TODAY, 'detailer', 'present', 7 * 60 + 55)
    crewList.forEach((cid, i) => addAtt(cid, branch, TODAY, 'staff', 'present', 7 * 60 + 54 + i))

    // Morning completed & paid washes today (so Floor Insight Today / POS Today / Finance Today have real revenue)
    for (let i = 0; i < 4; i += 1) {
      pushCompletedTicket({
        branch,
        date: TODAY,
        qNum: i + 1,
        startMin: 8 * 60 + i * 35,
        slug: pick(['express-wash-package', 'premium-car-wash', 'full-care-package']),
        entry: pick(usableCustomers),
        tlId: washTl,
        crewId: crewList[i % crewList.length],
        roleKind: 'carwash',
      })
    }

    // Active Carwash Board lanes today: waiting, in_progress, final_checking, for_payment, redo
    const liveStatuses = [
      { status: 'for_payment', qNum: 5, startMin: 11 * 60 + 10, slug: 'full-care-package', crew: crewList[0], entry: demoEntry },
      { status: 'final_checking', qNum: 6, startMin: 11 * 60 + 35, slug: 'premium-car-wash', crew: crewList[1 % crewList.length], entry: pick(usableCustomers) },
      { status: 'in_progress', qNum: 7, startMin: 12 * 60 + 5, slug: 'express-wash-package', crew: crewList[0], entry: pick(usableCustomers) },
      { status: 'waiting', qNum: 8, startMin: 12 * 60 + 30, slug: 'hakum-custom-package', crew: null, entry: pick(usableCustomers) },
      { status: 'redo', qNum: 9, startMin: 11 * 60 + 50, slug: 'engine-wash', crew: crewList[crewList.length - 1], entry: pick(usableCustomers) },
    ]
    for (const ls of liveStatuses) {
      const svc = baseCatalog.services[ls.slug]
      const size = ['small', 'medium', 'large', 'extra_large'].includes(ls.entry.vehicle.vehicle_type) ? ls.entry.vehicle.vehicle_type : 'medium'
      const price = svc.prices[size]
      const createdAt = manilaAt(TODAY, ls.startMin)
      const inProgAt = ls.status !== 'waiting' ? plusMinutes(createdAt, 5) : null
      const checkAt = ['final_checking', 'for_payment', 'redo'].includes(ls.status) ? plusMinutes(createdAt, 28) : null
      const payAt = ls.status === 'for_payment' ? plusMinutes(createdAt, 34) : null
      const bkId = id()
      plan.bookings.push({
        id: bkId,
        branch,
        customer_id: ls.entry.customer.id,
        service_id: svc.id,
        vehicle_id: ls.entry.vehicle.id,
        customer_name: ls.entry.customer.full_name,
        customer_email: ls.entry.customer.email,
        customer_phone: ls.entry.customer.phone,
        vehicle_make: ls.entry.vehicle.vehicle_make,
        vehicle_model: ls.entry.vehicle.vehicle_model,
        vehicle_year: ls.entry.vehicle.vehicle_year || 2023,
        vehicle_plate: ls.entry.vehicle.plate_number,
        vehicle_type: size,
        scheduled_start: createdAt,
        queue_date: TODAY,
        queue_number: ls.qNum,
        status: ls.status,
        referral_source: 'social_media',
        notes: tagTimeline(`Live today bay ticket (${ls.status})`),
        created_at: createdAt,
        created_by: team.ba,
        team_lead_id: washTl,
        waiting_at: createdAt,
        in_progress_at: inProgAt,
        final_checking_at: checkAt,
        for_payment_at: payAt,
        redo_at: ls.status === 'redo' ? plusMinutes(createdAt, 32) : null,
        redo_reason: ls.status === 'redo' ? 'Inspect streak on front bumper' : null,
        price_minor: price,
        final_price_minor: price,
      })
      if (ls.crew) {
        plan.queueAssignments.push({
          id: id(),
          booking_id: bkId,
          staff_id: ls.crew,
          assigned_by: washTl,
          status: ls.status === 'in_progress' ? 'active' : 'released',
          started_at: inProgAt,
          released_at: ls.status === 'in_progress' ? null : checkAt,
          created_at: inProgAt,
        })
      }
    }

    // Active Detailing Board + Upcoming Appointments (including Demo Customer!)
    const detPipeline = [
      { status: 'in_progress', day: TODAY, slug: 'ceramic-coating', entry: pick(usableCustomers), note: 'Bay 1 Ceramic curing' },
      { status: 'confirmed', day: '2026-11-20', slug: 'paint-maintenance', entry: demoEntry, note: 'Upcoming 6-mo maintenance' },
      { status: 'pending', day: '2026-11-22', slug: 'nano-ceramic-tint', entry: pick(usableCustomers), note: 'Online detailing inquiry booking' },
    ]
    detPipeline.forEach((dp, idx) => {
      const svc = baseCatalog.services[dp.slug]
      const size = ['small', 'medium', 'large', 'extra_large'].includes(dp.entry.vehicle.vehicle_type) ? dp.entry.vehicle.vehicle_type : 'medium'
      const price = svc.prices[size]
      const createdAt = manilaAt(dp.day, 10 * 60 + idx * 60)
      const bkId = id()
      plan.bookings.push({
        id: bkId,
        branch,
        customer_id: dp.entry.customer.id,
        service_id: svc.id,
        vehicle_id: dp.entry.vehicle.id,
        customer_name: dp.entry.customer.full_name,
        customer_email: dp.entry.customer.email,
        customer_phone: dp.entry.customer.phone,
        vehicle_make: dp.entry.vehicle.vehicle_make,
        vehicle_model: dp.entry.vehicle.vehicle_model,
        vehicle_year: dp.entry.vehicle.vehicle_year || 2023,
        vehicle_plate: dp.entry.vehicle.plate_number,
        vehicle_type: size,
        scheduled_start: createdAt,
        queue_date: dp.day,
        queue_number: 10 + idx,
        status: dp.status,
        referral_source: 'facebook_ads',
        notes: tagTimeline(dp.note),
        created_at: manilaAt(TODAY, 9 * 60),
        created_by: team.ba,
        team_lead_id: detailTl,
        in_progress_at: dp.status === 'in_progress' ? createdAt : null,
        price_minor: price,
        final_price_minor: price,
      })
      if (dp.status === 'in_progress') {
        plan.queueAssignments.push({
          id: id(),
          booking_id: bkId,
          staff_id: detailer,
          assigned_by: detailTl,
          status: 'active',
          started_at: createdAt,
          created_at: createdAt,
        })
      }
    })
  }
  }

  // 4. Complaints, Rewards (Accessory + Voucher Redemptions), Stock Movements & Demo Customer Tier
  const complaintCats = ['Service quality', 'Wait time', 'Billing / POS', 'Detailing finish']
  for (let i = 0; i < 10; i += 1) {
    const branch = i % 2 === 0 ? 'bacoor' : 'batangas'
    const entry = usableCustomers[i % usableCustomers.length]
    const date = `2026-${String((i % 10) + 2).padStart(2, '0')}-12`
    plan.complaints.push({
      id: id(),
      customer_name: entry.customer.full_name,
      branch,
      category: complaintCats[i % complaintCats.length],
      description: tagTimeline(`Follow-up inspection requested for ${entry.vehicle.plate_number}.`),
      status: i >= 8 ? 'review' : i === 7 ? 'submitted' : 'resolved',
      created_at: manilaAt(date, 15 * 60),
    })
  }

  const purchProducts = products.filter((p) => Number(p.points_price) > 0 || p.price_minor > 0)
  for (let i = 0; i < 14; i += 1) {
    const prod = purchProducts[i % purchProducts.length]
    const entry = i === 0 ? demoEntry : usableCustomers[i % usableCustomers.length]
    const isPending = i < 2
    const branch = i % 2 === 0 ? 'bacoor' : 'batangas'
    const date = isPending ? TODAY : `2026-${String((i % 10) + 1).padStart(2, '0')}-14`
    plan.accessoryRedemptions.push({
      id: id(),
      customer_id: entry.customer.id,
      product_id: prod.id,
      points_spent: Number(prod.points_price) > 0 ? Number(prod.points_price) : 50,
      status: isPending ? 'pending' : 'fulfilled',
      branch_slug: branch,
      size_key: '',
      pickup_code: `FT-PK${String(1000 + i)}`,
      expires_at: manilaAt(isPending ? '2026-11-28' : date, 23 * 60),
      fulfilled_at: isPending ? null : manilaAt(date, 16 * 60),
      fulfilled_by: isPending ? null : teams[branch].ba,
      created_at: manilaAt(date, 12 * 60),
    })
  }

  const activeVoucher = (voucherRes.data || [])[0]
  const voucherBookings = (sampleBksRes.data || []).slice(0, 10)
  if (activeVoucher && voucherBookings.length) {
    for (let i = 0; i < voucherBookings.length; i += 1) {
      const bk = voucherBookings[i]
      const date = bk.queue_date || '2026-10-11'
      plan.promoVoucherRedemptions.push({
        id: id(),
        voucher_id: activeVoucher.id,
        booking_id: bk.id,
        customer_id: bk.customer_id || usableCustomers[i % usableCustomers.length].customer.id,
        applied_by: teams[bk.branch === 'batangas' ? 'batangas' : 'bacoor'].ba,
        discount_minor: 35000,
        consumed_at: manilaAt(date, 14 * 60),
        created_at: manilaAt(date, 14 * 60),
      })
    }
  }

  for (let i = 0; i < 24; i += 1) {
    const p = products[i % products.length]
    const branch = i % 2 === 0 ? 'bacoor' : 'batangas'
    const isRestock = i % 4 === 0
    plan.stockMovements.push({
      id: id(),
      product_id: p.id,
      delta: isRestock ? 12 : -1,
      reason: tagTimeline(isRestock ? 'restock_approved' : 'pos_sale'),
      created_by: teams[branch].ba,
      movement_type: isRestock ? 'restock' : 'sale',
      branch_slug: branch,
      size_key: '',
      created_at: manilaAt(`2026-${String((i % 10) + 1).padStart(2, '0')}-15`, 13 * 60),
    })
  }

  const deluxeTier = (tierRes.data || []).find((t) => /deluxe|premium/i.test(t.name)) || (tierRes.data || [])[0]
  if (deluxeTier && demoEntry) {
    plan.demoMemberships.push({
      id: id(),
      customer_id: demoEntry.customer.id,
      tier_id: deluxeTier.id,
      starts_at: '2026-06-01',
      ends_at: '2027-06-01',
      is_active: true,
      created_at: manilaAt('2026-06-01', 10 * 60),
    })
  }

  console.log(`\nComplete Workflows Gap-Fill Plan  (${apply ? 'APPLY' : 'DRY RUN'})  tag=${FULL_TIMELINE_TAG}`)
  console.log(`  Operating days added:   ${extraDays.length} days + LIVE TODAY (${TODAY})`)
  console.log(`  Vendors added:          ${plan.vendors.length}`)
  console.log(`  Attendance rows:        ${plan.attendance.length} (incl. Today ${TODAY} bacoor & batangas)`)
  console.log(`  Bookings added:         ${plan.bookings.length} (completed historical + active Today queue/detailing)`)
  console.log(`  POS Sales added:        ${plan.sales.length} (${plan.saleLines.length} lines)`)
  console.log(`  Daily Sheets added:     ${plan.dailySheets.length} (${plan.dailySheetLines.length} lines, ${plan.dailySheetExpenses.length} expenses)`)
  console.log(`  Complaints added:       ${plan.complaints.length}`)
  console.log(`  Rewards redemptions:    ${plan.accessoryRedemptions.length} merch + ${plan.promoVoucherRedemptions.length} vouchers`)
  console.log(`  Stock movements added:  ${plan.stockMovements.length}\n`)

  if (!apply) {
    console.log('Dry run complete — pass --apply to write to Supabase.')
    return
  }

  console.log('1/5 Upserting vendors & linking monthly bills to vendor_id...')
  await upsertRows(db, 'vendors', plan.vendors)
  // Link [seed:jun2025-nov2026] monthly bills cleanly to vendors
  await db.from('expenses').update({ vendor_id: vendorIds.power }).like('bill_reference', 'PWR-%').is('vendor_id', null)
  await db.from('expenses').update({ vendor_id: vendorIds.fiber }).like('bill_reference', 'NET-%').is('vendor_id', null)
  await db.from('expenses').update({ vendor_id: vendorIds.meta }).like('bill_reference', 'MKT-%').is('vendor_id', null)
  await db.from('expenses').update({ vendor_id: vendorIds.rent_bacoor }).eq('branch', 'bacoor').like('bill_reference', 'RENT-%').is('vendor_id', null)
  await db.from('expenses').update({ vendor_id: vendorIds.rent_batangas }).eq('branch', 'batangas').like('bill_reference', 'RENT-%').is('vendor_id', null)

  console.log('2/5 Upserting extra calendar & Live Today attendance, bookings, assignments & events...')
  await upsertRows(db, 'staff_attendance', plan.attendance, { onConflict: 'staff_id,attendance_date', ignoreDuplicates: true })
  await upsertRows(db, 'bookings', plan.bookings, { chunkSize: 200 })
  await upsertRows(db, 'queue_assignments', plan.queueAssignments)
  await upsertRows(db, 'queue_events', plan.queueEvents, { chunkSize: 500 })

  console.log('3/5 Upserting POS sales, line items & loyalty ledger...')
  await upsertRows(db, 'sales', plan.sales)
  await upsertRows(db, 'sale_line_items', plan.saleLines, { chunkSize: 500 })
  await upsertRows(db, 'loyalty_ledger', plan.loyaltyLedger, { chunkSize: 500 })

  console.log('4/5 Upserting daily sheets, lines & posted daily expenses/salaries...')
  await upsertRows(db, 'daily_sheets', plan.dailySheets)
  await upsertRows(db, 'daily_sheet_lines', plan.dailySheetLines, { chunkSize: 500 })
  await upsertRows(db, 'expenses', plan.dailySheetExpenses, { chunkSize: 500 })

  console.log('5/5 Upserting complaints, rewards redemptions, stock movements & Demo Customer tier...')
  if (!(await db.from('complaints').select('id', { count: 'exact', head: true }).like('description', `%${FULL_TIMELINE_TAG}%`)).count) {
    await upsertRows(db, 'complaints', plan.complaints)
  }
  await upsertRows(db, 'accessory_redemptions', plan.accessoryRedemptions, { onConflict: 'pickup_code', ignoreDuplicates: true })
  await upsertRows(db, 'promo_voucher_redemptions', plan.promoVoucherRedemptions, { onConflict: 'booking_id', ignoreDuplicates: true })
  if (!(await db.from('product_stock_movements').select('id', { count: 'exact', head: true }).like('reason', `%${FULL_TIMELINE_TAG}%`)).count) {
    await upsertRows(db, 'product_stock_movements', plan.stockMovements)
  }
  if (!(await db.from('customer_memberships').select('id', { count: 'exact', head: true }).eq('customer_id', DEMO_CUSTOMER_ID).eq('is_active', true)).count) {
    await upsertRows(db, 'customer_memberships', plan.demoMemberships)
  }

  console.log('\nDone! Complete 18-month + Live Today workflows populated.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('\nCOMPLETE-WORKFLOWS FAILED:', err.message)
    process.exit(1)
  })
}
