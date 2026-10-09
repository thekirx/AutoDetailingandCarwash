import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { customerAccountTabId, customerScreenDepth, customerVisitPath, getCustomerAccountTabs } from '../src/lib/customerAccountNav.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('customer account bottom nav', () => {
  it('ships the five-tab floating dock: Home, Queue, Book, Rewards, Me', () => {
    const tabs = getCustomerAccountTabs()
    assert.deepEqual(tabs.map((t) => t.label), ['Home', 'Queue', 'Book', 'Rewards', 'Me'])
    assert.equal(tabs.find((t) => t.id === 'queue').to, '/account/queue')
    assert.equal(tabs.find((t) => t.id === 'book').to, '/account/book')
    assert.equal(tabs.find((t) => t.id === 'rewards').to, '/account/loyalty')
    assert.equal(tabs.find((t) => t.id === 'me').to, '/account/more')
  })

  it('maps account routes to the active tab (blog + events live under Me, a visit under Home)', () => {
    assert.equal(customerAccountTabId('/account'), 'home')
    assert.equal(customerAccountTabId('/account/book'), 'book')
    assert.equal(customerAccountTabId('/account/blog'), 'me')
    assert.equal(customerAccountTabId('/account/events'), 'me')
    assert.equal(customerAccountTabId('/account/loyalty'), 'rewards')
    assert.equal(customerAccountTabId('/account/more'), 'me')
    assert.equal(customerAccountTabId('/account/queue'), 'queue')
    assert.equal(customerAccountTabId('/queue/bacoor'), 'queue')
    assert.equal(customerAccountTabId('/account/visit/b1'), 'home')
  })

  it('knows tab screens from pushed screens, so pushes slide in and tabs only fade', () => {
    for (const path of ['/account', '/account/queue', '/account/book', '/account/loyalty', '/account/more']) {
      assert.equal(customerScreenDepth(path, ''), 0, path)
    }
    assert.equal(customerScreenDepth('/account/more', '?tab=garage'), 1)
    assert.equal(customerScreenDepth('/account/events', ''), 1)
    assert.equal(customerScreenDepth('/account/visit/b1', ''), 1)
    assert.equal(customerVisitPath('b 1'), '/account/visit/b%201')
  })

  it('the dock slides a pill under the active tab and the visit screen is routed', () => {
    assert.match(read('src/components/CustomerAccountDock.jsx'), /capp-dock-ind/)
    assert.match(read('src/styles/customer-native.css'), /\.capp-dock-ind \{[\s\S]*translateX\(calc\(var\(--i/)
    assert.match(read('src/App.jsx'), /path="\/account\/visit\/:id"/)
  })

  it('the app opens in the website colours, with Light and Dark in Me', () => {
    assert.match(read('src/lib/customerAppTheme.js'), /=== 'light' \? 'light' : 'dark'/)
    assert.match(read('src/components/CustomerAppFrame.jsx'), /data-app-theme=\{theme\}/)
    assert.match(read('src/pages/CustomerMorePage.jsx'), /AppearanceRow/)
    const css = read('src/styles/customer-native.css')
    assert.match(css, /\.capp\[data-app-theme='dark'\][\s\S]*--capp-bg: #020a31/)
    assert.match(css, /--capp-accent: #9db4ff/)
    assert.match(css, /\.capp\[data-app-theme='light'\][\s\S]*--capp-bg: #f1f1ed/)
  })

  it('booking keeps the same request, now one step per screen in a sheet', () => {
    const book = read('src/pages/CustomerBookPage.jsx')
    assert.match(book, /\/api\/public-book/)
    assert.match(book, /<Sheet/)
    assert.match(book, /key="submit"/)
    assert.match(book, /Request booking/)
  })
})
