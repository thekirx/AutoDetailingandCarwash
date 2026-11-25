import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (relPath) => readFileSync(join(root, relPath), 'utf8')

describe('Cross-role UI/UX & backend parity regression contracts', () => {
  it('audit_logs inserts in notificationConfigApi and customerAdminApi use canonical schema columns', () => {
    const notifCfg = read('server/notificationConfigApi.mjs')
    assert.match(notifCfg, /entity_type:\s*'app_settings'/)
    assert.match(notifCfg, /meta:\s*config/)
    assert.doesNotMatch(notifCfg, /details:\s*config/)

    const crmApi = read('server/customerAdminApi.mjs')
    assert.match(crmApi, /entity_type:\s*metadata\?\.target_table/)
    assert.match(crmApi, /summary:/)
    assert.match(crmApi, /meta:\s*metadata/)
    assert.doesNotMatch(crmApi, /target_table:\s*metadata/)
  })

  it('automation sweep recognizes operations_lead instead of stale ops_lead', () => {
    const sweepApi = read('server/automationSweepApi.mjs')
    assert.match(sweepApi, /'operations_lead'/)
    assert.doesNotMatch(sweepApi, /'ops_lead'/)

    const notifPanel = read('src/pages/notifications/NotificationSettingsPanel.jsx')
    assert.match(notifPanel, /jobKey === 'sweep' \? \{ mode: 'manual', force: true \}/)
  })

  it('CRM manual SMS checkbox and busybee manual POST are removed per SMS policy', () => {
    const crmPage = read('src/pages/CrmPage.jsx')
    assert.doesNotMatch(crmPage, /fetch\(['"]\/api\/busybee['"]/)
    assert.doesNotMatch(crmPage, /Also send SMS/)

    const smsPage = read('src/pages/SmsPage.jsx')
    assert.match(smsPage, /select\([^)]*\bmessage\b[^)]*\)/)
  })

  it('Customer portal surfaces real load errors and preserves applied voucher state', () => {
    const repo = read('server/bookingRepo.mjs')
    assert.match(repo, /portalActive:[\s\S]*promo_voucher_id/)
    assert.match(repo, /portalHistory:[\s\S]*promo_voucher_id/)

    const portalApi = read('server/customerPortal.mjs')
    assert.match(portalApi, /canonicalPhMobile\(/)
    assert.match(portalApi, /That phone is already on another Hakum account/)

    const blog = read('src/pages/BlogPage.jsx')
    const custBlog = read('src/pages/CustomerBlogPage.jsx')
    assert.doesNotMatch(blog, /if \(e\) setError\(''\)/)
    assert.doesNotMatch(custBlog, /if \(e\) setError\(''\)/)
  })

  it('EmployeesHub opens modal reliably and adminApi syncs all branch-scoped roles', () => {
    const hub = read('src/pages/EmployeesHubPage.jsx')
    assert.match(hub, /if \(tab !== 'employees'\)/)

    const adminApi = read('src/lib/adminApi.js')
    for (const role of ['detailer', 'video_editor', 'sales', 'operations_lead']) {
      assert.match(adminApi, new RegExp(`['"]${role}['"]`))
    }
  })

  it('DataCenter checks export bundle errors and uses accessible contrast classes', () => {
    const dc = read('src/pages/DataCenterPage.jsx')
    assert.match(dc, /bundle\?\.errors/)
    assert.doesNotMatch(dc, /(?<!dark:)text-amber-100\b(?!\/)/)
    assert.doesNotMatch(dc, /(?<!dark:)text-red-200\b/)
  })

  it('FormResultsBoard supports cash-advance decisions and CSV export; DailySheetRules configures fees & payout schedule', () => {
    const frb = read('src/pages/FormResultsBoardPage.jsx')
    assert.match(frb, /approve_cash_advance/)
    assert.match(frb, /exportFilteredCsv/)

    const rulesPage = read('src/pages/settings/DailySheetRulesPage.jsx')
    assert.match(rulesPage, /ceramic_shirt_deduction_minor/)
    assert.match(rulesPage, /ceramic_card_fee_pct/)
    assert.match(rulesPage, /payout_frequency/)
    assert.match(rulesPage, /payout_weekday/)
  })
})
