/**
 * Principal leftover seams: chrome vs pay, finance deep-links, homepage
 * coming-soon from DB, ceramic book CTA, inquiries workflow, detailer family lock.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ROLES,
  allowRoute,
  canAccessConsole,
  canAccessCrm,
  canAccessNotifications,
  canAccessReviews,
  canManageSiteContent,
  canViewOwnPay,
  canViewQueueOperations,
  getDetailerMore,
  getMarketingMore,
  getOperationsNav,
  getSalesMore,
  getTeamLeadMore,
  getVideoEditorMore,
} from '../src/auth/permissions.js'
import { opsRouteKeyFromPath } from '../src/auth/authRedirect.js'
import { resolveFinanceTab } from '../src/lib/financeData.js'
import { currentPostedPayoutMinor } from '../src/lib/payroll.js'
import { canSwitchQueueFamily, queueFamilyForProfile, QUEUE_FAMILY_WASH } from '../src/lib/queueFamilies.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('Floor chrome includes My pay when the role can view it', () => {
  it('puts Pay on TL / sales / marketing / detailer / video overflow', () => {
    const teamLead = { role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' }
    const sales = { role: ROLES.SALES, branch_slug: 'bacoor' }
    const marketing = { role: ROLES.MARKETING, branch_slug: 'bacoor' }
    const detailer = { role: ROLES.DETAILER, branch_slug: 'bacoor' }
    const video = { role: ROLES.VIDEO_EDITOR, branch_slug: 'bacoor' }
    for (const p of [teamLead, sales, marketing, detailer, video]) {
      assert.equal(canViewOwnPay(p), true, p.role)
    }
    assert.ok(getTeamLeadMore(teamLead).some((i) => i.to === '/operations/my-pay'))
    assert.equal(getTeamLeadMore(teamLead).some((i) => i.to === '/operations/crew'), false)
    assert.ok(getSalesMore(sales).some((i) => i.to === '/operations/my-pay'))
    assert.ok(getMarketingMore(marketing).some((i) => i.to === '/operations/my-pay'))
    assert.ok(getDetailerMore(detailer).some((i) => i.to === '/operations/my-pay'))
    assert.ok(getVideoEditorMore(video).some((i) => i.to === '/operations/my-pay'))
  })
})

describe('Post-login path covers live ops routes', () => {
  it('maps attendance history reviews content notifications broadcast', () => {
    assert.equal(opsRouteKeyFromPath('/operations/attendance'), 'attendance')
    assert.equal(opsRouteKeyFromPath('/operations/history'), 'history')
    assert.equal(opsRouteKeyFromPath('/operations/reviews'), 'reviews')
    assert.equal(opsRouteKeyFromPath('/operations/content'), 'content')
    assert.equal(opsRouteKeyFromPath('/operations/notifications'), 'notifications')
    assert.equal(opsRouteKeyFromPath('/operations/broadcast'), 'notifications')
  })
})

describe('Finance tab alias', () => {
  it('sends the old expenses deep-link to Purchases', () => {
    assert.equal(resolveFinanceTab('expenses'), 'purchases')
    assert.equal(resolveFinanceTab('purchases'), 'purchases')
    assert.equal(resolveFinanceTab('nope'), 'overview')
    const pos = read('src/pages/PosPage.jsx')
    assert.match(pos, /\/operations\/finance\?tab=purchases/)
    assert.doesNotMatch(pos, /finance\?tab=expenses/)
    const page = read('src/pages/FinancePage.jsx')
    assert.match(page, /resolveFinanceTab/)
  })
})

describe('Finance P&L chrome', () => {
  it('does not paint three fake-active format switchers', () => {
    const src = read('src/pages/finance/FinancePLTab.jsx')
    assert.doesNotMatch(src, /COMMON_FORMATS/)
    assert.doesNotMatch(src, /is-active/)
  })
})

describe('My pay current payout', () => {
  it('sums every line on the latest posted run, not the first row', () => {
    const lines = [
      { amount_minor: 400, payroll_runs: { status: 'confirmed', period_start: '2026-08-11', period_end: '2026-08-17', confirmed_at: '2026-08-18T01:00:00Z' } },
      { amount_minor: 600, payroll_runs: { status: 'confirmed', period_start: '2026-08-11', period_end: '2026-08-17', confirmed_at: '2026-08-18T01:00:00Z' } },
      { amount_minor: 9000, payroll_runs: { status: 'confirmed', period_start: '2026-08-04', period_end: '2026-08-10', confirmed_at: '2026-08-11T01:00:00Z' } },
    ]
    const current = currentPostedPayoutMinor(lines)
    assert.equal(current.amountMinor, 1000)
    assert.equal(current.periodStart, '2026-08-11')
    const page = read('src/pages/MyPayPage.jsx')
    assert.match(page, /currentPostedPayoutMinor/)
  })
})

describe('Ceramic package book CTA', () => {
  it('books Ceramic Coating with the package name, same prefill as PPF', () => {
    const src = read('src/components/public/home/HomeServiceSections.jsx')
    assert.match(src, /to="\/book"/)
    assert.match(src, /service: 'Ceramic Coating'/)
    assert.match(src, /package: item\.title/)
  })
})

describe('Inquiries inbox can work partnership status', () => {
  it('exposes status actions that write the partnership CHECK values', () => {
    const lib = read('src/lib/partnershipInquiry.js')
    assert.match(lib, /PARTNERSHIP_STATUSES = \['new', 'reviewing', 'contacted', 'archived'\]/)
    const page = read('src/pages/InquiriesPage.jsx')
    assert.match(page, /PARTNERSHIP_STATUSES/)
    assert.match(page, /\.update\(\{ status/)
    const css = read('src/styles.css')
    assert.match(css, /\.inquiry-row\s*\{[^}]*var\(--border\)/s)
  })
})

describe('Homepage coming-soon is branch rows, not a hardcoded city', () => {
  it('loads visible branches and copies coming-soon names from cards', () => {
    const landing = read('src/pages/PublicLandingPage.jsx')
    assert.match(landing, /mode:\s*['"]visible['"]/)
    const ending = read('src/components/public/home/HomeEndingSections.jsx')
    assert.match(ending, /comingSoonHomeCopy/)
    assert.doesNotMatch(ending, /Dasmariñas coming soon/)
  })
})

describe('Queue is wash-only; detailing is Bookings', () => {
  it('collapses family params to wash and hides the family switcher', () => {
    const p = { role: 'detailer' }
    assert.equal(queueFamilyForProfile('', p), QUEUE_FAMILY_WASH)
    assert.equal(queueFamilyForProfile('detailing', p), QUEUE_FAMILY_WASH)
    assert.equal(canSwitchQueueFamily(p), false)
    assert.equal(queueFamilyForProfile('', { role: 'team_lead' }), QUEUE_FAMILY_WASH)
    const src = read('src/pages/OperationsPages.jsx')
    assert.match(src, /queueFamilyForProfile/)
    assert.doesNotMatch(src, /aria-label="Service family"/)
    assert.match(src, /Detailing lives on Bookings/)
  })
})

describe('Live leftover SQL', () => {
  it('drops the legacy MAX+1 queue trigger and revokes stamp minting from authenticated', () => {
    const sql = read('supabase/migrations/20260820120000_leftover_hot_path.sql')
    assert.match(sql, /drop trigger if exists trg_assign_daily_queue_number/)
    assert.match(sql, /revoke all on function public\.award_loyalty_stamps/)
    assert.match(sql, /from public, anon, authenticated/)
    assert.match(sql, /revoke all on function public\.is_inquiry_reader/)
  })

  it('revokes client execute on the two-arg queue allocator and adds complaints UPDATE RLS', () => {
    const sql = read('supabase/migrations/20260820130000_leftover_gate_rpc.sql')
    assert.match(sql, /revoke all on function public\.assign_daily_queue_number\(text, date\)/)
    assert.match(sql, /from public, anon, authenticated/)
    assert.match(sql, /for update to authenticated/)
    assert.match(sql, /using \(public\.is_inquiry_reader\(\)\)/)
  })
})

describe('Branch Admin allowRoute matches Command nav', () => {
  it('denies finance CRM people console by URL; keeps POS floor reviews audit', () => {
    const p = { role: ROLES.ADMIN, branch_slug: 'bacoor', branch_slugs: ['bacoor'] }
    const navKeys = getOperationsNav(p).map((i) => {
      const rest = String(i.to).split('?')[0].replace(/^\/operations\//, '')
      return rest.split('/')[0]
    })
    for (const key of navKeys) {
      assert.equal(allowRoute(p, key), true, key)
    }
    assert.equal(allowRoute(p, 'pos'), true)
    assert.equal(allowRoute(p, 'finance'), false)
    assert.equal(allowRoute(p, 'crm'), false)
    assert.equal(allowRoute(p, 'people'), false)
    assert.equal(allowRoute(p, 'console'), false)
    assert.equal(allowRoute(p, 'memberships'), false)
    assert.equal(allowRoute(p, 'settings'), false)
  })
})

describe('ASA CRM and content follow grants', () => {
  it('denies CRM and Content when those grants are off', () => {
    const p = {
      role: ROLES.ASSISTANT_SUPER_ADMIN,
      permission_grants: { crm: false, content: false },
    }
    assert.equal(canAccessCrm(p), false)
    assert.equal(canManageSiteContent(p), false)
    assert.equal(allowRoute(p, 'crm'), false)
    assert.equal(allowRoute(p, 'content'), false)
    const open = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: {} }
    assert.equal(canAccessCrm(open), true)
    assert.equal(canManageSiteContent(open), true)
  })

  it('denies console, reviews, notifications, and queue chrome when those grants are off', () => {
    const p = {
      role: ROLES.ASSISTANT_SUPER_ADMIN,
      permission_grants: {
        console: false,
        reviews: false,
        notifications: false,
        queue_all: false,
      },
    }
    assert.equal(canAccessConsole(p), false)
    assert.equal(canAccessReviews(p), false)
    assert.equal(canAccessNotifications(p), false)
    assert.equal(canViewQueueOperations(p), false)
    assert.equal(allowRoute(p, 'console'), false)
    assert.equal(allowRoute(p, 'reviews'), false)
    assert.equal(allowRoute(p, 'notifications'), false)
    assert.equal(allowRoute(p, 'queue'), false)
    assert.equal(allowRoute(p, 'dashboard'), false)
    assert.equal(allowRoute(p, 'kpi'), false)
    const open = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: {} }
    assert.equal(canAccessConsole(open), true)
    assert.equal(canAccessReviews(open), true)
    assert.equal(canAccessNotifications(open), true)
    assert.equal(canViewQueueOperations(open), true)
  })

  it('denies history and bookings when those grants are off', () => {
    const p = {
      role: ROLES.ASSISTANT_SUPER_ADMIN,
      permission_grants: { history: false, bookings: false },
    }
    assert.equal(allowRoute(p, 'history'), false)
    assert.equal(allowRoute(p, 'bookings'), false)
    const open = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: {} }
    assert.equal(allowRoute(open, 'history'), true)
    assert.equal(allowRoute(open, 'bookings'), true)
  })
})

describe('Public catalog names match homepage', () => {
  it('loads live inventory services on /services and PPF titles from ppfPackages', () => {
    const page = read('src/pages/PublicPages.jsx')
    assert.match(page, /fetchPublicCatalogServices/)
    assert.match(page, /buildPublicServiceOverview/)
    assert.match(page, /CeramicSection|PPFVisualizer/)
    assert.doesNotMatch(page, /Premium car wash/)
    assert.doesNotMatch(page, /Essential gloss/)
    const catalog = read('src/lib/publicCatalog.js')
    assert.match(catalog, /from\('services'\)/)
    assert.match(catalog, /PPF_PACKAGES/)
    assert.match(catalog, /publicPackageOverview/)
  })
})

describe('Complaints inbox can change status', () => {
  it('writes complaints CHECK statuses from the inquiries page', () => {
    const page = read('src/pages/InquiriesPage.jsx')
    assert.match(page, /COMPLAINT_STATUSES/)
    assert.match(page, /from\('complaints'\)\.update\(\{ status/)
  })
})

describe('Contact inbox can change status', () => {
  it('writes contact CHECK statuses from the inquiries page', () => {
    const lib = read('src/lib/partnershipInquiry.js')
    assert.match(lib, /CONTACT_STATUSES = \['new', 'reviewing', 'contacted', 'archived'\]/)
    const page = read('src/pages/InquiriesPage.jsx')
    assert.match(page, /CONTACT_STATUSES/)
    assert.match(page, /from\('contact_inquiries'\)\.update\(\{ status/)
    const sql = read('supabase/migrations/20260820140000_contact_status_asa_grants.sql')
    assert.match(sql, /contact_inquiries_status_check/)
    assert.match(sql, /for update to authenticated/)
    assert.match(sql, /grant select, update on public\.contact_inquiries/)
  })
})

describe('People edit can set a temporary password', () => {
  it('sends temporary_password through updateStaffAccountFields and scrolls on a phone', () => {
    const page = read('src/pages/PeopleManagePage.jsx')
    assert.match(page, /temporary_password/)
    assert.match(page, /updateStaffAccountFields/)
    assert.match(page, /overflow-x-auto/)
    assert.match(page, /people-directory-cards/)
    assert.match(page, /AssistantGrantsEditor/)
    const css = read('src/styles.css')
    assert.match(css, /people-directory-cards/)
  })
})

describe('Finance Reports is the books reports surface', () => {
  it('legacy /operations/reports redirects; Finance Reports loads best sellers in the filter window', () => {
    const redirect = read('src/pages/ReportsPage.jsx')
    assert.match(redirect, /finance\?tab=reports/)
    assert.match(redirect, /canAccessReports|canAccessFinance/)
    const tab = read('src/pages/finance/FinanceReportsTab.jsx')
    assert.match(tab, /aggregateBestSellers/)
    assert.match(tab, /rollupPl/)
    assert.match(tab, /scopeBranch/)
    assert.match(tab, /occurred_at/)
    const nav = getOperationsNav({ role: ROLES.SUPER_ADMIN })
    assert.ok(nav.some((i) => i.to === '/operations/finance'))
    assert.ok(!nav.some((i) => i.to === '/operations/reports'))
  })
})
