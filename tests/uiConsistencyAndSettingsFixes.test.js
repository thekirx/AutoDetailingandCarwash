import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(root, p), 'utf8')

describe('UI consistency, accessibility, and Settings completeness contracts', () => {
  it('eliminates native window.prompt / window.confirm / alert dialogs across UI modules', () => {
    for (const file of [
      'src/components/QueueTicketEditor.jsx',
      'src/pages/TeamLeadQueuePage.jsx',
      'src/components/content/ContentBlockEditor.jsx',
      'src/lib/financeData.js',
    ]) {
      const src = read(file)
      assert.doesNotMatch(src, /window\.prompt\s*\(/, `${file} must not call window.prompt()`)
      assert.doesNotMatch(src, /window\.confirm\s*\(/, `${file} must not call window.confirm()`)
      assert.doesNotMatch(src, /\balert\s*\(/, `${file} must not call alert()`)
    }
    const dialogSrc = read('src/components/ops/ReasonConfirmDialog.jsx')
    assert.equal(/#[0-9a-f]{6}/i.test(dialogSrc), false, 'ReasonConfirmDialog must not hardcode raw hexes')
  })

  it('fixes UserSettingsModal RBAC/role gates, birthday lock parity, and garage reset state', () => {
    const src = read('src/components/UserSettingsModal.jsx')
    assert.match(src, /canAccessMyAdvances\(profile\)/)
    assert.match(src, /showMyAdvances\s*=\s*!isCustomer\s*&&\s*Boolean\(profile\?\.id\)\s*&&\s*canAccessMyAdvances\(profile\)/)
    assert.match(src, /customerBirthdayLocked\s*=\s*isCustomer\s*&&\s*Boolean\(profile\?\.date_of_birth\)/)
    assert.match(src, /vehicle_type:\s*'medium'/)
    assert.match(src, /\{isCustomer\s*\?\s*\(\s*<div className="space-y-2 border-t border-border pt-4">[\s\S]*SMS notifications/)
  })

  it('fixes PushToggle accessibility label and CustomerMorePage truthful SMS + Inbox controls', () => {
    const pushToggle = read('src/components/PushToggle.jsx')
    assert.match(pushToggle, /role="switch"[\s\S]{0,120}aria-label="Push alerts"/)

    const more = read('src/pages/CustomerMorePage.jsx')
    assert.doesNotMatch(more, /Send test text/)
    assert.doesNotMatch(more, /kind:\s*'self_test'/)
    assert.match(more, /Mark all read/)
    assert.match(more, /Show all \(/)
  })

  it('upgrades PosSettings, DailySheetRules, TintFinderSettings, SettingsHub, and SmsPage consistency', () => {
    const posPage = read('src/pages/settings/PosSettingsPage.jsx')
    assert.match(posPage, /OpsPageShell/)
    assert.match(posPage, /\/operations\/settings/)

    const posPanel = read('src/pages/pos/PosSettingsPanel.jsx')
    assert.match(posPanel, /Add payment method/)
    assert.match(posPanel, /Add expense kind/)
    assert.match(posPanel, /Reset defaults/)
    assert.match(posPanel, /Remove payment method/)

    const rules = read('src/pages/settings/DailySheetRulesPage.jsx')
    assert.match(rules, /\.eq\('is_archived',\s*false\)/)
    assert.match(rules, /Reset defaults/)
    assert.match(rules, /savingLeadId/)

    const tint = read('src/pages/settings/TintFinderSettingsPage.jsx')
    assert.match(tint, /\/operations\/settings/)
    assert.doesNotMatch(tint, /\.select\(['"]\*['"]\)/)
    assert.match(tint, /statusFilter/)
    assert.match(tint, /toast\.success/)

    const hub = read('src/pages/SettingsHubPage.jsx')
    assert.match(hub, /\/operations\/notifications\?tab=settings/)
    assert.match(hub, /\/operations\/employees\?tab=settings/)
    assert.match(hub, /\/operations\/system\?tab=data-center/)

    const sms = read('src/pages/SmsPage.jsx')
    assert.doesNotMatch(sms, /\.select\(['"]\*['"]\)/)
    assert.match(sms, /\/operations\/notifications\?tab=settings/)

    const bookings = read('src/pages/BookingBoardPage.jsx')
    assert.match(bookings, /<h1[^>]*>Branch setup required<\/h1>/)
  })
})
