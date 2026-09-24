import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach } from 'node:test'
import { Readable } from 'node:stream'
import { handleBusybeeRelayRequest } from '../server/busybeeRelayHandler.mjs'

function mockReqRes(method, bodyObj) {
  const payload = bodyObj == null ? '' : JSON.stringify(bodyObj)
  const req = Readable.from([Buffer.from(payload)])
  req.method = method
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(k, v) {
      this.headers[k] = v
    },
    end(s) {
      this.body = s || ''
    },
  }
  return { req, res }
}

describe('BusyBee relay handler (fixed-egress host)', () => {
  const prevSecret = process.env.BUSYBEE_RELAY_SECRET
  const prevKey = process.env.BUSYBEE_API_KEY
  const prevClient = process.env.BUSYBEE_CLIENT_ID

  beforeEach(() => {
    process.env.BUSYBEE_RELAY_SECRET = 'relay-secret'
    process.env.BUSYBEE_API_KEY = 'k'
    process.env.BUSYBEE_CLIENT_ID = 'c'
  })

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.BUSYBEE_RELAY_SECRET
    else process.env.BUSYBEE_RELAY_SECRET = prevSecret
    if (prevKey === undefined) delete process.env.BUSYBEE_API_KEY
    else process.env.BUSYBEE_API_KEY = prevKey
    if (prevClient === undefined) delete process.env.BUSYBEE_CLIENT_ID
    else process.env.BUSYBEE_CLIENT_ID = prevClient
  })

  it('rejects wrong secret with 401', async () => {
    const { req, res } = mockReqRes('POST', { phone: '09625294043', message: 'x', secret: 'wrong' })
    await handleBusybeeRelayRequest(req, res)
    assert.equal(res.statusCode, 401)
    assert.equal(JSON.parse(res.body).ok, false)
  })

  it('rejects missing secret with 401', async () => {
    const { req, res } = mockReqRes('POST', { phone: '09625294043', message: 'x' })
    await handleBusybeeRelayRequest(req, res)
    assert.equal(res.statusCode, 401)
  })
})
