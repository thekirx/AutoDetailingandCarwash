/**
 * Master System Test Plan Verification Suite
 * Aligned with docs/HAKUM_MASTER_TEST_PLAN.md
 * 
 * Verifies public seams across:
 * 1. Global RBAC & User Persona Matrix
 * 2. Customer Lifecycle, Loyalty & Points Shop
 * 3. Crew Operations & Attendance Headcount Formatting
 * 4. Team Lead Queue FIFO, Customer Greeting & Bay Operations
 * 5. Branch Admin POS, Cash Advance & End-of-Day Financial Reconciliation
 * 6. Inventory 4 Categories, Coffee Recipe & Zero-Cost Restock Governance
 * 7. Office Payroll Engine (No-Tax Gross=Net) & Payslips
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

// Seam 1: RBAC & Permissions
import {
  ROLES,
  canAccessFloorBoard,
  canEditQueueOperations,
  canViewQueueBoard,
  canAccessBookingBoard,
  canEditBookings,
  canAccessPos,
  canManageVouchers,
  canViewVouchers,
  canAccessFinance,
  canWriteFinance,
  canAccessAttendance,
  canOverrideAttendance,
  canAccessCrm,
  canEditCrm,
  canModifyStock,
  canRestockInventory,
  canAccessApprovals,
  canSeeAllBranches,
} from '../src/auth/permissions.js'
import { hidesCashAdvancePlannerBoard } from '../src/lib/plannerBoard.js'

// Seam 2: Loyalty, Rewards & Points Shop
import {
  SERVICE_POINTS,
  VISIT_REWARDS,
  MERCH_POINTS,
  MEMBER_TIERS,
  memberTier,
  nextVisitReward,
  earnedVisitRewards,
} from '../src/lib/rewardsCatalog.js'
import {
  normalizePickupCode,
  pickupDaysLeft,
  claimState,
} from '../src/lib/pointsShop.js'

// Seam 3: Attendance & Headcount Formatting
import {
  formatAttendanceHeadcountStrings,
  isFloorCrew,
  isAdministrativeCrew,
  attendanceRoleHeadcount,
} from '../src/lib/attendanceInsights.js'

// Seam 4: Queue Logic, FIFO & Customer Name
import {
  sortTicketsFifo,
  fifoNextTicketId,
  normalizePlate,
} from '../src/queue/queueLogic.js'
import { resolveQueueCustomerDisplayName } from '../src/lib/queueCustomerName.js'

// Seam 5: POS, Cash Advance & Bacoor Daily Close
import {
  assertBranchAdminCart,
  summarizePosCart,
} from '../src/lib/posSale.js'
import {
  cashAdvanceBalances,
  calculateProjectedCashAdvance,
} from '../src/lib/cashAdvanceBalance.js'
import {
  buildBacoorDailyReport,
  formatBacoorReportText,
} from '../src/lib/bacoorDailyReport.js'

// Seam 6: Inventory Categories & Recipe
import {
  STOCK_CATEGORIES,
  MATERIAL_ROLES,
  RESTOCK_POLICY_NOTICE,
  productShowsOnPos,
  evaluateStockStatus,
} from '../src/lib/inventoryCatalog.js'

// Seam 7: Payroll & Payslips
import {
  payslipTakeHome,
  isDayCrewRole,
  payslipStatusLabel,
} from '../src/lib/payslip.js'

// Seam 8: Detailing, Tint & PPF Pipeline
import {
  DETAILING_BOARD_STATUSES,
  SALES_BOARD_STATUSES,
  nextDetailingBoardStatus,
  isSalesBoardStatus,
  BOOKING_TERMINAL_STATUSES,
  isOpenBookingStatus,
} from '../src/lib/detailingBoardStatuses.js'

// Seam 9: Multi-User Concurrency & Cash Advance Code Integrity
import {
  normalizeCashAdvanceCode,
  cashAdvanceReleaseError,
} from '../src/lib/cashAdvanceCode.js'
import {
  applyRestockQty,
  applyReconLine,
  applyOwnerSetQty,
} from '../src/lib/inventoryBranchStock.js'

describe('Master Test Plan: 1. Global RBAC & User Persona Matrix', () => {
  const owner = { role: ROLES.SUPER_ADMIN, full_name: 'Michihiko' }
  const superAdminRobert = { role: ROLES.SUPER_ADMIN, floor_insight: false, full_name: 'Robert' }
  const superAdminLucy = { role: ROLES.SUPER_ADMIN, floor_insight: false, full_name: 'Lucy' }
  const generalAdminBryan = {
    role: ROLES.ASSISTANT_SUPER_ADMIN,
    permission_grants: { pos: false, finance_view: false, finance_write: false, reports: false },
    full_name: 'Bryan',
  }
  const teamLeadJaycee = { role: ROLES.TEAM_LEAD, branch_slug: 'bacoor', full_name: 'Jaycee' }
  const branchAdminPeter = { role: ROLES.ADMIN, branch_slug: 'bacoor', full_name: 'Peter' }
  const crewStaff = { role: ROLES.STAFF, branch_slug: 'bacoor', full_name: 'Crew Member' }
  const marketingRon = { role: ROLES.MARKETING, full_name: 'Ron' }
  const customerRep = { role: ROLES.SALES, full_name: 'Sales Desk' }
  const investor = { role: ROLES.INVESTOR, branch_slug: 'bacoor', full_name: 'Investor' }

  it('Owner (Michihiko) has full access across all modules including Floor Insight', () => {
    assert.equal(canAccessFloorBoard(owner), true)
    assert.equal(canEditQueueOperations(owner), true)
    assert.equal(canAccessBookingBoard(owner), true)
    assert.equal(canAccessPos(owner), true)
    assert.equal(canManageVouchers(owner), true)
    assert.equal(canAccessFinance(owner), true)
    assert.equal(canAccessAttendance(owner), true)
    assert.equal(canAccessCrm(owner), true)
    assert.equal(canModifyStock(owner), true)
    assert.equal(canAccessApprovals(owner), true)
    assert.equal(canSeeAllBranches(owner), true)
  })

  it('Super Admins (Robert & Lucy) have full operations access but NO access to Floor Insight', () => {
    for (const sa of [superAdminRobert, superAdminLucy]) {
      assert.equal(canAccessFloorBoard(sa), false, `${sa.full_name} must not access Floor Insight`)
      assert.equal(canEditQueueOperations(sa), true)
      assert.equal(canAccessBookingBoard(sa), true)
      assert.equal(canAccessPos(sa), true)
      assert.equal(canManageVouchers(sa), true)
      assert.equal(canAccessFinance(sa), true)
      assert.equal(canAccessAttendance(sa), true)
      assert.equal(canAccessCrm(sa), true)
      assert.equal(canModifyStock(sa), true, `${sa.full_name} can modify stock`)
      assert.equal(canAccessApprovals(sa), true)
    }
  })

  it('General Admin (Bryan) has queue/detailing full, partial planner (no CA), read HR, partial CRM, no POS/Finance', () => {
    assert.equal(canAccessFloorBoard(generalAdminBryan), false)
    assert.equal(canEditQueueOperations(generalAdminBryan), true)
    assert.equal(canAccessBookingBoard(generalAdminBryan), true)
    assert.equal(hidesCashAdvancePlannerBoard(generalAdminBryan), true, 'hides cash advance board')
    assert.equal(canAccessPos(generalAdminBryan), false, 'pos denied by grant')
    assert.equal(canAccessFinance(generalAdminBryan), false, 'finance denied by grant')
    assert.equal(canAccessAttendance(generalAdminBryan), true)
    assert.equal(canAccessCrm(generalAdminBryan), true)
  })

  it('Team Leads have full queue/detailing, branch scoped, CRM read-only, no POS, and hide Cash Advance board', () => {
    assert.equal(canAccessFloorBoard(teamLeadJaycee), false)
    assert.equal(canEditQueueOperations(teamLeadJaycee), true)
    assert.equal(canAccessBookingBoard(teamLeadJaycee), true)
    assert.equal(hidesCashAdvancePlannerBoard(teamLeadJaycee), true)
    assert.equal(canAccessPos(teamLeadJaycee), false)
    assert.equal(canManageVouchers(teamLeadJaycee), false)
    assert.equal(canAccessFinance(teamLeadJaycee), false)
    assert.equal(canAccessCrm(teamLeadJaycee), true)
    assert.equal(canEditCrm(teamLeadJaycee), false, 'CRM read-only for TL')
    assert.equal(canSeeAllBranches(teamLeadJaycee), false, 'branch scoped')
  })

  it('Branch Admin has full POS, customer create/modify, read-only queue, and cannot directly alter stock', () => {
    assert.equal(canAccessFloorBoard(branchAdminPeter), false)
    assert.equal(canAccessPos(branchAdminPeter), true)
    assert.equal(canViewQueueBoard(branchAdminPeter), true)
    assert.equal(canEditQueueOperations(branchAdminPeter), false, 'cannot edit queue operations')
    assert.equal(canAccessBookingBoard(branchAdminPeter), true)
    assert.equal(canAccessCrm(branchAdminPeter), true)
    assert.equal(canEditCrm(branchAdminPeter), true, 'can create/modify customer accounts')
    assert.equal(canModifyStock(branchAdminPeter), false, 'cannot directly modify stock counts')
    assert.equal(canRestockInventory(branchAdminPeter), true, 'can submit restock requests')
  })

  it('Floor Crew can watch Floor board and clock in, but cannot edit queues or access POS', () => {
    assert.equal(canAccessFloorBoard(crewStaff), true, 'crew can watch floor')
    assert.equal(canAccessAttendance(crewStaff), true)
    assert.equal(canEditQueueOperations(crewStaff), false)
    assert.equal(canAccessPos(crewStaff), false)
  })

  it('Marketing and Customer Rep roles have read-only queue/detailing and no POS/Finance', () => {
    assert.equal(canViewQueueBoard(marketingRon), true)
    assert.equal(canEditQueueOperations(marketingRon), false)
    assert.equal(canAccessPos(marketingRon), false)
    assert.equal(canAccessFinance(marketingRon), false)
    assert.equal(canEditCrm(marketingRon), false, 'marketing is CRM read-only')

    assert.equal(canViewQueueBoard(customerRep), true)
    assert.equal(canEditQueueOperations(customerRep), false)
    assert.equal(canAccessPos(customerRep), false)
    assert.equal(canAccessFinance(customerRep), false)
    assert.equal(canEditCrm(customerRep), true, 'customer rep can create/modify customers')
  })

  it('Investor has read-only access to Queue, Detailing, POS, and Finance for assigned branch only', () => {
    assert.equal(canViewQueueBoard(investor), true)
    assert.equal(canEditQueueOperations(investor), false)
    assert.equal(canAccessBookingBoard(investor), true)
    assert.equal(canEditBookings(investor), false)
    assert.equal(canAccessFinance(investor), true)
    assert.equal(canWriteFinance(investor), false, 'read-only finance')
    assert.equal(canSeeAllBranches(investor), false, 'specific branch only')
  })
})

describe('Master Test Plan: 2. Customer Lifecycle, Loyalty & Points Shop', () => {
  it('SERVICE_POINTS contains all 23 exact service points mappings', () => {
    assert.equal(SERVICE_POINTS.length, 23)
    const pts = Object.fromEntries(SERVICE_POINTS.map((s) => [s.name, s.points]))

    assert.equal(pts['Premium car wash'], 1)
    assert.equal(pts['Express'], 2)
    assert.equal(pts['Basic'], 3)
    assert.equal(pts['Deluxe'], 4)
    assert.equal(pts['Paint Maintenance'], 5)
    assert.equal(pts['Paint Refresh'], 5)
    assert.equal(pts['Glass cleaning'], 3)
    assert.equal(pts['Headlight Restore'], 3)
    assert.equal(pts['Black trims restore'], 3)
    assert.equal(pts['Glass detailing'], 5)
    assert.equal(pts['Glass coating'], 5)
    assert.equal(pts['Classic ceramic coating'], 15)
    assert.equal(pts['Premium ceramic'], 20)
    assert.equal(pts['Platinum ceramic'], 25)
    assert.equal(pts['Nano Ceramic Tint'], 10)
    assert.equal(pts['Nano Ceramic Pro Tint'], 15)
    assert.equal(pts['Nano Ceramic Pro Black Series Tint'], 20)
    assert.equal(pts['Interior Detailing'], 10)
    assert.equal(pts['Interior Deep Cleaning'], 5)
    assert.equal(pts['High Impact Partial PPF'], 30)
    assert.equal(pts['Basic PPF'], 40)
    assert.equal(pts['Ultimate PPF'], 50)
    assert.equal(pts['Platinum PPF'], 60)
  })

  it('VISIT_REWARDS triggers exact perks on 6th, 12th, 18th, 24th, 30th visits', () => {
    assert.equal(VISIT_REWARDS.length, 5)
    assert.equal(VISIT_REWARDS[0].visit, 6)
    assert.match(VISIT_REWARDS[0].label, /car freshener/i)
    assert.equal(VISIT_REWARDS[1].visit, 12)
    assert.match(VISIT_REWARDS[1].label, /coffee/i)
    assert.equal(VISIT_REWARDS[2].visit, 18)
    assert.match(VISIT_REWARDS[2].label, /premium car wash/i)
    assert.equal(VISIT_REWARDS[3].visit, 24)
    assert.match(VISIT_REWARDS[3].label, /back-to-zero|bac-to-zero/i)
    assert.equal(VISIT_REWARDS[4].visit, 30)
    assert.match(VISIT_REWARDS[4].label, /15% off/i)

    assert.equal(nextVisitReward(5).visit, 6)
    assert.equal(nextVisitReward(5).visitsAway, 1)
    assert.equal(earnedVisitRewards(18).length, 3)
  })

  it('MEMBER_TIERS transitions dynamically at 30, 70, and 100 visits', () => {
    assert.equal(memberTier(1).name, 'Hakum Basic Member')
    assert.equal(memberTier(29).name, 'Hakum Basic Member')
    assert.equal(memberTier(30).name, 'Hakum Deluxe Member')
    assert.equal(memberTier(69).name, 'Hakum Deluxe Member')
    assert.equal(memberTier(70).name, 'Hakum Premium Member')
    assert.equal(memberTier(99).name, 'Hakum Premium Member')
    assert.equal(memberTier(100).name, 'Hakum Platinum Member')
    assert.equal(memberTier(150).name, 'Hakum Platinum Member')
  })

  it('MERCH_POINTS defines exact point values for all 10 redemption items', () => {
    assert.equal(MERCH_POINTS.length, 10)
    const merch = Object.fromEntries(MERCH_POINTS.map((m) => [m.name, m.points]))
    assert.equal(merch['Hakum Key Chain'], 20)
    assert.equal(merch['Clear Pro mug'], 30)
    assert.equal(merch['Clear Pro Yellow Bag'], 30)
    assert.equal(merch['Hakum car scent'], 30)
    assert.equal(merch['Air Spencer'], 30)
    assert.equal(merch['Hakum Shirt'], 50)
    assert.equal(merch['Hakum Car Care Kit'], 50)
    assert.equal(merch['Fusso coat spray'], 50)
    assert.equal(merch['Luxury gloss spray'], 50)
    assert.equal(merch['Clear Pro Coffee Kit'], 60)
  })

  it('Points Shop pickup code normalizer accepts variations and generates standard HK- format', () => {
    assert.equal(normalizePickupCode('A1B2C3D4'), 'HK-A1B2C3D4')
    assert.equal(normalizePickupCode('hk-a1b2c3d4'), 'HK-A1B2C3D4')
    assert.equal(normalizePickupCode('hk a1b2c3d4'), 'HK-A1B2C3D4')
    assert.equal(normalizePickupCode('HK-A1B2C3D4'), 'HK-A1B2C3D4')
  })

  it('Points Shop claimState verifies stock, points, and branch availability', () => {
    const item = {
      points_price: 50,
      size_options: null,
      product_branch_stock: [{ branch_slug: 'bacoor', size_key: '', qty: 5 }],
    }
    const eligible = claimState(item, 'bacoor', null, 60, false)
    assert.equal(eligible.canClaim, true)
    assert.equal(eligible.stock, 5)
    assert.equal(eligible.left, 10)

    const insufficientPoints = claimState(item, 'bacoor', null, 30, false)
    assert.equal(insufficientPoints.canClaim, false)
    assert.equal(insufficientPoints.left, -20)

    const outOfStock = claimState(item, 'batangas', null, 100, false)
    assert.equal(outOfStock.canClaim, false)
    assert.equal(outOfStock.stock, 0)
  })
})

describe('Master Test Plan: 3. Crew Operations & Attendance Headcount', () => {
  it('formatAttendanceHeadcountStrings outputs exact required two-line format', () => {
    const headcount = [
      { role: 'staff', onSite: 8, total: 10 },
      { role: 'team_lead', onSite: 2, total: 2 },
      { role: 'admin', onSite: 1, total: 2 },
    ]
    const formatted = formatAttendanceHeadcountStrings('Bacoor', headcount)
    assert.equal(formatted.crewLine, 'Bacoor Branch Crew - 8 out of 10')
    assert.equal(formatted.adminLine, 'Team Lead - 2 out of 2 Admin - 1 out of 2')
    assert.equal(formatted.fullText, 'Bacoor Branch Crew - 8 out of 10\nTeam Lead - 2 out of 2 Admin - 1 out of 2')
  })

  it('isFloorCrew and isAdministrativeCrew correctly segregate floor from management', () => {
    assert.equal(isFloorCrew('staff'), true)
    assert.equal(isFloorCrew('detailer'), true)
    assert.equal(isFloorCrew('team_lead'), false)
    assert.equal(isFloorCrew('admin'), false)
    assert.equal(isFloorCrew('super_admin'), false)

    assert.equal(isAdministrativeCrew('admin'), true)
    assert.equal(isAdministrativeCrew('team_lead'), true)
    assert.equal(isAdministrativeCrew('staff'), false)
  })
})

describe('Master Test Plan: 4. Team Lead Queue FIFO, Customer Greeting & Bay Operations', () => {
  it('FIFO queue sorts by waiting_at and queue_number so oldest car is first', () => {
    const tickets = [
      { booking_id: 't2', queue_number: 2, waiting_at: '2026-11-06T08:15:00Z', status: 'waiting' },
      { booking_id: 't1', queue_number: 1, waiting_at: '2026-11-06T08:00:00Z', status: 'waiting' },
      { booking_id: 't3', queue_number: 3, waiting_at: '2026-11-06T08:30:00Z', status: 'waiting' },
    ]
    const sorted = sortTicketsFifo(tickets)
    assert.equal(sorted[0].booking_id, 't1', 't1 arrived earliest')
    assert.equal(sorted[1].booking_id, 't2')
    assert.equal(sorted[2].booking_id, 't3')
    assert.equal(fifoNextTicketId(tickets), 't1', 'FIFO next car should be t1')
  })

  it('Existing customer display surfaces full name for personal greeting by Team Lead', () => {
    const existing = resolveQueueCustomerDisplayName({
      customer_name: 'Juan dela Cruz',
      vehicle_plate: 'NDX 5432',
    })
    assert.equal(existing, 'Juan dela Cruz')

    const walkIn = resolveQueueCustomerDisplayName({
      customer_name: '',
      vehicle_plate: 'NDX 5432',
    })
    assert.equal(walkIn, 'Walk-in · NDX5432')
  })
})

describe('Master Test Plan: 5. Branch Admin POS, Cash Advance & Day Close Reconciliation', () => {
  it('assertBranchAdminCart allows tickets and sellables, but rejects modifying TL services', () => {
    const validCart = [
      { item_type: 'product', name: 'Hakum Shirt', price_minor: 50000 },
      { item_type: 'product', name: 'Iced Coffee', price_minor: 12000 },
      { from_handoff: true, item_type: 'service', name: 'Deluxe Wash', price_minor: 40000 },
    ]
    const validResult = assertBranchAdminCart(validCart, { isBranchAdmin: true })
    assert.equal(validResult.ok, true)

    const invalidCart = [
      { from_handoff: false, item_type: 'service', name: 'Ceramic Coating Walk-in', price_minor: 1500000 },
    ]
    const invalidResult = assertBranchAdminCart(invalidCart, { isBranchAdmin: true })
    assert.equal(invalidResult.ok, false)
    assert.match(invalidResult.error, /Branch Admin sells merch and coffee only/)
  })

  it('calculateProjectedCashAdvance accurately previews outstanding employee debt', () => {
    // Existing debt ₱1,500 (150,000 minor) + payout of ₱500 (50,000 minor)
    const payout = calculateProjectedCashAdvance(150000, 'ca_release', 50000)
    assert.equal(payout.priorRemainingMinor, 150000)
    assert.equal(payout.amountMinor, 50000)
    assert.equal(payout.newRemainingMinor, 200000, 'Debt balance increments to ₱2,000')

    // Repayment of ₱1,000 (100,000 minor)
    const repayment = calculateProjectedCashAdvance(200000, 'ca_repay', 100000)
    assert.equal(repayment.priorRemainingMinor, 200000)
    assert.equal(repayment.newRemainingMinor, 100000, 'Debt balance decrements to ₱1,000')
  })

  it('buildBacoorDailyReport computes exact verified financial totals', () => {
    const sales = [
      { status: 'paid', payment_method: 'cash', total_minor: 50000, bucket: 'carwash' },
      { status: 'paid', payment_method: 'gcash', total_minor: 150000, bucket: 'coating' },
      { status: 'paid', payment_method: 'cash', total_minor: 80000, bucket: 'tint' },
      { status: 'paid', payment_method: 'card', total_minor: 250000, bucket: 'ppf' },
      { status: 'paid', payment_method: 'cash', total_minor: 15000, bucket: 'refreshment' },
    ]
    const expenses = [
      { status: 'approved', expense_kind: 'cleaning_supplies', amount_minor: 10000 },
      { status: 'approved', expense_kind: 'carwash_salary', amount_minor: 20000 },
      { status: 'approved', expense_kind: 'ca_repay', amount_minor: 5000 },
    ]
    const cashAdvances = [
      { status: 'approved', amount_minor: 7000, employee_name: 'Crew John' },
    ]

    const report = buildBacoorDailyReport({
      branch: 'bacoor',
      branchSlug: 'bacoor',
      date: '2026-11-06',
      sales,
      expenses,
      cashAdvances,
      classifyBucket: (r) => r.bucket,
    })

    // Total Sales: 500 + 1500 + 800 + 2500 + 150 = ₱5,450 (545,000 minor)
    assert.equal(report.total_sales_minor, 545000)

    // Category Sales Isolation
    assert.equal(report.car_wash_sales_minor, 50000, 'Pure car wash sales')
    assert.equal(report.ceramic_coating_sales_minor, 150000, 'Ceramic coating sales')
    assert.equal(report.ceramic_tint_sales_minor, 80000, 'Ceramic tint sales')
    assert.equal(report.ppf_sales_minor, 250000, 'PPF sales')
    assert.equal(report.refreshment_sales_minor, 15000, 'Refreshment sales')

    // Payment Channel Totals
    assert.equal(report.total_gcash_minor, 150000, 'GCash total')
    assert.equal(report.credit_card_minor, 250000, 'Card total')

    // Expenses = Cleaning (10,000) + Carwash Salary (20,000) + Approved CA (7,000) = 37,000 minor
    assert.equal(report.total_expenses_minor, 37000)

    // CA Collected (Repaid into drawer) = 5,000 minor
    assert.equal(report.ca_collected_minor, 5000)

    // Cash Sales = 50,000 + 80,000 + 15,000 = 145,000 minor
    // Cash Left = Cash Sales (145,000) - Total Expenses (37,000) + CA Collected (5,000) = 113,000 minor
    assert.equal(report.cash_sales_minor, 145000)
    assert.equal(report.total_cash_left_minor, 113000)

    const text = formatBacoorReportText(report)
    assert.match(text, /BACOOR SALES REPORT/)
    assert.match(text, /Total Sales: 5450/)
    assert.match(text, /Total Cash Left: 1130/)
  })
})

describe('Master Test Plan: 6. Inventory 4 Categories, Coffee Recipe & Zero-Cost Restock', () => {
  it('STOCK_CATEGORIES defines exact 4 categories with correct POS visibility', () => {
    assert.equal(STOCK_CATEGORIES.length, 4)
    const cats = Object.fromEntries(STOCK_CATEGORIES.map((c) => [c.id, c]))

    assert.equal(cats['merchandise'].pos, true)
    assert.equal(cats['coffee_menu'].pos, true)
    assert.equal(cats['coffee_material'].pos, false, 'Coffee Materials hidden from POS')
    assert.equal(cats['chemical'].pos, false, 'Chemicals hidden from POS')
  })

  it('MATERIAL_ROLES defines Cup and Beans roles for coffee deduction', () => {
    assert.equal(MATERIAL_ROLES.length, 2)
    assert.equal(MATERIAL_ROLES[0].id, 'cup')
    assert.equal(MATERIAL_ROLES[1].id, 'beans')
  })

  it('RESTOCK_POLICY_NOTICE codifies that restocks do not incur expense costs', () => {
    assert.match(RESTOCK_POLICY_NOTICE, /does not create an expense/i)
    assert.match(RESTOCK_POLICY_NOTICE, /Operating Expenses/i)
  })

  it('evaluateStockStatus tags stock levels appropriately', () => {
    assert.equal(evaluateStockStatus(0).status, 'out_of_stock')
    assert.equal(evaluateStockStatus(3).status, 'low_stock')
    assert.equal(evaluateStockStatus(25).status, 'in_stock')
  })
})

describe('Master Test Plan: 7. Office Payroll Engine & Payslips (No Tax Gross=Net)', () => {
  it('payslipTakeHome calculates gross = net without statutory tax withholdings', () => {
    // Base salary ₱15,000 (1,500,000 minor) + manual incentive ₱2,500 (250,000 minor)
    const takeHome = payslipTakeHome(1500000, 250000)
    assert.equal(takeHome, 1750000, 'Gross equals Net take-home with zero tax deducted')
  })

  it('isDayCrewRole accurately identifies day crew paid on daily sheet vs salaried office', () => {
    assert.equal(isDayCrewRole('staff'), true, 'day crew')
    assert.equal(isDayCrewRole('detailer'), true, 'day crew')
    assert.equal(isDayCrewRole('team_lead'), true, 'TL paid daily on floor sheet')
    assert.equal(isDayCrewRole('admin'), false, 'branch admin is office payroll')
    assert.equal(isDayCrewRole('assistant_super_admin'), false, 'ASA is office payroll')
  })

  it('payslipStatusLabel defines exact lifecycle statuses', () => {
    assert.equal(payslipStatusLabel('signed'), 'Signed')
    assert.equal(payslipStatusLabel('received'), 'Received')
    assert.equal(payslipStatusLabel('draft'), 'Sent')
  })
})

describe('Master Test Plan: 8. Detailing, Tint & PPF Pipeline', () => {
  it('DETAILING_BOARD_STATUSES defines all 7 stages in precise chronological order', () => {
    assert.equal(DETAILING_BOARD_STATUSES.length, 7)
    const expected = ['pending', 'confirmed', 'waiting', 'in_progress', 'final_checking', 'for_payment', 'completed']
    assert.deepEqual(DETAILING_BOARD_STATUSES.map((s) => s.id), expected)
  })

  it('nextDetailingBoardStatus progresses sequentially through every stage', () => {
    assert.equal(nextDetailingBoardStatus('pending'), 'confirmed')
    assert.equal(nextDetailingBoardStatus('confirmed'), 'waiting')
    assert.equal(nextDetailingBoardStatus('waiting'), 'in_progress')
    assert.equal(nextDetailingBoardStatus('in_progress'), 'final_checking')
    assert.equal(nextDetailingBoardStatus('final_checking'), 'for_payment')
    assert.equal(nextDetailingBoardStatus('for_payment'), 'completed')
    assert.equal(nextDetailingBoardStatus('completed'), null, 'terminal status has no next')
  })

  it('SALES_BOARD_STATUSES permits customer sales desk to manage bookings including cancellation', () => {
    assert.equal(isSalesBoardStatus('pending'), true)
    assert.equal(isSalesBoardStatus('cancelled'), true)
    assert.equal(isSalesBoardStatus('in_progress'), true)
    assert.equal(isSalesBoardStatus('invalid_fake_status'), false)
  })

  it('isOpenBookingStatus correctly segregates open pipeline from terminal archives', () => {
    assert.deepEqual(BOOKING_TERMINAL_STATUSES, ['completed', 'cancelled'])
    assert.equal(isOpenBookingStatus('pending'), true)
    assert.equal(isOpenBookingStatus('waiting'), true)
    assert.equal(isOpenBookingStatus('in_progress'), true)
    assert.equal(isOpenBookingStatus('completed'), false)
    assert.equal(isOpenBookingStatus('cancelled'), false)
  })
})

describe('Master Test Plan: 9. Multi-User Concurrency & Data Isolation Protection', () => {
  it('Cash Advance approval code enforces strict CA[A-Z0-9]{4} pattern', () => {
    assert.equal(normalizeCashAdvanceCode('ca-7k2m'), 'CA7K2M')
    assert.equal(normalizeCashAdvanceCode('  CA 89XQ  '), 'CA89XQ')
  })

  it('cashAdvanceReleaseError strictly prevents unauthorized or mismatched drawer releases', () => {
    const approvedRequest = {
      status: 'resolved',
      payload: { approval_code: 'CA7K2M', amount: 500, branch: 'bacoor' },
    }
    const lines = []

    // Missing code
    const errMissing = cashAdvanceReleaseError(
      { kind: 'ca_release', amount_minor: 50000, reason: '' },
      [approvedRequest],
      { branch: 'bacoor', lines },
    )
    assert.equal(errMissing, 'Type the approval code before cash leaves the drawer.')

    // Valid approved code and matching branch/amount
    const ok = cashAdvanceReleaseError(
      { kind: 'ca_release', amount_minor: 50000, reason: 'CA7K2M' },
      [approvedRequest],
      { branch: 'bacoor', lines },
    )
    assert.equal(ok, null)

    // Branch mismatch
    const errBranch = cashAdvanceReleaseError(
      { kind: 'ca_release', amount_minor: 50000, reason: 'CA7K2M' },
      [approvedRequest],
      { branch: 'dasma', lines },
    )
    assert.equal(errBranch, 'That approval code does not match an approved cash advance for this branch and amount.')

    // Amount mismatch
    const errAmount = cashAdvanceReleaseError(
      { kind: 'ca_release', amount_minor: 30000, reason: 'CA7K2M' },
      [approvedRequest],
      { branch: 'bacoor', lines },
    )
    assert.equal(errAmount, 'That approval code does not match an approved cash advance for this branch and amount.')
  })

  it('Inventory branch mutations calculate deterministic and isolated state changes', () => {
    // Restock delta addition
    assert.equal(applyRestockQty(10, 50), 60)
    assert.equal(applyRestockQty(0, 25), 25)

    // Owner absolute count set
    assert.equal(applyOwnerSetQty(150), 150)
    assert.equal(applyOwnerSetQty(-5), 0)

    // Sunday recon delta and usage
    const recon = applyReconLine({ previousQty: 100, leftoverQty: 85 })
    assert.equal(recon.nextQty, 85)
    assert.equal(recon.delta, -15)
    assert.equal(recon.usageQty, 15)
  })
})
