import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { operations } from '../api/customer.js'

/* The handler builds its Supabase client at call time from env, so these cases
   stop before the insert — they cover the perimeter that runs first: method,
   kind, spam guard, and field validation. */
function mockRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v },
    end(payload) { this.body = payload ? JSON.parse(payload) : null },
  }
  return res
}

function mockReq(body, method = 'POST') {
  const json = JSON.stringify(body)
  return {
    method,
    url: '/api/customer?operation=public-inquiry',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250) + 1}` },
    async *[Symbol.asyncIterator]() { yield Buffer.from(json) },
    on(event, cb) {
      if (event === 'data') cb(Buffer.from(json))
      if (event === 'end') cb()
      return this
    },
  }
}

const ok = { openedAt: 0, elapsedMs: 5000 }

async function call(body, method) {
  const res = mockRes()
  await operations['public-inquiry'](mockReq(body, method), res)
  return res
}

describe('Public inquiry API', () => {
  it('is registered on the customer gateway', () => {
    assert.equal(typeof operations['public-inquiry'], 'function')
  })

  it('rejects a method other than POST', async () => {
    const res = await call({ kind: 'partnership' }, 'GET')
    assert.equal(res.statusCode, 405)
  })

  it('rejects an unknown inquiry kind', async () => {
    const res = await call({ kind: 'nonsense', ...ok })
    assert.equal(res.statusCode, 400)
    assert.match(res.body.error, /Unknown inquiry type/)
  })

  it('drops a submission with a filled honeypot', async () => {
    const res = await call({ kind: 'partnership', honeypot: 'bot', ...ok })
    assert.equal(res.statusCode, 400)
    assert.match(res.body.error, /Unable to submit/)
  })

  it('drops a submission returned faster than a person could type', async () => {
    const res = await call({ kind: 'partnership', elapsedMs: 100 })
    assert.equal(res.statusCode, 400)
    assert.match(res.body.error, /wait a moment/)
  })

  it('requires the partnership fields', async () => {
    const res = await call({ kind: 'partnership', name: 'Only a name', ...ok })
    assert.equal(res.statusCode, 400)
    assert.match(res.body.error, /required/)
  })

  it('rejects a malformed partnership email', async () => {
    const res = await call({
      kind: 'partnership',
      name: 'Site Owner',
      email: 'not-an-email',
      contactNumber: '09150000000',
      city: 'Bacoor',
      message: 'We have a lot available.',
      ...ok,
    })
    assert.equal(res.statusCode, 400)
    assert.match(res.body.error, /valid email/)
  })

  it('requires the complaint fields', async () => {
    const res = await call({ kind: 'complaint', customerName: 'Someone', ...ok })
    assert.equal(res.statusCode, 400)
    assert.match(res.body.error, /required/)
  })

  it('no longer accepts contact submissions — the form was removed', async () => {
    const res = await call({ kind: 'contact', name: 'A', phone: 'B', subject: 'C', message: 'D', ...ok })
    assert.equal(res.statusCode, 400)
    assert.match(res.body.error, /Unknown inquiry type/)
  })
})
