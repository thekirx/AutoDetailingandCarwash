/**
 * Push API auth matrix probes (WEB_PUSH_AGENT_PLAYBOOK §11).
 */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { handleSendPushRequest } from '../server/pushApi.mjs'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
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
  assert.equal(r.status, 200, `anon+roles expected 200 got ${r.status} ${JSON.stringify(r.json)}`)
  assert.equal(r.json.ok, true)
}

console.log('push auth matrix: ok')
