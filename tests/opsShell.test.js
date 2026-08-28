import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { opsTabSearchParams, resolveOpsTab } from '../src/lib/opsShell.js'

const root = join(import.meta.dirname, '..')

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('opsShell helpers', () => {
  it('resolveOpsTab falls back to default when param is missing or invalid', () => {
    const allowed = ['home', 'run', 'rules']
    assert.equal(resolveOpsTab(null, allowed, 'home'), 'home')
    assert.equal(resolveOpsTab('nope', allowed, 'home'), 'home')
    assert.equal(resolveOpsTab('run', allowed, 'home'), 'run')
  })

  it('opsTabSearchParams clears query for default tab', () => {
    assert.deepEqual(opsTabSearchParams('home', 'home'), {})
    assert.deepEqual(opsTabSearchParams('run', 'home'), { tab: 'run' })
  })
})

describe('ops shell components contract', () => {
  it('exports shared ops chrome with max-w-7xl and safe-area padding', () => {
    const shell = read('src/components/ops/OpsPageShell.jsx')
    assert.match(shell, /max-w-7xl/)
    assert.match(shell, /pb-\[max\(2rem,env\(safe-area-inset-bottom\)\)\]/)
    assert.match(shell, /tracking-\[0\.2em\] text-primary uppercase/)
  })

  it('OpsTabList uses shadcn TabsList h-11 touch targets', () => {
    const tabs = read('src/components/ops/OpsTabBar.jsx')
    assert.match(tabs, /TabsList/)
    assert.match(tabs, /inline-flex h-11/)
    assert.match(tabs, /min-h-9/)
  })
})

describe('ops shell adoption — settings + payroll', () => {
  it('Settings hub uses OpsPageShell', () => {
    const page = read('src/pages/SettingsHubPage.jsx')
    assert.match(page, /OpsPageShell/)
    assert.match(page, /hakum-settings-hub/)
    assert.doesNotMatch(page, /planner-v2-tabs/)
  })

  it('Payroll settings uses OpsPageShell with back link', () => {
    const page = read('src/pages/settings/PayrollSettingsPage.jsx')
    assert.match(page, /OpsPageShell/)
    assert.match(page, /\/operations\/settings/)
    assert.match(page, /\/operations\/payroll\?tab=rules/)
  })

  it('Payroll page uses ops shell, guide, and shadcn tab list — not planner-v2-tabs', () => {
    const page = read('src/pages/PayrollPage.jsx')
    assert.match(page, /OpsPageShell/)
    assert.match(page, /className="hakum-payroll"/)
    assert.match(page, /OpsGuideCard/)
    assert.match(page, /PAYROLL_WORKFLOW_STEPS/)
    assert.match(page, /OpsTabList/)
    assert.match(page, /const PAYROLL_SHELL_TABS = \[/)

    const tabIds = ['home', 'run', 'cash-advance', 'packages', 'history', 'rules']
    for (const id of tabIds) {
      assert.match(page, new RegExp(`id: '${id}'`))
    }

    assert.doesNotMatch(page, /planner-v2-tabs/)
    assert.match(page, /hakum-payroll-steps/)
    assert.match(page, /Floor pay|Fixed salary/)
    assert.match(page, /run_payroll/)
  })
})

describe('ops shell adoption — finance + my pay', () => {
  it('Finance uses OpsPageShell with guide and keeps finance tab rail', () => {
    const page = read('src/pages/FinancePage.jsx')
    assert.match(page, /OpsPageShell/)
    assert.match(page, /className="finance-shell hakum-finance/)
    assert.match(page, /OpsGuideCard/)
    assert.match(page, /FINANCE_WORKFLOW_STEPS/)
    assert.match(page, /finance-tabs-rail/)
    assert.match(page, /resolveFinanceTab/)
    assert.match(page, /expense-reports/)
    assert.doesNotMatch(page, /planner-v2-tabs/)
  })

  it('My pay uses OpsPageShell with guide and keeps payroll line table', () => {
    const page = read('src/pages/MyPayPage.jsx')
    assert.match(page, /OpsPageShell/)
    assert.match(page, /className="hakum-payroll hakum-my-pay"/)
    assert.match(page, /OpsGuideCard/)
    assert.match(page, /MY_PAY_WORKFLOW_STEPS/)
    assert.match(page, /currentPostedPayoutMinor/)
    assert.match(page, /Estimate — unpaid/)
    assert.match(page, /Today \(confirmed\)/)
    assert.match(page, /hakum-payroll-table/)
    assert.match(page, /payroll_run_lines/)
  })
})

describe('ops shell adoption — inventory', () => {
  it('Inventory catalog uses OpsPageShell and shadcn tab list — not planner-v2', () => {
    const page = read('src/pages/InventoryPage.jsx')
    assert.match(page, /OpsPageShell/)
    assert.match(page, /className="hakum-inventory"/)
    assert.match(page, /OpsGuideCard/)
    assert.match(page, /INVENTORY_WORKFLOW_STEPS/)
    assert.match(page, /OpsTabList/)
    assert.match(page, /const INVENTORY_SHELL_TABS = \[/)

    for (const id of ['bay', 'detailing', 'merch', 'stock']) {
      assert.match(page, new RegExp(`id: '${id}'`))
    }

    assert.match(page, /catalogScope="bay"/)
    assert.match(page, /catalogScope="detailing"/)
    assert.match(page, /BranchInventoryPage embedded/)
    assert.doesNotMatch(page, /planner-v2/)
  })

  it('Branch inventory standalone uses OpsPageShell; embedded skips shell', () => {
    const page = read('src/pages/BranchInventoryPage.jsx')
    assert.match(page, /OpsPageShell/)
    assert.match(page, /if \(embedded\) return body/)
    assert.match(page, /BRANCH_STOCK_TABS/)
    assert.match(page, /Sunday Recon/)
    assert.match(page, /product_branch_stock/)
    assert.doesNotMatch(page, /planner-v2-tabs/)
  })
})

describe('ops shell adoption — queue + bookings', () => {
  it('Queue board uses OpsPageShell, guide, and shadcn tab list — keeps lane board', () => {
    const page = read('src/pages/OperationsPages.jsx')
    assert.match(page, /className="hakum-queue queue-board"/)
    assert.match(page, /OpsGuideCard/)
    assert.match(page, /QUEUE_WORKFLOW_STEPS/)
    assert.match(page, /until POS completes/)
    assert.match(page, /const QUEUE_SHELL_TABS = Object\.freeze\(\[/)
    assert.match(page, /OpsTabList tabs={QUEUE_SHELL_TABS}/)
    assert.match(page, /queue-lane-board-fit/)
    assert.match(page, /view === 'table'/)
    assert.doesNotMatch(page, /queue-seg/)
  })

  it('Bookings board uses OpsPageShell, guide, and shadcn tab list', () => {
    const page = read('src/pages/BookingBoardPage.jsx')
    assert.match(page, /OpsPageShell/)
    assert.match(page, /className="hakum-bookings bk-page"/)
    assert.match(page, /OpsGuideCard/)
    assert.match(page, /BOOKING_WORKFLOW_STEPS/)
    assert.match(page, /OpsTabList/)
    assert.match(page, /const BOOKING_SHELL_TABS = Object\.freeze\(\[/)
    assert.match(page, /Open pipeline stays on board\/calendar until released\/cancelled/)
    assert.match(page, /booking-lane-board/)
    assert.match(page, /getBookingBoardStatuses/)
    assert.doesNotMatch(page, /bk-hero/)
    assert.doesNotMatch(page, /bk-tabs/)
  })
})

describe('ops shell adoption — CRM, memberships, reviews', () => {
  it('CRM uses OpsPageShell, guide, and shadcn tab list — keeps customer notes tab', () => {
    const page = read('src/pages/CrmPage.jsx')
    assert.match(page, /OpsPageShell/)
    assert.match(page, /className="hakum-crm"/)
    assert.match(page, /OpsGuideCard/)
    assert.match(page, /CRM_WORKFLOW_STEPS/)
    assert.match(page, /OpsTabList/)
    assert.match(page, /const CRM_SHELL_TABS = Object\.freeze\(\[/)
    assert.match(page, /resolveOpsTab/)
    assert.match(page, /canViewQueueOperations/)
    assert.match(page, /value="notes"/)

    for (const id of ['directory', 'groups', 'insights', 'sms']) {
      assert.match(page, new RegExp(`id: '${id}'`))
    }

    assert.doesNotMatch(page, /tracking-\[0\.22em\].*CRM/)
  })

  it('Memberships uses OpsPageShell, guide, and shadcn tab list — keeps program controls', () => {
    const page = read('src/pages/MembershipsPage.jsx')
    assert.match(page, /OpsPageShell/)
    assert.match(page, /className="hakum-memberships"/)
    assert.match(page, /OpsGuideCard/)
    assert.match(page, /MEMBERSHIPS_WORKFLOW_STEPS/)
    assert.match(page, /OpsTabList/)
    assert.match(page, /const MEMBERSHIPS_SHELL_TABS = Object\.freeze\(\[/)
    assert.match(page, /superAdmin \?/)
    assert.match(page, /stamps_enabled/)
    assert.match(page, /stamp_earn_mode/)
    assert.match(page, /revokeCustomerMembership/)

    for (const id of ['program', 'tiers', 'loyalty', 'scoring', 'assign']) {
      assert.match(page, new RegExp(`id: '${id}'`))
    }

    assert.doesNotMatch(page, /tracking-\[0\.22em\]/)
  })

  it('Reviews uses OpsPageShell with guide and visit review axes', () => {
    const page = read('src/pages/ReviewsPage.jsx')
    assert.match(page, /OpsPageShell/)
    assert.match(page, /className="hakum-reviews"/)
    assert.match(page, /OpsGuideCard/)
    assert.match(page, /REVIEWS_WORKFLOW_STEPS/)
    assert.match(page, /VISIT_REVIEW_AXES/)
    assert.match(page, /service_reviews/)
    assert.doesNotMatch(page, /tracking-\[0\.22em\]/)
  })
})

describe('ops shell adoption — KPI, planning, my tasks', () => {
  it('KPI uses OpsPageShell, guide, and shadcn tab list — keeps hover stats', () => {
    const page = read('src/pages/KpiPage.jsx')
    assert.match(page, /OpsPageShell/)
    assert.match(page, /className="hakum-kpi"/)
    assert.match(page, /OpsGuideCard/)
    assert.match(page, /KPI_WORKFLOW_STEPS/)
    assert.match(page, /OpsTabList/)
    assert.match(page, /const KPI_SHELL_TABS = Object\.freeze\(\[/)
    assert.match(page, /kpiStatHover/)
    assert.match(page, /get_crew_kpi/)
    assert.doesNotMatch(page, /planner-v2-head/)

    for (const id of ['crew', 'compare', 'service', 'sales', 'complaints']) {
      assert.match(page, new RegExp(`id: '${id}'`))
    }
  })

  it('Planning keeps planner-v2 board chrome inside OpsPageShell', () => {
    const page = read('src/pages/PlanningBoardPage.jsx')
    assert.match(page, /OpsPageShell/)
    assert.match(page, /className="hakum-planning"/)
    assert.match(page, /OpsGuideCard/)
    assert.match(page, /PLANNING_WORKFLOW_STEPS/)
    assert.match(page, /OpsTabList/)
    assert.match(page, /const PLANNING_SHELL_TABS = Object\.freeze/)
    assert.match(page, /planner-v2/)
    assert.match(page, /plannerTabsForAccess/)
    assert.match(page, /TaskModal/)
    assert.match(page, /New task/)
  })

  it('My Tasks uses OpsPageShell with guide and planner-ticket cards', () => {
    const page = read('src/pages/OperationsPages.jsx')
    assert.match(page, /hakum-my-tasks/)
    assert.match(page, /MY_TASKS_WORKFLOW_STEPS/)
    assert.match(page, /Assigned work/)
    assert.match(page, /planProofObjectPath/)
    assert.match(page, /Photo \(required\)/)
  })
})

describe('ops shell adoption — phase 7 admin + secondary + floor', () => {
  const shellPages = [
    ['People', 'src/pages/PeopleManagePage.jsx', 'hakum-people'],
    ['Branches', 'src/pages/BranchesManagePage.jsx', 'hakum-branches'],
    ['Cars', 'src/pages/CarsCatalogPage.jsx', 'hakum-cars'],
    ['Audit', 'src/pages/AuditLogPage.jsx', 'hakum-audit'],
    ['Data center', 'src/pages/DataCenterPage.jsx', 'hakum-data-center'],
    ['Console', 'src/pages/AdminConsolePage.jsx', 'hakum-console'],
    ['History', 'src/pages/HistoryPage.jsx', 'hakum-history'],
    ['Notifications', 'src/pages/NotificationsPage.jsx', 'hakum-notifications'],
    ['Content', 'src/pages/ContentAdminPage.jsx', 'hakum-content'],
    ['Inquiries', 'src/pages/InquiriesPage.jsx', 'hakum-inquiries'],
    ['Ops Lab', 'src/pages/OpsRoadmapPage.jsx', 'hakum-ops-lab'],
    ['Attendance', 'src/pages/AttendancePage.jsx', 'hakum-attendance'],
    ['POS', 'src/pages/PosPage.jsx', 'hakum-pos'],
  ]

  for (const [label, rel, shellClass] of shellPages) {
    it(`${label} uses OpsPageShell with ${shellClass}`, () => {
      const page = read(rel)
      assert.match(page, /OpsPageShell/)
      assert.match(page, new RegExp(`className=.*${shellClass}`))
    })
  }

  it('Console uses OpsTabList for section tabs', () => {
    const page = read('src/pages/AdminConsolePage.jsx')
    assert.match(page, /OpsTabList/)
    assert.match(page, /id: 'queue'/)
    assert.match(page, /id: 'stock'/)
  })

  it('Content admin uses OpsTabList for blogs/events', () => {
    const page = read('src/pages/ContentAdminPage.jsx')
    assert.match(page, /OpsTabList/)
    assert.match(page, /id: 'blogs'/)
    assert.match(page, /id: 'events'/)
  })

  it('Attendance and POS use OpsTabList', () => {
    assert.match(read('src/pages/AttendancePage.jsx'), /OpsTabList/)
    assert.match(read('src/pages/PosPage.jsx'), /OpsTabList/)
    assert.match(read('src/pages/PosPage.jsx'), /id: 'checkout'/)
  })

  it('Dashboard, Crew, New Ticket use OpsPageShell (no PageHeader)', () => {
    const page = read('src/pages/OperationsPages.jsx')
    assert.match(page, /hakum-dashboard/)
    assert.match(page, /hakum-crew/)
    assert.match(page, /hakum-new-ticket/)
    assert.match(page, /hakum-queue-ticket/)
    assert.doesNotMatch(page, /function PageHeader/)
  })

  it('PosPage merch family uses shadcn buttons — not planner-v2-tabs', () => {
    const page = read('src/pages/PosPage.jsx')
    assert.match(page, /MerchFamilyToolbar/)
    assert.doesNotMatch(page, /planner-v2-tabs/)
  })
})
