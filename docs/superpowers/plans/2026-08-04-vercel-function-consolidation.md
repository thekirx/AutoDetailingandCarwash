# Vercel Function Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 15 filesystem-generated Vercel Functions with six domain gateways while preserving every existing API URL, query parameter, response, authorization check, and secret boundary.

**Architecture:** Six statically defined gateway entrypoints delegate to the existing server handlers through explicit per-domain operation maps. `vercel.json` rewrites legacy URLs to those gateways, appending one fixed `operation` value while Vercel forwards the caller's original query parameters. A shared dispatcher rejects missing, duplicate, unknown, and cross-domain operation values.

**Tech Stack:** Vite 6, Vercel Node.js Functions, Node.js ESM, Supabase JS 2.50, Node's built-in test runner.

## Global Constraints

- Final Vercel Function count must be 6 and must not exceed 12.
- Existing browser-facing `/api/...` URLs and request/response contracts must not change.
- `/api/plate-lookup?plate=ABC123` must arrive at the bookings gateway with exactly one `operation=plate-lookup` and the original `plate=ABC123`.
- Dispatch must use explicit fixed allowlists and static imports; never derive an import path from request input.
- Missing, duplicate, unknown, overridden, and cross-domain operations must return JSON `404`.
- Service-role, BusyBee, Resend, and VAPID secrets remain server-side.
- No UI, database schema, RLS, or Supabase Edge Function deployment changes.

---

### Task 1: Shared Safe Gateway Dispatcher

**Files:**
- Create: `server/apiGateway.mjs`
- Test: `tests/apiGateway.test.js`

**Interfaces:**
- Produces: `readGatewayOperation(req): string | null`
- Produces: `createGateway(operationHandlers: Readonly<Record<string, Function>>): (req, res) => Promise<void>`
- Consumes: Node/Vercel request `req.url` and response object `res`

- [ ] **Step 1: Write failing dispatcher tests**

Create `tests/apiGateway.test.js` with table-driven tests using real request URLs and real in-memory response objects. Assert these literal outcomes:

```js
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createGateway, readGatewayOperation } from '../server/apiGateway.mjs'

function response() {
  const out = { statusCode: 200, headers: {}, body: '' }
  return {
    out,
    setHeader(name, value) { out.headers[name] = value },
    end(body = '') { out.body = body },
    get statusCode() { return out.statusCode },
    set statusCode(value) { out.statusCode = value },
  }
}

describe('readGatewayOperation', () => {
  it('preserves the caller query while reading one fixed operation', () => {
    const req = { url: '/api/bookings?operation=plate-lookup&plate=ABC123' }
    assert.equal(readGatewayOperation(req), 'plate-lookup')
    assert.equal(new URL(req.url, 'http://localhost').searchParams.get('plate'), 'ABC123')
  })

  it('rejects a caller override that produces duplicate operations', () => {
    assert.equal(
      readGatewayOperation({ url: '/api/bookings?operation=public-book&operation=plate-lookup&plate=ABC123' }),
      null,
    )
  })
})

describe('createGateway', () => {
  it('runs only an explicitly allowlisted operation', async () => {
    const gateway = createGateway({
      'plate-lookup': async (_req, res) => {
        res.statusCode = 200
        res.end(JSON.stringify({ handler: 'plate-lookup' }))
      },
    })
    const res = response()
    await gateway({ url: '/api/bookings?operation=plate-lookup&plate=ABC123' }, res)
    assert.deepEqual(JSON.parse(res.out.body), { handler: 'plate-lookup' })
  })

  for (const url of [
    '/api/bookings',
    '/api/bookings?operation=send-push',
    '/api/bookings?operation=plate-lookup&operation=public-book',
  ]) {
    it(`returns 404 for unsafe dispatch ${url}`, async () => {
      const gateway = createGateway({ 'plate-lookup': async () => {} })
      const res = response()
      await gateway({ url }, res)
      assert.equal(res.out.statusCode, 404)
      assert.deepEqual(JSON.parse(res.out.body), { error: 'Not found' })
    })
  }
})
```

The production mutations these tests catch are: taking the first duplicate operation, dynamically accepting an unknown operation, or dropping an unrelated query parameter.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/apiGateway.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `server/apiGateway.mjs`.

- [ ] **Step 3: Implement the minimal dispatcher**

Create `server/apiGateway.mjs` with:

```js
import { json } from './httpUtil.mjs'

export function readGatewayOperation(req) {
  const url = new URL(req?.url || '/', 'http://localhost')
  const values = url.searchParams.getAll('operation')
  return values.length === 1 && values[0] ? values[0] : null
}

export function createGateway(operationHandlers) {
  const handlers = Object.freeze({ ...operationHandlers })
  return async function gateway(req, res) {
    const operation = readGatewayOperation(req)
    const handler = operation && Object.prototype.hasOwnProperty.call(handlers, operation)
      ? handlers[operation]
      : null
    if (!handler) return json(res, 404, { error: 'Not found' })
    return handler(req, res)
  }
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/apiGateway.test.js`

Expected: all dispatcher tests pass with zero failures.

- [ ] **Step 5: Commit**

```bash
git add server/apiGateway.mjs tests/apiGateway.test.js
git commit -m "test: define safe API gateway dispatch"
```

### Task 2: Six Explicit Domain Gateways

**Files:**
- Create: `server/busybeeApi.mjs`
- Create: `api/customer.js`
- Create: `api/staff.js`
- Create: `api/bookings.js`
- Create: `api/notifications.js`
- Create: `api/finance.js`
- Modify: `api/data-center.js`
- Test: `tests/apiGatewayRoutes.test.js`

**Interfaces:**
- Consumes: `createGateway()` from Task 1
- Produces fixed operation maps:
  - customer: `customer-auth-lookup`, `customer-portal`, `customer-signup`, `provision-customer`
  - staff: `provision-staff`, `update-staff`
  - bookings: `booking-status`, `plate-lookup`, `public-book`
  - notifications: `busybee`, `notify-booking`, `push-subscribe`, `send-push`
  - finance: `send-finance-quote`
  - data center: `data-center`

- [ ] **Step 1: Write failing gateway route tests**

Create `tests/apiGatewayRoutes.test.js`:

```js
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import customerGateway, { operations as customer } from '../api/customer.js'
import staffGateway, { operations as staff } from '../api/staff.js'
import bookingsGateway, { operations as bookings } from '../api/bookings.js'
import notificationsGateway, { operations as notifications } from '../api/notifications.js'
import financeGateway, { operations as finance } from '../api/finance.js'
import dataCenterGateway, { operations as dataCenter } from '../api/data-center.js'

function response() {
  const out = { statusCode: 200, headers: {}, body: '' }
  return {
    out,
    setHeader(name, value) { out.headers[name] = value },
    end(body = '') { out.body = body },
    get statusCode() { return out.statusCode },
    set statusCode(value) { out.statusCode = value },
  }
}

const domains = [
  ['customer', customerGateway, customer, ['customer-auth-lookup', 'customer-portal', 'customer-signup', 'provision-customer']],
  ['staff', staffGateway, staff, ['provision-staff', 'update-staff']],
  ['bookings', bookingsGateway, bookings, ['booking-status', 'plate-lookup', 'public-book']],
  ['notifications', notificationsGateway, notifications, ['busybee', 'notify-booking', 'push-subscribe', 'send-push']],
  ['finance', financeGateway, finance, ['send-finance-quote']],
  ['data-center', dataCenterGateway, dataCenter, ['data-center']],
]

describe('domain gateway allowlists', () => {
  for (const [name, gateway, operations, expected] of domains) {
    it(`${name} exposes exactly its fixed operation map`, () => {
      assert.deepEqual(Object.keys(operations).sort(), expected)
      assert.equal(Object.isFrozen(operations), true)
    })

    it(`${name} rejects a cross-domain operation`, async () => {
      const res = response()
      await gateway({ url: `/api/${name}?operation=not-in-${name}` }, res)
      assert.equal(res.out.statusCode, 404)
      assert.deepEqual(JSON.parse(res.out.body), { error: 'Not found' })
    })

    for (const operation of expected) {
      it(`${name} dispatches OPTIONS for ${operation}`, async () => {
        const res = response()
        await gateway({
          method: 'OPTIONS',
          url: `/api/${name}?operation=${operation}`,
          headers: { host: 'localhost:5173' },
        }, res)
        assert.equal(res.out.statusCode, 204)
      })
    }
  }
})
```

The production mutations these tests catch are: registering a handler under the wrong gateway, exposing an unrelated handler, or omitting a legacy operation.

- [ ] **Step 2: Run the route test and verify RED**

Run: `node --test tests/apiGatewayRoutes.test.js`

Expected: FAIL because the six gateway modules and exported operation maps do not exist.

- [ ] **Step 3: Move BusyBee HTTP authorization into server code**

Create `server/busybeeApi.mjs` by moving the complete handler body from `api/busybee.js` without changing its CORS, rate limit, bearer validation, allowed roles, Supabase service-role usage, BusyBee calls, or response status codes. Export it as `handleBusybeeRequest(req, res)`.

- [ ] **Step 4: Implement customer and staff gateways**

Use static imports and `Object.freeze` operation maps. Define this helper in both `api/customer.js` and `api/staff.js` so no utility file is added under `api/`:

```js
function forwardedSiteOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}
```

The complete customer operation map is:

```js
export const operations = Object.freeze({
  'customer-auth-lookup': (req, res) => {
    setCors(res, 'POST, OPTIONS')
    return handleCustomerAuthLookupRequest(req, res, {
      getBody: () => readJsonBody(req),
      siteOrigin: req.headers.origin || `https://${req.headers.host}`,
    })
  },
  'customer-portal': (req, res) => handleCustomerPortalRequest(req, res, {
    getAccessToken: () => bearer(req),
  }),
  'customer-signup': (req, res) => {
    setCors(res, 'POST, OPTIONS')
    return handleCustomerSignupRequest(req, res, { getBody: () => readJsonBody(req) })
  },
  'provision-customer': (req, res) => {
    setCors(res, 'POST, OPTIONS')
    return handleProvisionRequest(req, res, {
      siteOrigin: forwardedSiteOrigin(req),
      getBody: () => readJsonBody(req),
      getAccessToken: () => bearer(req),
    })
  },
})

export default createGateway(operations)
```

The complete staff operation map is:

```js
export const operations = Object.freeze({
  'provision-staff': (req, res) => {
    setCors(res, 'POST, OPTIONS')
    return handleProvisionStaffRequest(req, res, {
      siteOrigin: forwardedSiteOrigin(req),
      getBody: () => readJsonBody(req),
      getAccessToken: () => bearer(req),
    })
  },
  'update-staff': (req, res) => {
    setCors(res, 'POST, OPTIONS')
    return handleUpdateStaffRequest(req, res, {
      getBody: () => readJsonBody(req),
      getAccessToken: () => bearer(req),
    })
  },
})

export default createGateway(operations)
```

- [ ] **Step 5: Implement bookings, notifications, finance, and data-center gateways**

Each module exports its frozen `operations` object and defaults to `createGateway(operations)`. All imports are static. Use these exact maps:

```js
// api/bookings.js
export const operations = Object.freeze({
  'booking-status': handleBookingStatusRequest,
  'plate-lookup': handlePublicPlateLookup,
  'public-book': handlePublicBookRequest,
})

// api/notifications.js
export const operations = Object.freeze({
  busybee: handleBusybeeRequest,
  'notify-booking': handleNotifyBookingRequest,
  'push-subscribe': handlePushSubscribeRequest,
  'send-push': handleSendPushRequest,
})

// api/finance.js
export const operations = Object.freeze({
  'send-finance-quote': (req, res) => handleFinanceQuoteRequest(req, res, {
    getBody: () => readJsonBody(req),
    getAccessToken: () => bearer(req),
  }),
})

// api/data-center.js
export const operations = Object.freeze({
  'data-center': handleDataCenterRequest,
})
```

Append `export default createGateway(operations)` in each file.

- [ ] **Step 6: Run focused gateway tests and verify GREEN**

Run: `node --test tests/apiGateway.test.js tests/apiGatewayRoutes.test.js`

Expected: all tests pass with zero failures.

- [ ] **Step 7: Commit**

```bash
git add api/customer.js api/staff.js api/bookings.js api/notifications.js api/finance.js api/data-center.js server/busybeeApi.mjs tests/apiGatewayRoutes.test.js
git commit -m "feat: add six explicit API gateways"
```

### Task 3: Preserve Legacy URLs Through Fixed Rewrites

**Files:**
- Modify: `vercel.json`
- Delete: the 14 superseded legacy entrypoints in `api/` other than the modified `api/data-center.js`
- Test: `tests/vercelFunctionRouting.test.js`

**Interfaces:**
- Consumes: six gateway entrypoints from Task 2
- Produces: 15 unchanged public legacy routes with fixed destination operation values

- [ ] **Step 1: Write the failing routing contract test**

Create `tests/vercelFunctionRouting.test.js` that parses `vercel.json`, builds a literal expected object of all mappings, and compares it to the configured API rewrites:

```js
const expected = {
  '/api/booking-status': '/api/bookings?operation=booking-status',
  '/api/busybee': '/api/notifications?operation=busybee',
  '/api/customer-auth-lookup': '/api/customer?operation=customer-auth-lookup',
  '/api/customer-portal': '/api/customer?operation=customer-portal',
  '/api/customer-signup': '/api/customer?operation=customer-signup',
  '/api/data-center': '/api/data-center?operation=data-center',
  '/api/notify-booking': '/api/notifications?operation=notify-booking',
  '/api/plate-lookup': '/api/bookings?operation=plate-lookup',
  '/api/provision-customer': '/api/customer?operation=provision-customer',
  '/api/provision-staff': '/api/staff?operation=provision-staff',
  '/api/public-book': '/api/bookings?operation=public-book',
  '/api/push-subscribe': '/api/notifications?operation=push-subscribe',
  '/api/send-finance-quote': '/api/finance?operation=send-finance-quote',
  '/api/send-push': '/api/notifications?operation=send-push',
  '/api/update-staff': '/api/staff?operation=update-staff',
}
```

The test also enumerates deployable `api/*.js` files and asserts the literal sorted list `bookings.js`, `customer.js`, `data-center.js`, `finance.js`, `notifications.js`, `staff.js`. Finally, simulate Vercel's documented query forwarding for `/api/plate-lookup?plate=ABC123` and assert the destination contains exactly `operation=plate-lookup` and `plate=ABC123`.

- [ ] **Step 2: Run the routing test and verify RED**

Run: `node --test tests/vercelFunctionRouting.test.js`

Expected: FAIL because `vercel.json` has no API rewrites and `api/` still contains 15 files.

- [ ] **Step 3: Add fixed rewrites before the SPA fallback**

Modify `vercel.json` so the 15 exact API rewrites from the expected object appear before `{ "source": "/((?!api/).*)", "destination": "/index.html" }`. Do not add a wildcard API rewrite. Exact sources ensure a caller cannot choose a destination gateway through a captured path value.

- [ ] **Step 4: Delete superseded entrypoints**

Delete:

```text
api/booking-status.js
api/busybee.js
api/customer-auth-lookup.js
api/customer-portal.js
api/customer-signup.js
api/notify-booking.js
api/plate-lookup.js
api/provision-customer.js
api/provision-staff.js
api/public-book.js
api/push-subscribe.js
api/send-finance-quote.js
api/send-push.js
api/update-staff.js
```

Keep only the six gateway entrypoints.

- [ ] **Step 5: Run the routing test and verify GREEN**

Run: `node --test tests/vercelFunctionRouting.test.js`

Expected: all routing assertions pass, including the retained `plate` query parameter and six-file count.

- [ ] **Step 6: Run all gateway and routing tests**

Run: `node --test tests/apiGateway.test.js tests/apiGatewayRoutes.test.js tests/vercelFunctionRouting.test.js`

Expected: zero failures.

- [ ] **Step 7: Commit**

```bash
git add vercel.json api tests/vercelFunctionRouting.test.js
git commit -m "fix: consolidate Vercel functions behind fixed rewrites"
```

### Task 4: Full Verification and Function Count

**Files:**
- Modify only if verification exposes a defect in the consolidation files above.

**Interfaces:**
- Verifies the entire repository and Vercel production artifact.

- [ ] **Step 1: Run every local test**

Run: `node --test tests/*.test.js`

Expected: zero failed tests. Tests that require live credentials must be reported separately if the repository already treats them as environment-dependent scripts.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit code 0 with no lint errors.

- [ ] **Step 3: Run the application production build**

Run: `npm run build`

Expected: Vite production build exits 0 and produces `dist/`.

- [ ] **Step 4: Build the Vercel production artifact**

Run: `vercel build --prod`

Expected: exit code 0 and `.vercel/output/functions` contains exactly six `.func` directories.

- [ ] **Step 5: Inspect the generated routes and count functions**

Run:

```bash
find .vercel/output/functions -type d -name '*.func' -maxdepth 2 | sort
find .vercel/output/functions -type d -name '*.func' -maxdepth 2 | wc -l
```

Expected generated functions:

```text
api/bookings.func
api/customer.func
api/data-center.func
api/finance.func
api/notifications.func
api/staff.func
```

Expected count: `6`.

- [ ] **Step 6: Review the final diff and security boundaries**

Run: `git diff HEAD~3 --check` and `git status --short`.

Confirm no frontend files, Supabase migrations, Edge Functions, or environment files changed; all service-role and provider-secret imports remain under `server/` or `api/`.

- [ ] **Step 7: Commit any verification-only correction, if one was required**

Only if a verification defect required a code correction, repeat its focused RED/GREEN test and commit the correction with a message naming that defect. Otherwise make no additional commit.
