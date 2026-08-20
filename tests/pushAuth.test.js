/**
 * Push auth matrix (staff required for send).
 */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { handleSendPushRequest } from '../server/pushApi.mjs'

for (const envFile of ['.env', '.env.local']) {
  if (!existsSync(envFile)) continue
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1)
    if (!process.env[k]) process.env[k] = v
  }
}

function mockReq(method, body, headers = {}) {
  return {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body,
  }
}

function mockRes() {
  const out = { statusCode: 200, headers: {}, body: null }
  return {
    out,
    get statusCode() {
      return out.statusCode
    },
    set statusCode(v) {
      out.statusCode = v
    },
    setHeader(k, v) {
      out.headers[k] = v
    },
    end(payload) {
      out.body = payload
    },
  }
}

async function call(body, headers = {}) {
  const req = mockReq('POST', body, headers)
  const res = mockRes()
  await handleSendPushRequest(req, res)
  const json = JSON.parse(res.out.body || '{}')
  return { status: res.out.statusCode, json }
}

{
  const r = await call({
    targets: [{ userId: '11111111-1111-1111-1111-111111111111' }],
    title: 't',
    body: 'b',
  })
  assert.equal(r.status, 403, `anon+userId expected 403 got ${r.status}`)
}

{
  const r = await call({
    targets: [{ roles: ['admin'] }],
    title: 'Ops ping',
    body: 'Fan-out probe',
    url: '/operations',
    tag: 'probe-ops',
  })
  assert.equal(r.status, 403, `anon+roles expected 403 got ${r.status}`)
}

/* The service-role fan-out needs a real secret. It runs in CI, where the key is
   set; locally it is skipped rather than failing the whole suite for a missing
   credential that is deliberately not in the repo. */
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('skip: service-role fan-out (SUPABASE_SERVICE_ROLE_KEY not set)')
} else {
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  const r = await call(
    {
      targets: [{ roles: ['admin'] }],
      title: 'Ops ping',
      body: 'Service fan-out probe',
      url: '/operations',
      tag: 'probe-ops-service',
    },
    { authorization: `Bearer ${service}` },
  )
  assert.equal(r.status, 200, `service+roles expected 200 got ${r.status} ${JSON.stringify(r.json)}`)
  assert.equal(r.json.ok, true)
}

{
  const r = await call({ selfTest: true, title: 't', body: 'b' })
  assert.equal(r.status, 401, `anon selfTest expected 401 got ${r.status}`)
}

console.log('push auth matrix: ok')
