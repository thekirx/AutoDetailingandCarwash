import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { allowRoute, getOperationsNav, ROLES } from '../src/auth/permissions.js'
import { requireActiveStaff } from '../server/staffAuth.mjs'
import { handleManageCustomerRequest } from '../server/customerAdminApi.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('Customer Users Hub consolidation & full CRUD', () => {
  it('streamlines BossMich & Branch Admin sidebars while keeping deep-link RBAC enabled', () => {
    const sa = { role: ROLES.SUPER_ADMIN }
    const navUrls = getOperationsNav(sa).map((item) => item.to)
    assert.deepEqual(navUrls, [
      '/operations/dashboard',
      '/operations/queue',
      '/operations/bookings',
      '/operations/planning',
      '/operations/pos',
      '/operations/finance',
    ])
    for (const legacy of ['/operations/memberships', '/operations/merch-shop', '/operations/inquiries', '/operations/vehicle-transfer', '/operations/vouchers']) {
      assert.equal(navUrls.includes(legacy), false, `${legacy} should not clutter sidebar`)
    }
    for (const routeKey of ['crm', 'rewards', 'memberships', 'merch-shop', 'inquiries', 'vehicle-transfer', 'vouchers']) {
      assert.equal(allowRoute(sa, routeKey), true, `allowRoute must keep ${routeKey} accessible for redirects`)
    }

    const appSrc = read('src/App.jsx')
    assert.match(appSrc, /CustomerHubRedirect/)
    assert.match(appSrc, /RewardsHubRedirect/)
    assert.match(appSrc, /path="vehicle-transfer"[\s\S]{0,120}tab="transfer"/)
    assert.match(appSrc, /path="inquiries"[\s\S]{0,120}tab="inquiries"/)
    assert.match(appSrc, /path="memberships"[\s\S]{0,120}tab="memberships"/)
    assert.match(appSrc, /path="merch-shop"[\s\S]{0,120}tab="points-shop"/)
    assert.match(appSrc, /path="vouchers"[\s\S]{0,120}tab="vouchers"/)
  })

  it('wires full customer CRUD, vehicle CRUD, archived restore, transfer car, and inquiries into CrmPage', () => {
    const crm = read('src/pages/CrmPage.jsx')
    assert.match(crm, /New customer/)
    assert.match(crm, /action:\s*'list-archived'/)
    assert.match(crm, /action:\s*'update'/)
    assert.match(crm, /action:\s*'archive'/)
    assert.match(crm, /action:\s*'restore'/)
    assert.match(crm, /action:\s*'delete'/)
    assert.match(crm, /action:\s*'update-vehicle'/)
    assert.match(crm, /action:\s*'archive-vehicle'/)
    for (const tabId of ['directory', 'transfer', 'inquiries', 'groups', 'insights', 'sms']) {
      assert.match(crm, new RegExp(`id: '${tabId}'`))
    }
    assert.match(crm, /<InquiriesPage embedded/)
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

  it('requires active & non-archived staff across customerAdminApi, vehicleTransferApi, and smartSearchApi', async () => {
    for (const file of ['server/customerAdminApi.mjs', 'server/vehicleTransferApi.mjs', 'server/smartSearchApi.mjs']) {
      assert.match(read(file), /requireActiveStaff/, `${file} must delegate auth to server/staffAuth.mjs`)
    }

    const eqCalls = []
    const makeStaffAdmin = (staffRow) => ({
      auth: { getUser: async () => ({ data: { user: { id: 'staff-1' } }, error: null }) },
      from: (table) => {
        const chain = {
          select: () => chain,
          eq: (col, val) => {
            eqCalls.push([table, col, val])
            return chain
          },
          maybeSingle: async () => ({ data: staffRow, error: null }),
          then: (cb) => Promise.resolve({ data: [], error: null }).then(cb),
        }
        return chain
      },
    })

    await assert.rejects(
      () => requireActiveStaff(makeStaffAdmin(null), 'jwt-1'),
      (err) => err?.status === 403,
    )
    assert.ok(eqCalls.some(([t, c, v]) => t === 'staff_profiles' && c === 'is_active' && v === true))
    assert.ok(eqCalls.some(([t, c, v]) => t === 'staff_profiles' && c === 'is_archived' && v === false))

    const ok = await requireActiveStaff(
      makeStaffAdmin({ id: 'staff-1', role: ROLES.SUPER_ADMIN, full_name: 'Boss', is_active: true, branch_slug: null }),
      'jwt-1',
    )
    assert.equal(ok.id, 'staff-1')
  })

  it('validates phone/email, propagates Auth failures before DB write, tolerates legacy 404 Auth, and blocks partial deletes', async () => {
    function createHarness({ authUpdateErr = null, failChildTable = null } = {}) {
      const state = { customerUpdates: [], customerDeletes: 0, childDeletes: [] }
      const staffRow = { id: 'sa-1', role: ROLES.SUPER_ADMIN, full_name: 'Boss', is_active: true, permission_grants: null, branch_slug: null }
      const existingCustomer = {
        id: 'cust-1',
        role: 'customer',
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        full_name: 'Juan Dela Cruz',
        phone: '09171234567',
        email: 'juan@example.com',
        date_of_birth: null,
        notify_sms: true,
        notify_push: true,
        is_disabled: false,
      }

      const makeChain = (table) => {
        let op = 'select'
        let updatePayload = null
        let isCountHead = false
        let filterEqs = {}
        const chain = {
          select: (_cols, opts) => {
            if (opts?.count === 'exact' && opts?.head) isCountHead = true
            return chain
          },
          update: (payload) => {
            op = 'update'
            updatePayload = payload
            if (table === 'customers') state.customerUpdates.push(payload)
            return chain
          },
          delete: () => {
            op = 'delete'
            if (table === 'customers') state.customerDeletes += 1
            else state.childDeletes.push(table)
            return chain
          },
          insert: async () => ({ error: null }),
          eq: (col, val) => {
            filterEqs[col] = val
            return chain
          },
          neq: () => chain,
          ilike: () => chain,
          limit: () => chain,
          maybeSingle: async () => {
            if (table === 'staff_profiles') return { data: staffRow, error: null }
            if (table === 'customers' && op === 'select' && filterEqs.id === 'cust-1') return { data: existingCustomer, error: null }
            return { data: null, error: null }
          },
          single: async () => ({
            data: { ...existingCustomer, ...(updatePayload || {}) },
            error: null,
          }),
          then: (resolve, reject) => {
            let resPayload = { data: [], error: null, count: 0 }
            if (op === 'delete' && failChildTable === table) {
              resPayload = { data: null, error: { message: `FK block on ${table}` } }
            } else if (isCountHead) {
              resPayload = { count: 0, error: null }
            }
            return Promise.resolve(resPayload).then(resolve, reject)
          },
        }
        return chain
      }

      const admin = {
        auth: {
          getUser: async () => ({ data: { user: { id: 'sa-1' } }, error: null }),
          admin: {
            updateUserById: async () => ({ error: authUpdateErr }),
            deleteUser: async () => ({ error: null }),
          },
        },
        from: (table) => makeChain(table),
      }

      async function invoke(body) {
        let status = 200
        let rawBody = ''
        const res = {
          statusCode: 200,
          setHeader: () => {},
          end: (chunk) => {
            status = res.statusCode
            rawBody = String(chunk || '')
          },
        }
        await handleManageCustomerRequest(
          { method: 'POST', headers: {} },
          res,
          {
            getAccessToken: () => 'jwt-sa',
            getBody: async () => body,
            adminClient: () => admin,
          },
        )
        return { status, body: JSON.parse(rawBody || '{}'), state }
      }

      return { invoke, state }
    }

    const hBadPhone = createHarness()
    const badPhoneRes = await hBadPhone.invoke({ action: 'update', customer_id: 'cust-1', full_name: 'Juan', phone: '12345' })
    assert.equal(badPhoneRes.status, 400)
    assert.match(badPhoneRes.body.error, /valid PH mobile/i)

    const hBadEmail = createHarness()
    const badEmailRes = await hBadEmail.invoke({ action: 'update', customer_id: 'cust-1', full_name: 'Juan', email: 'not-an-email' })
    assert.equal(badEmailRes.status, 400)
    assert.match(badEmailRes.body.error, /valid email/i)

    const hAuthErr = createHarness({ authUpdateErr: { status: 500, message: 'Auth service down' } })
    const authErrRes = await hAuthErr.invoke({ action: 'update', customer_id: 'cust-1', full_name: 'Juan Updated' })
    assert.equal(authErrRes.status, 500)
    assert.equal(hAuthErr.state.customerUpdates.length, 0, 'customers must not update when Auth update fails')

    const hAuth404 = createHarness({ authUpdateErr: { status: 404, message: 'User not found' } })
    const auth404Res = await hAuth404.invoke({ action: 'update', customer_id: 'cust-1', full_name: 'Legacy Juan' })
    assert.equal(auth404Res.status, 200)
    assert.equal(hAuth404.state.customerUpdates.length, 1)

    const hChildFail = createHarness({ failChildTable: 'vehicle_maintenance_schedules' })
    const childFailRes = await hChildFail.invoke({ action: 'delete', customer_id: 'cust-1' })
    assert.equal(childFailRes.status, 409)
    assert.ok(hChildFail.state.childDeletes.includes('vehicle_maintenance_schedules'))
    assert.equal(hChildFail.state.customerDeletes, 0, 'customers.delete must not run when child cleanup errors')
  })
})
