import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { opsNavIsActive } from '../src/lib/opsNavigationRegistry.js'

const root = join(fileURLToPath(import.meta.url), '../..')

describe('Sidebar query-aware navigation contracts', () => {
  it('activates ONLY Detailing Packages when on /operations/inventory?tab=detailing or ?tab=services&scope=detailing', () => {
    for (const search of ['?tab=detailing', '?tab=services&scope=detailing']) {
      const detailingActive = opsNavIsActive('/operations/inventory', search, '/operations/inventory?tab=services&scope=detailing')
      const bayActive = opsNavIsActive('/operations/inventory', search, '/operations/inventory?tab=services&scope=bay')
      const inventoryActive = opsNavIsActive('/operations/inventory', search, '/operations/inventory')

      assert.equal(detailingActive, true, `Detailing Packages must be active for ${search}`)
      assert.equal(bayActive, false, `Services and Packages must NOT be active for ${search}`)
      assert.equal(inventoryActive, true, `Catalog & Inventory parent matches base route for ${search}`)
    }
  })

  it('activates ONLY Services & Packages when on /operations/inventory?tab=bay or ?tab=services&scope=bay', () => {
    for (const search of ['?tab=bay', '?tab=services&scope=bay']) {
      const detailingActive = opsNavIsActive('/operations/inventory', search, '/operations/inventory?tab=services&scope=detailing')
      const bayActive = opsNavIsActive('/operations/inventory', search, '/operations/inventory?tab=services&scope=bay')

      assert.equal(bayActive, true, `Services and Packages must be active for ${search}`)
      assert.equal(detailingActive, false, `Detailing Packages must NOT be active for ${search}`)
    }
  })

  it('activates ONLY Inventory base when on /operations/inventory cleanly', () => {
    const pathname = '/operations/inventory'
    const search = ''

    assert.equal(opsNavIsActive(pathname, search, '/operations/inventory'), true)
    assert.equal(opsNavIsActive(pathname, search, '/operations/inventory?tab=services&scope=bay'), false)
    assert.equal(opsNavIsActive(pathname, search, '/operations/inventory?tab=cars'), false)
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
