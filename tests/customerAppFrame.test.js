import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const APP_PAGES = [
  'src/pages/CustomerAccountPage.jsx',
  'src/pages/CustomerBookPage.jsx',
  'src/pages/CustomerQueuePage.jsx',
  'src/pages/CustomerLoyaltyPage.jsx',
  'src/pages/CustomerBlogPage.jsx',
  'src/pages/CustomerEventsPage.jsx',
  'src/pages/CustomerMorePage.jsx',
]

describe('customer app frame', () => {
  it('every customer screen shares CustomerAppFrame + the 5-tab dock, and is routed', () => {
    for (const file of APP_PAGES) assert.match(read(file), /CustomerAppFrame/, file)
    assert.match(read('src/components/CustomerAppFrame.jsx'), /CustomerAccountDock/)
    assert.match(read('src/components/CustomerAccountDock.jsx'), /getCustomerAccountTabs/)
    const app = read('src/App.jsx')
    for (const path of ['/account/queue', '/account/book', '/account/loyalty', '/account/more', '/account/blog', '/account/events']) {
      assert.match(app, new RegExp(`path="${path.replace(/\//g, '\\/')}"`), path)
    }
  })

  it('car status progress bar is driven by the portal visit steps (database status)', () => {
    const bar = read('src/components/customer/VisitProgress.jsx')
    assert.match(bar, /role="progressbar"/)
    assert.match(bar, /currentIndex/)
    assert.match(bar, /isComplete/)
    assert.match(read('src/components/customer/ActiveVisitCard.jsx'), /VisitProgress/)
    assert.match(read('src/pages/CustomerAccountPage.jsx'), /ActiveVisitCard/)
    assert.match(read('src/pages/CustomerQueuePage.jsx'), /VisitProgress/)
    assert.match(read('server/customerPortal.mjs'), /buildVisitProgress/)
    assert.match(read('src/styles-customer-app.css'), /\.capp-progress-fill/)
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

  it('keeps book, garage, history, review, alerts, and loyalty flows on the same backend', () => {
    const home = read('src/pages/CustomerAccountPage.jsx')
    const book = read('src/pages/CustomerBookPage.jsx')
    const more = read('src/pages/CustomerMorePage.jsx')
    const loyalty = read('src/pages/CustomerLoyaltyPage.jsx')
    assert.match(home, /Past visits/)
    assert.match(home, /submit-review/)
    assert.match(home, /latestCompletedVisit/)
    assert.match(book, /\/api\/public-book/)
    assert.match(book, /capp-day/)
    assert.match(more, /archive-vehicle/)
    assert.match(more, /Send test text/)
    assert.match(more, /layout="panel"/)
    assert.match(more, /signOut\(\)/)
    assert.match(loyalty, /capp-stamp/)
    assert.match(loyalty, /nextMilestone/)
    assert.match(read('server/customerPortal.mjs'), /action === 'submit-review'/)
  })

  it('account routes keep app shell on phones and landing header on desktop web', () => {
    const layout = read('src/layouts/PublicLayout.jsx')
    assert.match(layout, /pathname\.startsWith\('\/account'\)/)
    assert.match(layout, /account-web-header|account-route/)
    assert.match(layout, /public-header/)
  })

  it('ships dark app tokens, inline desktop tab row, landscape dock, safe areas, reduced motion', () => {
    const css = read('src/styles-customer-app.css')
    const tokens = read('src/design-tokens.css')
    assert.match(tokens, /--capp-navy:\s*var\(--color-brand-primary\)/)
    assert.match(tokens, /--capp-ink:\s*var\(--color-surface-cinematic\)/)
    assert.match(css, /--capp-bg:/)
    assert.match(css, /--capp-accent:/)
    assert.match(css, /min-width: 860px/)
    assert.doesNotMatch(css, /width: min\(430px/)
    assert.match(css, /min-width: 860px[\s\S]*\.capp-dock \{[\s\S]*position: static/)
    assert.match(css, /account-web-header/)
    assert.match(css, /orientation: landscape/)
    assert.match(css, /max-height: 520px/)
    assert.match(css, /max-width: 900px/)
    assert.match(css, /repeat\(5,\s*minmax\(0,\s*1fr\)\)/)
    assert.match(css, /prefers-reduced-motion/)
    assert.match(css, /safe-area-inset-top/)
    assert.match(css, /safe-area-inset-bottom/)
  })

  it('uses dual light/dark lockups in the account hero (cropped square brand PNGs)', () => {
    const home = read('src/pages/CustomerAccountPage.jsx')
    const css = read('src/styles-customer-app.css')
    assert.match(home, /hakum-lw-blue\.png/)
    assert.match(home, /hakum-lw-ow\.png/)
    assert.match(home, /capp-brand-logo--light/)
    assert.match(home, /capp-brand-logo--dark/)
    assert.match(css, /\.capp-brand-logo/)
    assert.match(css, /transform:\s*scale\(1\.7\)/)
  })

  it('ships light + dark .capp tokens with contrast-safe button ink', () => {
    const css = read('src/styles-customer-app.css')
    assert.match(css, /\.capp \{[\s\S]*--capp-bg:\s*#f1f1ed/)
    assert.match(css, /html\.dark \.capp \{[\s\S]*--capp-bg:\s*#060c24/)
    assert.match(css, /--capp-btn-ink:/)
    assert.match(css, /--capp-dock-bg:/)
    assert.match(css, /\.capp-btn-fill \{[\s\S]*color:\s*var\(--capp-btn-ink\)/)
  })

  it('shows Add a car from home empty state and garage deep-link', () => {
    const home = read('src/pages/CustomerAccountPage.jsx')
    const more = read('src/pages/CustomerMorePage.jsx')
    assert.match(home, /Add a car/)
    assert.match(home, /tab=garage&add=1/)
    assert.match(more, /startAdding/)
    assert.match(more, /params\.get\('add'\) === '1'/)
    assert.match(more, /Add a car/)
  })

  it('hides mobile hero icon actions on desktop web (landing header owns the bell there)', () => {
    const home = read('src/pages/CustomerAccountPage.jsx')
    const css = read('src/styles-customer-app.css')
    assert.match(home, /capp-icon-row account-mobile-only/)
    assert.match(css, /min-width: 860px[\s\S]*\.capp-icon-row[\s\S]*display:\s*none/)
  })

  it('customer auth uses the dark app variant; ops login keeps the default shell', () => {
    const shell = read('src/components/HakumAuthShell.jsx')
    assert.match(shell, /hakum-auth--app/)
    for (const file of ['src/pages/CustomerSignInPage.jsx', 'src/pages/CustomerSignUpPage.jsx', 'src/pages/CustomerSetPasswordPage.jsx']) {
      assert.match(read(file), /variant="customer"/, file)
    }
    assert.doesNotMatch(read('src/pages/LoginPage.jsx'), /variant="customer"/)
    const css = read('src/styles-customer-app.css')
    assert.match(css, /\.hakum-auth--app/)
    assert.match(css, /max-width: 899px/)
    assert.match(read('src/main.jsx'), /styles-customer-app\.css/)
  })
})
