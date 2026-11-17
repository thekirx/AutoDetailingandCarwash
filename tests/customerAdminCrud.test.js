import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { allowRoute, getOperationsNav, ROLES } from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('Customer Users Hub consolidation & full CRUD', () => {
  it('streamlines BossMich & Branch Admin sidebars while keeping deep-link RBAC enabled', () => {
    const sa = { role: ROLES.SUPER_ADMIN }
    const navUrls = getOperationsNav(sa).map((item) => item.to)
    assert.ok(navUrls.includes('/operations/crm'))
    for (const legacy of ['/operations/memberships', '/operations/merch-shop', '/operations/inquiries', '/operations/vehicle-transfer']) {
      assert.equal(navUrls.includes(legacy), false, `${legacy} should not clutter sidebar`)
    }
    for (const routeKey of ['crm', 'memberships', 'merch-shop', 'inquiries', 'vehicle-transfer']) {
      assert.equal(allowRoute(sa, routeKey), true, `allowRoute must keep ${routeKey} accessible for redirects`)
    }

    const appSrc = read('src/App.jsx')
    assert.match(appSrc, /CustomerHubRedirect/)
    assert.match(appSrc, /path="vehicle-transfer"[\s\S]{0,120}tab="transfer"/)
    assert.match(appSrc, /path="memberships"[\s\S]{0,120}tab="memberships"/)
    assert.match(appSrc, /path="inquiries"[\s\S]{0,120}tab="inquiries"/)
    assert.match(appSrc, /path="merch-shop"[\s\S]{0,120}tab="merch"/)
  })

  it('wires full customer CRUD, vehicle CRUD, archived restore, transfer car, memberships, and inquiries into CrmPage', () => {
    const crm = read('src/pages/CrmPage.jsx')
    assert.match(crm, /New customer/)
    assert.match(crm, /action:\s*'list-archived'/)
    assert.match(crm, /action:\s*'update'/)
    assert.match(crm, /action:\s*'archive'/)
    assert.match(crm, /action:\s*'restore'/)
    assert.match(crm, /action:\s*'delete'/)
    assert.match(crm, /action:\s*'update-vehicle'/)
    assert.match(crm, /action:\s*'archive-vehicle'/)
    for (const tabId of ['directory', 'transfer', 'memberships', 'inquiries', 'merch', 'groups', 'insights', 'sms']) {
      assert.match(crm, new RegExp(`id: '${tabId}'`))
    }
    assert.match(crm, /<MembershipsPage embedded/)
    assert.match(crm, /<InquiriesPage embedded/)
    assert.match(crm, /<MerchShopPage embedded/)
    assert.match(crm, /<VehicleTransferPanel/)

    const dlg = read('src/pages/crm/CustomerProfileDialog.jsx')
    assert.match(dlg, /onEditVehicle/)
    assert.match(dlg, /onArchiveVehicle/)
    assert.match(dlg, /onTransferVehicle/)
    assert.match(dlg, /onDelete/)
  })

  it('enforces JWT, role/branch boundaries, safe deletion, and Auth sync in server/customerAdminApi.mjs', () => {
    const srv = read('server/customerAdminApi.mjs')
    assert.match(srv, /handleManageCustomerRequest/)
    assert.match(srv, /requireCrmStaff/)
    assert.match(srv, /assertCustomerInBranchScope/)
    assert.match(srv, /!isSuperAdmin\(staff\) && !isAssistantSuperAdmin\(staff\)/)
    assert.match(srv, /Archive instead to keep financial history intact/)
    assert.match(srv, /auth\.admin\.updateUserById/)
    assert.match(srv, /auth\.admin\.deleteUser/)
    assert.match(srv, /audit_logs/)

    const gateway = read('api/customer.js')
    assert.match(gateway, /'manage-customer':/)
    const viteCfg = read('vite.config.js')
    assert.match(viteCfg, /mount\('\/api\/customer'/)
  })
})
