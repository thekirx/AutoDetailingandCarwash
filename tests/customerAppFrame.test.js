import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('customer app frame', () => {
  it('account, blog, and events share CustomerAppFrame + dock', () => {
    for (const file of [
      'src/pages/CustomerAccountPage.jsx',
      'src/pages/CustomerBlogPage.jsx',
      'src/pages/CustomerEventsPage.jsx',
    ]) {
      const src = read(file)
      assert.match(src, /CustomerAppFrame/, file)
    }
    assert.match(read('src/components/CustomerAppFrame.jsx'), /CustomerAccountDock/)
    assert.match(read('src/components/CustomerAccountDock.jsx'), /getCustomerAccountTabs/)
  })

  it('keeps book, queue, garage, history, and activate paths', () => {
    const home = read('src/pages/CustomerAccountPage.jsx')
    assert.match(home, /setBookOpen\(true\)/)
    assert.match(home, /Live queue/)
    assert.match(home, /archive-vehicle/)
    assert.match(home, /Past visits/)
    assert.match(home, /PushToggle/)
  })

  it('always uses the app shell on /account, including desktop web', () => {
    const layout = read('src/layouts/PublicLayout.jsx')
    assert.match(layout, /pathname\.startsWith\('\/account'\)/)
    assert.doesNotMatch(layout, /prefersAppShell\(\) && pathname/)
  })

  it('ships mobile-first tokens, web phone stage, and landscape dock', () => {
    const css = read('src/styles-customer-app.css')
    assert.match(css, /--capp-navy: #052699/)
    assert.match(css, /--capp-ink: #020a31/)
    assert.match(css, /min-width: 860px/)
    assert.match(css, /width: min\(430px/)
    assert.match(css, /orientation: landscape/)
    assert.match(css, /max-height: 520px/)
    assert.match(css, /prefers-reduced-motion/)
    assert.match(css, /safe-area-inset-top/)
    assert.match(css, /safe-area-inset-bottom/)
  })

  it('auth collapses to an app sheet on phones', () => {
    const css = read('src/styles-customer-app.css')
    assert.match(css, /max-width: 899px/)
    assert.match(css, /\.hakum-auth-bullets/)
    assert.match(read('src/main.jsx'), /styles-customer-app\.css/)
  })
})
