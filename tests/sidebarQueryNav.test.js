import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(import.meta.url), '../..')

// Mirror of commandNavIsActive from OperationsLayout.jsx
function commandNavIsActive(pathname, search, to) {
  const [path, query] = String(to || '').split('?')
  if (!path) return false
  if (query) {
    const want = new URLSearchParams(query)
    const have = new URLSearchParams(search)
    for (const [key, value] of want) {
      if (have.get(key) !== value) return false
    }
    return pathname === path
  }
  if (path === '/operations/inventory') {
    const tab = new URLSearchParams(search).get('tab')
    if (tab === 'bay' || tab === 'detailing') return false
  }
  if (path === '/operations/finance') {
    const tab = new URLSearchParams(search).get('tab')
    if (tab === 'reports') return false
  }
  if (path === '/operations/planning') {
    const tab = new URLSearchParams(search).get('tab')
    if (tab === 'calendar') return false
  }
  if (path.endsWith('/console') || path.endsWith('/dashboard')) return pathname === path
  return pathname === path || pathname.startsWith(`${path}/`)
}

describe('Sidebar query-aware navigation contracts', () => {
  it('activates ONLY Detailing Packages when on /operations/inventory?tab=detailing', () => {
    const pathname = '/operations/inventory'
    const search = '?tab=detailing'

    const detailingActive = commandNavIsActive(pathname, search, '/operations/inventory?tab=detailing')
    const bayActive = commandNavIsActive(pathname, search, '/operations/inventory?tab=bay')
    const inventoryActive = commandNavIsActive(pathname, search, '/operations/inventory')

    assert.equal(detailingActive, true, 'Detailing Packages must be active')
    assert.equal(bayActive, false, 'Services and Packages must NOT be active')
    assert.equal(inventoryActive, false, 'Inventory must NOT be active')
  })

  it('activates ONLY Services and Packages when on /operations/inventory?tab=bay', () => {
    const pathname = '/operations/inventory'
    const search = '?tab=bay'

    const detailingActive = commandNavIsActive(pathname, search, '/operations/inventory?tab=detailing')
    const bayActive = commandNavIsActive(pathname, search, '/operations/inventory?tab=bay')
    const inventoryActive = commandNavIsActive(pathname, search, '/operations/inventory')

    assert.equal(bayActive, true, 'Services and Packages must be active')
    assert.equal(detailingActive, false, 'Detailing Packages must NOT be active')
    assert.equal(inventoryActive, false, 'Inventory must NOT be active')
  })

  it('activates ONLY Inventory when on /operations/inventory (or merch)', () => {
    const pathname = '/operations/inventory'
    const search = ''

    const detailingActive = commandNavIsActive(pathname, search, '/operations/inventory?tab=detailing')
    const bayActive = commandNavIsActive(pathname, search, '/operations/inventory?tab=bay')
    const inventoryActive = commandNavIsActive(pathname, search, '/operations/inventory')

    assert.equal(inventoryActive, true, 'Inventory must be active')
    assert.equal(bayActive, false, 'Services and Packages must NOT be active')
    assert.equal(detailingActive, false, 'Detailing Packages must NOT be active')
  })

  it('OperationsLayout uses Link with controlled aria-current instead of NavLink in CommandNavList', () => {
    const code = readFileSync(join(root, 'src/layouts/OperationsLayout.jsx'), 'utf8')
    assert.match(code, /render=\{\s*<Link\s+to=\{to\}\s+aria-current=\{isActive \? 'page' : undefined\}/)
    assert.match(code, /<SidebarMenu className="gap-1">/)
  })

  it('Sidebar CSS defines menu item gap for Daylight theme', () => {
    const daylight = readFileSync(join(root, 'src/styles/ops-daylight.css'), 'utf8')
    assert.match(daylight, /\.command-daylight \.command-nav-group \[data-slot="sidebar-menu"\]\s*\{\s*gap:\s*4px;/)
  })
})

