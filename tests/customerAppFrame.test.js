import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('customer app frame', () => {
  it('account, blog, events, and queue share CustomerAppFrame + dock', () => {
    for (const file of [
      'src/pages/CustomerAccountPage.jsx',
      'src/pages/CustomerBlogPage.jsx',
      'src/pages/CustomerEventsPage.jsx',
      'src/pages/CustomerQueuePage.jsx',
    ]) {
      const src = read(file)
      assert.match(src, /CustomerAppFrame/, file)
    }
    assert.match(read('src/components/CustomerAppFrame.jsx'), /CustomerAccountDock/)
    assert.match(read('src/components/CustomerAccountDock.jsx'), /getCustomerAccountTabs/)
    assert.match(read('src/App.jsx'), /path="\/account\/queue"/)
  })

  it('keeps signed-in queue inside the app and polls all branch counts', () => {
    const queue = read('src/pages/CustomerQueuePage.jsx')
    const home = read('src/pages/CustomerAccountPage.jsx')
    const picker = read('src/pages/PublicUtilityPage.jsx')
    const publicBoard = read('src/pages/PublicQueuePage.jsx')
    assert.match(queue, /usePublicQueueCounts/)
    assert.match(queue, /Other branches/)
    assert.match(home, /customerQueuePath/)
    assert.match(home, /usePublicQueueCounts/)
    assert.match(picker, /CUSTOMER_QUEUE_PATH/)
    assert.match(publicBoard, /customerQueuePath/)
    assert.match(publicBoard, /!isTv && authLoading/)
    assert.match(read('src/lib/usePublicQueueCounts.js'), /public_queue_counts/)
    assert.match(read('src/lib/usePublicQueueCounts.js'), /PUBLIC_QUEUE_POLL_MS/)
    assert.doesNotMatch(read('src/lib/usePublicQueueCounts.js'), /\.channel\(|\.from\('bookings'\)/)
  })

  it('keeps book, queue, garage, history, and activate paths', () => {
    const home = read('src/pages/CustomerAccountPage.jsx')
    assert.match(home, /setBookOpen\(true\)/)
    assert.match(home, /Live queue/)
    assert.match(home, /archive-vehicle/)
    assert.match(home, /Past visits/)
    assert.match(home, /CustomerSettingsModal/)
    assert.match(home, /Alert settings/)
    assert.match(home, /submit-review/)
    assert.match(home, /latestCompletedVisit/)
    assert.match(read('src/components/CustomerSettingsModal.jsx'), /Send test text/)
    assert.match(read('src/components/CustomerSettingsModal.jsx'), /layout="panel"/)
    assert.match(read('server/customerPortal.mjs'), /action === 'submit-review'/)
  })

  it('account routes keep app shell on phones and landing header on desktop web', () => {
    const layout = read('src/layouts/PublicLayout.jsx')
    assert.match(layout, /pathname\.startsWith\('\/account'\)/)
    assert.match(layout, /account-web-header|account-route/)
    assert.match(layout, /public-header/)
    assert.match(read('src/components/CustomerAppFrame.jsx'), /CustomerAccountDock/)
  })

  it('ships mobile app chrome, desktop web layout (no phone stage), landscape dock', () => {
    const css = read('src/styles-customer-app.css')
    const tokens = read('src/design-tokens.css')
    assert.match(tokens, /--capp-navy:\s*var\(--color-brand-primary\)/)
    assert.match(tokens, /--capp-ink:\s*var\(--color-surface-cinematic\)/)
    assert.match(css, /var\(--capp-foam\)|var\(--capp-ink\)/)
    assert.match(css, /min-width: 860px/)
    assert.doesNotMatch(css, /width: min\(430px/)
    assert.match(css, /\.capp \.account-dock[\s\S]*display:\s*none/)
    assert.match(css, /account-web-header/)
    assert.match(css, /orientation: landscape/)
    assert.match(css, /max-height: 520px/)
    assert.match(css, /max-width: 900px/)
    assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)/)
    assert.match(css, /repeat\(5,\s*minmax\(0,\s*1fr\)\)/)
    assert.match(css, /prefers-reduced-motion/)
    assert.match(css, /safe-area-inset-top/)
    assert.match(css, /safe-area-inset-bottom/)
  })

  it('uses the approved OW lockup in the account hero (not text kickers)', () => {
    const home = read('src/pages/CustomerAccountPage.jsx')
    const css = read('src/styles-customer-app.css')
    assert.equal((home.match(/src="\/branding\/hakum-lw-ow\.png"/g) || []).length, 2)
    assert.match(home, /className="capp-brand"/)
    assert.match(home, /alt="Hakum Auto Care"/)
    assert.doesNotMatch(home, /capp-kicker">Hakum Auto Care</)
    assert.doesNotMatch(home, /capp-kicker">Hakum</)
    assert.match(css, /\.capp-brand-logo/)
  })

  it('hides mobile hero icon actions on desktop web; keeps settings and sign-out on web', () => {
    const home = read('src/pages/CustomerAccountPage.jsx')
    const css = read('src/styles-customer-app.css')
    assert.match(home, /capp-icon-row[\s\S]*account-mobile-only|account-mobile-only[\s\S]*capp-icon-row/)
    assert.match(home, /capp-web-actions[\s\S]*account-desktop-only|account-desktop-only[\s\S]*capp-web-actions/)
    assert.match(home, /openSettings\('account'\)/)
    assert.match(home, /signOut\(\)/)
    assert.match(css, /min-width: 860px[\s\S]*\.capp-icon-row[\s\S]*display:\s*none/)
    assert.match(css, /\.capp-web-actions/)
  })

  it('auth collapses to an app sheet on phones', () => {
    const css = read('src/styles-customer-app.css')
    assert.match(css, /max-width: 899px/)
    assert.match(css, /\.hakum-auth-bullets/)
    assert.match(read('src/main.jsx'), /styles-customer-app\.css/)
  })
})
