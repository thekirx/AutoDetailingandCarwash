import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'
import { ROLES } from '../src/auth/permissions.js'
import {
  buildSmartSearchDestinations,
  describeSearchCapabilities,
  filterSmartSearchDestinations,
} from '../src/lib/smartSearchCatalog.js'
import {
  handleSmartSearchRequest,
  resolveSearchScope,
  runScopedQueries,
  sanitizeSearchTerm,
} from '../server/smartSearchApi.mjs'

function mockRes() {
  const out = { statusCode: 200, headers: {}, body: '' }
  return {
    out,
    setHeader(name, value) {
      out.headers[name] = value
    },
    end(body = '') {
      out.body = body
    },
    get statusCode() {
      return out.statusCode
    },
    set statusCode(value) {
      out.statusCode = value
    },
  }
}

describe('Smart Search sanitization & server RBAC scopes', () => {
  it('strips PostgREST .or() delimiter characters and truncates safely', () => {
    assert.equal(sanitizeSearchTerm('  %abc_(123),*\'test"\\  '), 'abc 123 test')
    assert.equal(sanitizeSearchTerm('a'.repeat(100)).length, 64)
    assert.equal(sanitizeSearchTerm('   '), '')
  })

  it('rejects missing or inactive staff profiles', () => {
    assert.equal(resolveSearchScope(null), null)
    assert.equal(resolveSearchScope({ role: ROLES.STAFF, is_active: false }), null)
    assert.equal(resolveSearchScope({ is_active: true }), null)
  })

  it('grants BossMich (Super Admin) full multi-branch search scope', () => {
    const scope = resolveSearchScope({
      id: 'boss-1',
      role: ROLES.SUPER_ADMIN,
      branch_slug: 'alabang',
      is_active: true,
    })
    assert.equal(scope.allBranches, true)
    assert.equal(scope.branchSlugs, null)
    assert.equal(scope.canBookings, true)
    assert.equal(scope.detailingOnlyBookings, false)
    assert.equal(scope.canCustomers, true)
    assert.equal(scope.canVehicles, true)
    assert.equal(scope.canAllPlanning, true)
    assert.equal(scope.canAssignedTasksOnly, false)
    assert.equal(scope.canFormResults, true)
    assert.equal(scope.canCatalog, true)
    assert.equal(scope.canStaff, true)
    assert.equal(scope.canVouchers, true)
    assert.equal(scope.canBranches, true)
  })

  it('enforces explicit permission grants on Assistant Super Admin', () => {
    const restricted = resolveSearchScope({
      id: 'asa-1',
      role: ROLES.ASSISTANT_SUPER_ADMIN,
      branch_slug: 'bgc',
      permission_grants: {
        bookings: true,
        queue_all: true,
        crm: false,
        people: false,
        branches: false,
        branches_all: false,
        history: false,
        inventory: false,
      },
      is_active: true,
    })
    assert.equal(restricted.allBranches, false)
    assert.deepEqual(restricted.branchSlugs, ['bgc'])
    assert.equal(restricted.canBookings, true)
    assert.equal(restricted.canCustomers, false)
    assert.equal(restricted.canStaff, true)
    assert.equal(restricted.canBranches, false)
    assert.equal(restricted.canVouchers, true)

    const granted = resolveSearchScope({
      id: 'asa-2',
      role: ROLES.ASSISTANT_SUPER_ADMIN,
      permission_grants: { crm: true, people: true, branches: true, branches_all: true },
      is_active: true,
    })
    assert.equal(granted.allBranches, true)
    assert.equal(granted.canCustomers, true)
    assert.equal(granted.canStaff, true)
    assert.equal(granted.canBranches, true)
  })

  it('locks Branch Admin & Team Lead to assigned branches (fail-closed when empty)', () => {
    const unbranchAdmin = resolveSearchScope({
      id: 'ba-empty',
      role: ROLES.ADMIN,
      branch_slug: null,
      is_active: true,
    })
    assert.equal(unbranchAdmin.allBranches, false)
    assert.deepEqual(unbranchAdmin.branchSlugs, [])
    assert.equal(unbranchAdmin.canBranches, true)
    assert.equal(unbranchAdmin.canVouchers, false)
    assert.equal(unbranchAdmin.canStaff, true)

    const teamLead = resolveSearchScope(
      {
        id: 'tl-1',
        role: ROLES.TEAM_LEAD,
        branch_slug: 'bgc',
        is_active: true,
      },
      ['alabang'],
    )
    assert.equal(teamLead.allBranches, false)
    assert.deepEqual(teamLead.branchSlugs, ['bgc', 'alabang'])
    assert.equal(teamLead.canBookings, true)
    assert.equal(teamLead.canCustomers, true)
    assert.equal(teamLead.canAllPlanning, true)
    assert.equal(teamLead.canFormResults, true)
    assert.equal(teamLead.canStaff, false)
  })

  it('scopes Operations Lead across all branches without branch-management or voucher gates', () => {
    const opsLead = resolveSearchScope({
      id: 'ol-1',
      role: ROLES.OPERATIONS_LEAD,
      branch_slug: 'alabang',
      is_active: true,
    })
    assert.equal(opsLead.allBranches, true)
    assert.equal(opsLead.canBookings, true)
    assert.equal(opsLead.canCustomers, true)
    assert.equal(opsLead.canAllPlanning, true)
    assert.equal(opsLead.canFormResults, true)
    assert.equal(opsLead.canVouchers, false)
    assert.equal(opsLead.canBranches, false)
  })

  it('scopes Sales, Staff, Detailer, Marketing, Video Editor, and Investor strictly by role', () => {
    const sales = resolveSearchScope({ id: 's1', role: ROLES.SALES, branch_slug: 'bgc', is_active: true })
    assert.equal(sales.allBranches, true)
    assert.equal(sales.branchSlugs, null)
    assert.equal(sales.canBookings, true)
    assert.equal(sales.canCustomers, true)
    assert.equal(sales.canStaff, false)
    assert.equal(sales.canCatalog, true)

    const staff = resolveSearchScope({ id: 'st1', role: ROLES.STAFF, branch_slug: 'bgc', is_active: true })
    assert.deepEqual(staff.branchSlugs, ['bgc'])
    assert.equal(staff.canBookings, true)
    assert.equal(staff.canCustomers, false)
    assert.equal(staff.canAssignedTasksOnly, false)
    assert.equal(staff.canAllPlanning, true)
    assert.equal(staff.canFormResults, false)
    assert.equal(staff.canStaff, false)

    const detailer = resolveSearchScope({ id: 'd1', role: ROLES.DETAILER, branch_slug: 'bgc', is_active: true })
    assert.equal(detailer.canBookings, true)
    assert.equal(detailer.detailingOnlyBookings, true)
    assert.equal(detailer.canCustomers, false)
    assert.equal(detailer.canVehicles, false)
    assert.equal(detailer.canAssignedTasksOnly, true)
    assert.equal(detailer.canStaff, false)

    const marketing = resolveSearchScope({ id: 'm1', role: ROLES.MARKETING, branch_slug: null, is_active: true })
    assert.equal(marketing.allBranches, true)
    assert.equal(marketing.canCustomers, true)
    assert.equal(marketing.canVouchers, false)
    assert.equal(marketing.canStaff, false)
    assert.equal(marketing.canAllPlanning, true)

    const editor = resolveSearchScope({ id: 'v1', role: ROLES.VIDEO_EDITOR, branch_slug: 'alabang', is_active: true })
    assert.deepEqual(editor.branchSlugs, ['alabang'])
    assert.equal(editor.canBookings, false)
    assert.equal(editor.canCustomers, false)
    assert.equal(editor.canAssignedTasksOnly, false)
    assert.equal(editor.canAllPlanning, true)
    assert.equal(editor.canFormResults, false)
    assert.equal(editor.canStaff, false)

    const investor = resolveSearchScope({ id: 'i1', role: ROLES.INVESTOR, branch_slug: 'bgc', is_active: true })
    assert.equal(investor.allBranches, false)
    assert.deepEqual(investor.branchSlugs, ['bgc'])
    assert.equal(investor.canBookings, true)
    assert.equal(investor.canCustomers, false)
    assert.equal(investor.canCatalog, false)
    assert.equal(investor.canStaff, false)
    assert.equal(investor.canVouchers, true)
  })
})

describe('Smart Search destination catalog RBAC', () => {
  it('excludes Finance, Settings, People, and CRM destinations from restricted roles', () => {
    for (const role of [ROLES.STAFF, ROLES.DETAILER, ROLES.VIDEO_EDITOR, ROLES.INVESTOR, ROLES.MARKETING]) {
      const profile = { id: `u-${role}`, role, branch_slug: 'bgc', is_active: true }
      const dests = buildSmartSearchDestinations(profile)
      const paths = dests.map((d) => d.to)

      assert.ok(paths.length > 0, `expected at least one destination for ${role}`)
      assert.ok(!paths.some((p) => p.startsWith('/operations/finance') && role !== ROLES.INVESTOR), `${role} must not see finance`)
      assert.ok(!paths.some((p) => p.startsWith('/operations/settings')), `${role} must not see settings`)
      assert.ok(!paths.some((p) => p.startsWith('/operations/people')), `${role} must not see people`)
      if (role !== ROLES.MARKETING) {
        assert.ok(!paths.some((p) => p.startsWith('/operations/crm')), `${role} must not see crm`)
      }
    }
  })

  it('gives Super Admin rich sub-tab destinations and fuzzy multi-term filtering', () => {
    const boss = { id: 'boss', role: ROLES.SUPER_ADMIN, is_active: true }
    const dests = buildSmartSearchDestinations(boss)
    const paths = new Set(dests.map((d) => d.to))

    assert.ok(paths.has('/operations/notifications?tab=templates'))
    assert.ok(paths.has('/operations/notifications?tab=broadcast'))
    assert.ok(paths.has('/operations/crm?tab=sms'))
    assert.ok(paths.has('/operations/settings/tint-finder'))
    assert.ok(paths.has('/operations/finance?tab=sheets'))

    const smsMatches = filterSmartSearchDestinations(dests, 'busybee sms')
    assert.ok(smsMatches.some((m) => m.to.includes('/operations/notifications') || m.to.includes('/operations/crm?tab=sms')))

    const caps = describeSearchCapabilities(boss)
    assert.ok(caps.includes('Bookings & Queue'))
    assert.ok(caps.includes('Customers'))
    assert.ok(caps.includes('Staff'))
  })

  it('gives Assistant Super Admin destinations strictly matching route permission grants', () => {
    const asa = {
      id: 'asa',
      role: ROLES.ASSISTANT_SUPER_ADMIN,
      permission_grants: {
        bookings: true,
        services_merch: true,
        finance_view: false,
        finance_write: false,
        reports: false,
        crm: false,
        people: false,
        branches: false,
      },
      is_active: true,
    }
    const paths = buildSmartSearchDestinations(asa).map((d) => d.to)
    assert.ok(paths.includes('/operations/bookings'))
    assert.ok(paths.includes('/operations/inventory'))
    assert.ok(!paths.some((p) => p.startsWith('/operations/finance')))
    assert.ok(!paths.some((p) => p.startsWith('/operations/people')))
  })
})

describe('Smart Search HTTP & UI integration contracts', () => {
  it('returns 401 when unauthenticated and 405 for non-GET methods', async () => {
    const res405 = mockRes()
    await handleSmartSearchRequest({ method: 'POST', headers: {} }, res405)
    assert.equal(res405.out.statusCode, 405)

    const res401 = mockRes()
    await handleSmartSearchRequest({ method: 'GET', headers: {}, url: '/api/staff?operation=smart-search&q=wash' }, res401)
    assert.equal(res401.out.statusCode, 401)
  })

  it('mounts <Command shouldFilter={false}> inside CommandMenu and renders sidebar + topbar triggers in both shells', () => {
    const root = resolve(process.cwd())
    const commandMenu = readFileSync(resolve(root, 'src/components/ops/CommandMenu.jsx'), 'utf8')
    const opsLayout = readFileSync(resolve(root, 'src/layouts/OperationsLayout.jsx'), 'utf8')

    assert.match(commandMenu, /<Command\s+shouldFilter=\{false\}/)
    assert.match(commandMenu, /\/api\/staff\?operation=smart-search&q=/)
    assert.match(opsLayout, /command-rail-search/)
    assert.match(opsLayout, /floor-rail-search/)
    assert.match(opsLayout, /floor-topbar-search/)
    assert.ok((opsLayout.match(/<CommandMenu\s+open=/g) || []).length >= 2, 'CommandMenu must mount in both FloorAppShell and CommandShell')
  })

  it('uses real Postgres column names and enforces Investor & branch filters in runScopedQueries', async () => {
    const recorded = []
    function makeDb() {
      return {
        from(table) {
          const entry = { table, select: '', ors: [], ins: [], eqs: [] }
          recorded.push(entry)
          const builder = {
            select(cols) {
              entry.select = cols
              return builder
            },
            or(expr) {
              entry.ors.push(expr)
              return builder
            },
            eq(k, v) {
              entry.eqs.push([k, v])
              return builder
            },
            neq() {
              return builder
            },
            in(k, v) {
              entry.ins.push([k, v])
              return builder
            },
            ilike() {
              return builder
            },
            order() {
              return builder
            },
            limit() {
              return builder
            },
            then(cb) {
              return Promise.resolve({ data: [], error: null }).then(cb)
            },
          }
          return builder
        },
      }
    }

    const bossScope = resolveSearchScope({ id: 'boss-1', role: ROLES.SUPER_ADMIN, is_active: true })
    await runScopedQueries(makeDb(), bossScope, 'civic')

    const veh = recorded.find((r) => r.table === 'vehicles')
    assert.ok(veh, 'Super Admin must query vehicles')
    assert.match(veh.select, /vehicle_make/)
    assert.doesNotMatch(veh.select, /\bmake\b/)

    const cards = recorded.find((r) => r.table === 'plan_cards')
    assert.ok(cards, 'Super Admin must query plan_cards')
    assert.doesNotMatch(cards.select.split('plan_lists')[0], /board_id/)
    assert.match(cards.select, /plan_lists!inner\(board_id/)

    const svc = recorded.find((r) => r.table === 'services')
    assert.ok(svc, 'Super Admin must query services')
    assert.doesNotMatch(svc.select, /\bcategory\b/)

    const vouchers = recorded.find((r) => r.table === 'promo_vouchers')
    assert.ok(vouchers, 'Super Admin must query promo_vouchers')
    assert.match(vouchers.select, /\btitle\b/)
    assert.doesNotMatch(vouchers.select, /\blabel\b/)

    recorded.length = 0
    const invScope = resolveSearchScope({ id: 'inv-1', role: ROLES.INVESTOR, branch_slug: 'bgc', is_active: true })
    await runScopedQueries(makeDb(), invScope, 'maria')
    const invBookings = recorded.find((r) => r.table === 'bookings')
    assert.ok(invBookings, 'Investor queries detailing bookings on their branch')
    assert.ok(invBookings.ins.some(([col, vals]) => col === 'branch' && vals.includes('bgc')))
    assert.ok(!invBookings.ors.some((expr) => expr.includes('customer_name') || expr.includes('customer_phone')), 'Investor search must never query by customer name/phone')

    recorded.length = 0
    const detailerScope = resolveSearchScope({ id: 'd-1', role: ROLES.DETAILER, branch_slug: 'bgc', is_active: true })
    await runScopedQueries(makeDb(), detailerScope, 'ceramic')
    const assign = recorded.find((r) => r.table === 'plan_card_assignees')
    assert.ok(assign, 'Detailer queries assigned tasks')
    assert.doesNotMatch(assign.select, /is_archived/)
  })
})
