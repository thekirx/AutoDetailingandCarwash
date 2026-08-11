import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createGateway } from '../server/apiGateway.mjs'
import { json, setCors } from '../server/httpUtil.mjs'

function mockRes() {
  const out = { statusCode: 200, headers: {}, body: null }
  return {
    out,
    setHeader(k, v) {
      out.headers[k] = v
    },
    end(payload) {
      out.body = payload
    },
    get statusCode() {
      return out.statusCode
    },
    set statusCode(v) {
      out.statusCode = v
    },
  }
}

describe('API CORS', () => {
  it('puts allow-origin on every JSON response', () => {
    const res = mockRes()
    json(res, 401, { error: 'nope' })
    assert.ok(res.out.headers['Access-Control-Allow-Origin'])
    assert.match(String(res.out.headers['Access-Control-Allow-Headers'] || ''), /authorization/i)
  })

  it('echoes a browser Origin so credentialed PWA calls are not blocked', () => {
    const res = mockRes()
    setCors(res, 'POST, OPTIONS', { headers: { origin: 'https://hakumautocare.com' } })
    assert.equal(res.out.headers['Access-Control-Allow-Origin'], 'https://hakumautocare.com')
    assert.equal(res.out.headers['Access-Control-Allow-Credentials'], 'true')
  })

  it('answers gateway OPTIONS and 404 with CORS', async () => {
    const gateway = createGateway({ ping: async (_req, res) => json(res, 200, { ok: true }) })
    const preflight = mockRes()
    await gateway(
      { method: 'OPTIONS', url: '/api/notifications?operation=push-subscribe', headers: { origin: 'https://app.example' } },
      preflight,
    )
    assert.equal(preflight.out.statusCode, 204)
    assert.equal(preflight.out.headers['Access-Control-Allow-Origin'], 'https://app.example')

    const missing = mockRes()
    await gateway({ method: 'POST', url: '/api/notifications', headers: { origin: 'https://app.example' } }, missing)
    assert.equal(missing.out.statusCode, 404)
    assert.equal(missing.out.headers['Access-Control-Allow-Origin'], 'https://app.example')
  })
})
