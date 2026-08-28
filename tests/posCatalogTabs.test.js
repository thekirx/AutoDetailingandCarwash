/**
 * POS catalog tabs: Services+Packages | Detailing | Merch; optional size; packages as bundles.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  filterPosBayCatalog,
  filterPosDetailingCatalog,
} from '../src/lib/serviceKinds.js'
import {
  availablePricingSizes,
  resolveServicePriceMinor,
  serviceHasSizePricing,
} from '../src/lib/servicePricing.js'
import { validateServiceInput } from '../src/lib/opsValidation.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('POS catalog bay vs detailing', () => {
  const rows = [
    { id: '1', name: 'Carwash', slug: 'premium-car-wash', pay_category: 'wash' },
    { id: '2', name: 'Express Package', slug: 'express-wash-package', pay_category: 'package' },
    { id: '3', name: 'Ceramic', slug: 'ceramic-coating', pay_category: 'detailing' },
    { id: '4', name: 'PPF', slug: 'paint-protection-film', pay_category: 'detailing' },
    { id: '5', name: 'Glass', slug: 'glass-detailing', pay_category: 'addon' },
  ]

  it('puts services and packages on bay; detailing separate', () => {
    const bay = filterPosBayCatalog(rows)
    const detailing = filterPosDetailingCatalog(rows)
    assert.deepEqual(bay.map((r) => r.slug).sort(), ['express-wash-package', 'glass-detailing', 'premium-car-wash'])
    assert.deepEqual(detailing.map((r) => r.slug).sort(), ['ceramic-coating', 'paint-protection-film'])
  })
})

describe('optional size pricing', () => {
  it('allows flat price without size matrix', () => {
    const v = validateServiceInput({ name: 'Glass Detailing', price: 500, pay_category: 'addon' })
    assert.equal(v.price_minor, 50000)
    assert.deepEqual(v.size_price_minor, {})
  })

  it('allows multi-select sizes only', () => {
    const v = validateServiceInput({
      name: 'Ceramic',
      price: 15000,
      pay_category: 'detailing',
      size_prices: { small: '12750', medium: '15000', large: '', extra_large: '' },
    })
    assert.equal(v.size_price_minor.small, 1275000)
    assert.equal(v.size_price_minor.medium, 1500000)
    assert.equal(v.size_price_minor.large, undefined)
  })

  it('resolves flat catalog when no size rows', () => {
    const svc = { price_minor: 80000, size_prices: {} }
    assert.equal(serviceHasSizePricing(svc), false)
    assert.equal(resolveServicePriceMinor(svc, 'large'), 80000)
    assert.equal(availablePricingSizes(svc).length, 0)
  })
})

describe('POS page wiring', () => {
  it('uses bay/detailing tabs and drops global size filter', () => {
    const pos = readFileSync(join(root, 'src/pages/PosPage.jsx'), 'utf8')
    assert.match(pos, /filterPosBayCatalog/)
    assert.match(pos, /filterPosDetailingCatalog/)
    assert.match(pos, /TabsTrigger value="bay"/)
    assert.match(pos, /TabsTrigger value="detailing"/)
    assert.match(pos, /Services & packages/)
    assert.doesNotMatch(pos, /setCarSize/)
    assert.match(pos, /size_options/)
    assert.match(pos, /Pick size/)
    const mig = readFileSync(
      join(root, 'supabase/migrations/20260821200000_pos_catalog_packages_optional_size.sql'),
      'utf8',
    )
    assert.match(mig, /included_service_ids/)
    assert.match(mig, /express-wash-package/)
    assert.match(mig, /full-care-package/)
    const manage = readFileSync(join(root, 'src/pages/ServicesManagePage.jsx'), 'utf8')
    assert.match(manage, /Optional size pricing/)
    assert.match(manage, /PackageIncludesField/)
    assert.match(manage, /catalogScope/)
    const inventory = readFileSync(join(root, 'src/pages/InventoryPage.jsx'), 'utf8')
    assert.match(inventory, /const INVENTORY_SHELL_TABS = \[/)
    assert.match(inventory, /catalogScope="bay"/)
    assert.match(inventory, /catalogScope="detailing"/)
    assert.match(inventory, /id: 'detailing'/)
    assert.match(inventory, /id: 'merch'/)
    assert.match(inventory, /Services & packages/)
  })
})

describe('inventory catalog scope helpers', () => {
  it('limits pay categories per inventory tab', async () => {
    const {
      payCategoryOptionsForCatalogScope,
      defaultPayCategoryForCatalogScope,
    } = await import('../src/lib/serviceKinds.js')
    assert.equal(defaultPayCategoryForCatalogScope('detailing'), 'detailing')
    assert.ok(payCategoryOptionsForCatalogScope('bay').every((r) => r.kind !== 'detailing'))
    assert.ok(payCategoryOptionsForCatalogScope('detailing').every((r) => r.kind === 'detailing'))
  })
})
