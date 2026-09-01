/**
 * Pure multi-branch audit fixtures for seed + seam tests.
 * Amounts are minor units (centavos). Expected ₱ in tests are literals.
 * Branches: Bacoor (08:00–17:00) · Imus (09:00–18:00).
 */

export const AUDIT_DAY = '2026-08-22'
export const AUDIT_MONTH_START = '2026-08-01'
export const AUDIT_MONTH_END = '2026-08-31'
export const BACOOR = 'bacoor'
export const IMUS = 'imus'

export const BACOOR_SHIFT = Object.freeze({ shift_start: '08:00', shift_end: '17:00' })
export const IMUS_SHIFT = Object.freeze({ shift_start: '09:00', shift_end: '18:00' })

export const AUDIT_RULES = Object.freeze({ wash_pool_pct: 35 })

/** Branch operating hours rows (Mon–Sun = 1–6,0). */
export function buildOperatingHoursRows() {
  const days = [0, 1, 2, 3, 4, 5, 6]
  const rows = []
  for (const dow of days) {
    rows.push({
      branch_slug: BACOOR,
      day_of_week: dow,
      opens_at: BACOOR_SHIFT.shift_start,
      closes_at: BACOOR_SHIFT.shift_end,
      is_closed: false,
    })
    rows.push({
      branch_slug: IMUS,
      day_of_week: dow,
      opens_at: IMUS_SHIFT.shift_start,
      closes_at: IMUS_SHIFT.shift_end,
      is_closed: false,
    })
  }
  return rows
}

export function buildStaffRoster() {
  return [
    { id: 'crew-bacoor-on', full_name: 'On Time Rico', role: 'staff', branch_slug: BACOOR },
    { id: 'crew-bacoor-late', full_name: 'Late Ana', role: 'staff', branch_slug: BACOOR },
    { id: 'crew-bacoor-absent', full_name: 'Absent Jun', role: 'staff', branch_slug: BACOOR },
    { id: 'crew-imus-on', full_name: 'Imus Crew', role: 'staff', branch_slug: IMUS },
    { id: 'det-imus', full_name: 'Imus Detailer', role: 'detailer', branch_slug: IMUS },
    { id: 'det-bacoor', full_name: 'Bacoor Detailer', role: 'detailer', branch_slug: BACOOR },
    { id: 'tl-bacoor', full_name: 'TL Bacoor', role: 'team_lead', branch_slug: BACOOR },
    { id: 'ba-bacoor', full_name: 'BA Bacoor', role: 'admin', branch_slug: BACOOR },
    { id: 'ba-imus', full_name: 'BA Imus', role: 'admin', branch_slug: IMUS },
    { id: 'sales-imus', full_name: 'Sales Imus', role: 'sales', branch_slug: IMUS },
  ]
}

function ymdAdd(start, days) {
  const [y, m, d] = start.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** 30 calendar days of attendance for bay crew + detailers. */
export function buildAttendanceMonth() {
  const roster = buildStaffRoster().filter((s) =>
    ['staff', 'detailer'].includes(s.role),
  )
  const rows = []
  for (let i = 0; i < 30; i++) {
    const day = ymdAdd(AUDIT_MONTH_START, i)
    for (const person of roster) {
      const shift = person.branch_slug === BACOOR ? BACOOR_SHIFT : IMUS_SHIFT
      let status = 'present'
      let clock = `${day}T${shift.shift_start}:00+08:00`
      // Pattern: every 5th day absent for crew-bacoor-absent; late patterns for late Ana
      if (person.id === 'crew-bacoor-absent' && i % 5 === 0) {
        status = 'absent'
        clock = null
      } else if (person.id === 'crew-bacoor-late' && i % 3 === 0) {
        status = 'late'
        clock = `${day}T09:00:00+08:00`
      } else if (person.id === 'crew-bacoor-late' && i % 3 === 1) {
        status = 'late'
        clock = `${day}T10:30:00+08:00`
      } else if (i === 6 && person.id === 'crew-imus-on') {
        status = 'late'
        clock = `${day}T10:00:00+08:00`
      }
      rows.push({
        staff_id: person.id,
        full_name: person.full_name,
        role: person.role,
        branch_slug: person.branch_slug,
        attendance_date: day,
        status,
        attendance_status: status,
        checked_in_at: clock,
        clock_in_at: clock ? clock.slice(11, 16) : null,
        ...shift,
      })
    }
  }
  return rows
}

/** Shop-day snapshot — 8h bay shift (08–16) so wash-pool literals match shop-day-flow.md. */
const SHOP_DAY_SHIFT = Object.freeze({ shift_start: '08:00', shift_end: '16:00' })

export function buildShopDayAttendance() {
  return [
    {
      staff_id: 'crew-bacoor-on',
      id: 'crew-bacoor-on',
      full_name: 'On Time Rico',
      role: 'staff',
      branch_slug: BACOOR,
      attendance_date: AUDIT_DAY,
      status: 'present',
      attendance_status: 'present',
      clock_in_at: '08:00',
      checked_in_at: `${AUDIT_DAY}T08:00:00+08:00`,
      ...SHOP_DAY_SHIFT,
    },
    {
      staff_id: 'crew-bacoor-late',
      id: 'crew-bacoor-late',
      full_name: 'Late Ana',
      role: 'staff',
      branch_slug: BACOOR,
      attendance_date: AUDIT_DAY,
      status: 'late',
      attendance_status: 'late',
      clock_in_at: '09:00',
      checked_in_at: `${AUDIT_DAY}T09:00:00+08:00`,
      ...SHOP_DAY_SHIFT,
    },
    {
      staff_id: 'crew-bacoor-absent',
      id: 'crew-bacoor-absent',
      full_name: 'Absent Jun',
      role: 'staff',
      branch_slug: BACOOR,
      attendance_date: AUDIT_DAY,
      status: 'absent',
      attendance_status: 'absent',
      ...SHOP_DAY_SHIFT,
    },
    {
      staff_id: 'crew-imus-on',
      id: 'crew-imus-on',
      full_name: 'Imus Crew',
      role: 'staff',
      branch_slug: IMUS,
      attendance_date: AUDIT_DAY,
      status: 'present',
      attendance_status: 'present',
      clock_in_at: '08:00',
      checked_in_at: `${AUDIT_DAY}T08:00:00+08:00`,
      ...SHOP_DAY_SHIFT,
    },
    {
      staff_id: 'det-imus',
      id: 'det-imus',
      full_name: 'Imus Detailer',
      role: 'detailer',
      branch_slug: IMUS,
      attendance_date: AUDIT_DAY,
      status: 'present',
      attendance_status: 'present',
      clock_in_at: '08:00',
      checked_in_at: `${AUDIT_DAY}T08:00:00+08:00`,
      ...SHOP_DAY_SHIFT,
    },
    {
      staff_id: 'det-bacoor',
      id: 'det-bacoor',
      full_name: 'Bacoor Detailer',
      role: 'detailer',
      branch_slug: BACOOR,
      attendance_date: AUDIT_DAY,
      status: 'present',
      attendance_status: 'present',
      clock_in_at: '08:00',
      checked_in_at: `${AUDIT_DAY}T08:00:00+08:00`,
      ...SHOP_DAY_SHIFT,
    },
  ]
}

export function buildShopDaySales() {
  return [
    {
      id: 'sale-bacoor-wash',
      branch: BACOOR,
      status: 'paid',
      total_minor: 200_000,
      payment_method: 'cash',
      occurred_at: `${AUDIT_DAY}T09:30:00+08:00`,
      pos_handoff_id: 'q-bacoor-1',
      sale_line_items: [
        {
          name: 'Premium Car Wash',
          line_total_minor: 200_000,
          pay_category: 'wash',
          catalog_kind: 'service',
        },
      ],
    },
    {
      id: 'sale-imus-wash',
      branch: IMUS,
      status: 'paid',
      total_minor: 100_000,
      payment_method: 'gcash',
      occurred_at: `${AUDIT_DAY}T10:00:00+08:00`,
      pos_handoff_id: 'q-imus-1',
      sale_line_items: [
        {
          name: 'Express Wash',
          line_total_minor: 100_000,
          pay_category: 'wash',
          catalog_kind: 'service',
        },
      ],
    },
    {
      id: 'sale-imus-ceramic',
      branch: IMUS,
      status: 'paid',
      total_minor: 1_000_000,
      payment_method: 'card',
      occurred_at: `${AUDIT_DAY}T14:00:00+08:00`,
      booking_id: 'book-imus-1',
      assigned_staff_id: 'det-imus',
      detailer_staff_id: 'det-imus',
      sale_line_items: [
        {
          name: 'Ceramic Coating',
          line_total_minor: 1_000_000,
          pay_category: 'detailing',
          service_slug: 'ceramic-coating',
          catalog_kind: 'service',
        },
      ],
    },
    {
      id: 'sale-bacoor-merch',
      branch: BACOOR,
      status: 'paid',
      total_minor: 50_000,
      payment_method: 'cash',
      occurred_at: `${AUDIT_DAY}T11:00:00+08:00`,
      sale_line_items: [
        {
          name: 'Hakum Towel',
          line_total_minor: 50_000,
          pay_category: 'merch',
          catalog_kind: 'product',
        },
      ],
    },
    {
      id: 'sale-bacoor-walkin-detail',
      branch: BACOOR,
      status: 'paid',
      total_minor: 350_000,
      payment_method: 'gcash',
      occurred_at: `${AUDIT_DAY}T15:00:00+08:00`,
      detailer_staff_id: 'det-bacoor',
      assigned_staff_id: 'det-bacoor',
      sale_line_items: [
        {
          name: 'Paint Maintenance',
          line_total_minor: 350_000,
          pay_category: 'detailing',
          service_slug: 'paint-maintenance',
          catalog_kind: 'service',
        },
      ],
    },
  ]
}

/** Aggregate daily sales rows shaped like finance_daily_sales view. */
export function buildFinanceSalesRows(sales = buildShopDaySales()) {
  const map = new Map()
  for (const s of sales) {
    if (String(s.status) !== 'paid') continue
    const day = String(s.occurred_at || '').slice(0, 10)
    const key = `${s.branch}|${day}`
    if (!map.has(key)) {
      map.set(key, {
        branch: s.branch,
        sale_date: day,
        total_sales_minor: 0,
        cash_sales_minor: 0,
        gcash_sales_minor: 0,
        card_sales_minor: 0,
        paid_count: 0,
        transaction_count: 0,
      })
    }
    const row = map.get(key)
    const amt = Number(s.total_minor) || 0
    row.total_sales_minor += amt
    row.paid_count += 1
    row.transaction_count += 1
    const method = String(s.payment_method || '').toLowerCase()
    if (method === 'cash') row.cash_sales_minor += amt
    else if (method === 'gcash') row.gcash_sales_minor += amt
    else if (method === 'card') row.card_sales_minor += amt
  }
  return [...map.values()]
}

export function buildPlRows(sales = buildShopDaySales(), expenses = buildExpenses()) {
  const rows = []
  for (const s of sales) {
    if (String(s.status) !== 'paid') continue
    rows.push({
      period_date: String(s.occurred_at || '').slice(0, 10),
      branch: s.branch,
      kind: 'income',
      category: 'POS sales',
      amount_minor: Number(s.total_minor) || 0,
    })
  }
  for (const e of expenses) {
    if (e.kind === 'ca_repayment') continue
    rows.push({
      period_date: e.expense_date || AUDIT_DAY,
      branch: e.branch,
      kind: 'expense',
      category: e.category || e.expense_kind || 'Operating',
      amount_minor: Number(e.amount_minor) || 0,
    })
  }
  return rows
}

export function buildExpenses() {
  return [
    {
      id: 'exp-supplies-bacoor',
      branch: BACOOR,
      expense_date: AUDIT_DAY,
      amount_minor: 25_000,
      category: 'Supplies',
      expense_kind: 'daily',
      status: 'posted',
    },
    {
      id: 'exp-supplies-imus',
      branch: IMUS,
      expense_date: AUDIT_DAY,
      amount_minor: 15_000,
      category: 'Supplies',
      expense_kind: 'daily',
      status: 'posted',
    },
    {
      id: 'exp-ca-approved',
      branch: BACOOR,
      expense_date: AUDIT_DAY,
      amount_minor: 50_000,
      category: 'Cash advance',
      expense_kind: 'cash_advance',
      status: 'posted',
      staff_id: 'crew-bacoor-on',
    },
    {
      id: 'exp-utilities',
      branch: BACOOR,
      expense_date: AUDIT_DAY,
      amount_minor: 80_000,
      category: 'Utilities',
      expense_kind: 'bill',
      status: 'posted',
    },
    {
      id: 'exp-rent-imus',
      branch: IMUS,
      expense_date: AUDIT_DAY,
      amount_minor: 120_000,
      category: 'Rent',
      expense_kind: 'bill',
      status: 'posted',
    },
  ]
}

export function buildCaRepaymentExpense() {
  return {
    id: 'exp-ca-repay',
    branch: BACOOR,
    expense_date: AUDIT_DAY,
    amount_minor: 20_000,
    category: 'CA repayment',
    expense_kind: 'ca_repayment',
    kind: 'ca_repayment',
    status: 'posted',
    staff_id: 'crew-bacoor-on',
  }
}

export function buildShiftCloses() {
  return [
    {
      id: 'close-bacoor-day',
      branch: BACOOR,
      business_date: AUDIT_DAY,
      status: 'accepted',
      submitted: {
        total_sales_minor: 600_000,
        square_sales_minor: 600_000,
        cash_sales_minor: 250_000,
        total_expenses_minor: 155_000,
        ca_collected_minor: 20_000,
        total_cash_left_minor: 115_000,
        salary_draft_extras: [
          { staff_id: 'crew-bacoor-on', label: 'Extra tip share', amount_minor: 5_000 },
        ],
      },
      variance_minor: 0,
    },
    {
      id: 'close-imus-day',
      branch: IMUS,
      business_date: AUDIT_DAY,
      status: 'accepted',
      submitted: {
        total_sales_minor: 1_100_000,
        square_sales_minor: 1_100_000,
        cash_sales_minor: 0,
        total_expenses_minor: 135_000,
        ca_collected_minor: 0,
        total_cash_left_minor: 0,
      },
      variance_minor: 0,
    },
    {
      id: 'close-bacoor-prev',
      branch: BACOOR,
      business_date: '2026-08-21',
      status: 'locked',
      submitted: {
        total_sales_minor: 400_000,
        square_sales_minor: 400_000,
        cash_sales_minor: 200_000,
        total_expenses_minor: 50_000,
        ca_collected_minor: 0,
        total_cash_left_minor: 150_000,
      },
      variance_minor: 0,
    },
    {
      id: 'close-bacoor-short',
      branch: BACOOR,
      business_date: '2026-08-20',
      status: 'submitted',
      submitted: {
        total_sales_minor: 300_000,
        square_sales_minor: 300_000,
        cash_sales_minor: 150_000,
        total_expenses_minor: 40_000,
        ca_collected_minor: 0,
        total_cash_left_minor: 100_000,
      },
      variance_minor: -5_000,
    },
    {
      id: 'close-imus-locked',
      branch: IMUS,
      business_date: '2026-08-21',
      status: 'locked',
      submitted: {
        total_sales_minor: 500_000,
        square_sales_minor: 500_000,
        cash_sales_minor: 100_000,
        total_expenses_minor: 60_000,
        ca_collected_minor: 0,
        total_cash_left_minor: 40_000,
      },
      variance_minor: 0,
    },
  ]
}

export function buildBookings() {
  return [
    {
      id: 'book-imus-1',
      branch: IMUS,
      status: 'completed',
      service_name: 'Ceramic Coating',
      assigned_staff_id: 'det-imus',
      scheduled_date: AUDIT_DAY,
      total_minor: 1_000_000,
      customer_id: 'cust-1',
    },
    {
      id: 'book-bacoor-1',
      branch: BACOOR,
      status: 'confirmed',
      service_name: 'Paint Maintenance',
      assigned_staff_id: 'det-bacoor',
      scheduled_date: AUDIT_DAY,
      total_minor: 350_000,
      customer_id: 'cust-2',
    },
  ]
}

export function buildCustomers() {
  return [
    { id: 'cust-1', full_name: 'Maria Santos', phone: '09171234501', visit_count: 4 },
    { id: 'cust-2', full_name: 'Juan Dela Cruz', phone: '09171234502', visit_count: 1 },
    { id: 'cust-3', full_name: 'Ana Reyes', phone: '09171234503', visit_count: 8 },
  ]
}

export function buildExpenseCategories() {
  return [
    { id: 'cat-supplies', name: 'Supplies', is_active: true },
    { id: 'cat-utilities', name: 'Utilities', is_active: true },
    { id: 'cat-rent', name: 'Rent', is_active: true },
    { id: 'cat-ca', name: 'Cash advance', is_active: true },
  ]
}

export function buildExpenseReports() {
  return [
    {
      id: 'er-1',
      branch: BACOOR,
      period_start: AUDIT_MONTH_START,
      period_end: AUDIT_DAY,
      status: 'submitted',
      title: 'August supplies — Bacoor',
      expense_report_lines: [
        { id: 'erl-1', category_id: 'cat-supplies', amount_minor: 25_000, notes: 'Chemicals' },
        { id: 'erl-2', category_id: 'cat-utilities', amount_minor: 80_000, notes: 'Power' },
      ],
    },
  ]
}

export function buildCashAdvances() {
  return [
    {
      id: 'ca-1',
      staff_id: 'crew-bacoor-on',
      branch: BACOOR,
      amount_minor: 50_000,
      status: 'approved',
      approved_at: `${AUDIT_DAY}T08:30:00+08:00`,
    },
  ]
}

/** Month-scale POS sales for chart density (60+ tickets). */
export function buildMonthSales() {
  const methods = ['cash', 'gcash', 'card']
  const sales = [...buildShopDaySales()]
  let n = 0
  for (let i = 0; i < 30; i++) {
    const day = ymdAdd(AUDIT_MONTH_START, i)
    if (day === AUDIT_DAY) continue
    for (const branch of [BACOOR, IMUS]) {
      const washAmt = branch === BACOOR ? 180_000 + (i % 5) * 10_000 : 90_000 + (i % 4) * 5_000
      sales.push({
        id: `sale-month-wash-${branch}-${i}`,
        branch,
        status: 'paid',
        total_minor: washAmt,
        payment_method: methods[n % 3],
        occurred_at: `${day}T10:00:00+08:00`,
        sale_line_items: [
          {
            name: 'Car Wash',
            line_total_minor: washAmt,
            pay_category: 'wash',
            catalog_kind: 'service',
          },
        ],
      })
      n += 1
      if (i % 4 === 0) {
        sales.push({
          id: `sale-month-merch-${branch}-${i}`,
          branch,
          status: 'paid',
          total_minor: 30_000,
          payment_method: 'cash',
          occurred_at: `${day}T12:00:00+08:00`,
          sale_line_items: [
            {
              name: 'Merch',
              line_total_minor: 30_000,
              pay_category: 'merch',
              catalog_kind: 'product',
            },
          ],
        })
      }
    }
  }
  return sales
}

/** Full audit fixture bundle (dry-run / tests). */
export function buildAuditFixture() {
  const shopSales = buildShopDaySales()
  const monthSales = buildMonthSales()
  const expenses = [...buildExpenses(), buildCaRepaymentExpense()]
  return {
    meta: {
      generated_for: 'full-system-audit',
      day: AUDIT_DAY,
      month_start: AUDIT_MONTH_START,
      month_end: AUDIT_MONTH_END,
      branches: [BACOOR, IMUS],
    },
    operating_hours: buildOperatingHoursRows(),
    staff: buildStaffRoster(),
    attendance_month: buildAttendanceMonth(),
    attendance_shop_day: buildShopDayAttendance(),
    sales_shop_day: shopSales,
    sales_month: monthSales,
    expenses,
    shift_closes: buildShiftCloses(),
    bookings: buildBookings(),
    customers: buildCustomers(),
    expense_categories: buildExpenseCategories(),
    expense_reports: buildExpenseReports(),
    cash_advances: buildCashAdvances(),
    finance_sales_rows: buildFinanceSalesRows(monthSales),
    pl_rows: buildPlRows(monthSales, expenses),
    counts: {
      staff: buildStaffRoster().length,
      attendance_days: 30,
      attendance_rows: buildAttendanceMonth().length,
      sales_month: monthSales.length,
      sales_shop_day: shopSales.length,
      expenses: expenses.length,
      shift_closes: buildShiftCloses().length,
      bookings: buildBookings().length,
      customers: buildCustomers().length,
      expense_reports: buildExpenseReports().length,
      operating_hours: buildOperatingHoursRows().length,
    },
  }
}
