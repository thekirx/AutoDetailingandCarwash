import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createGateway, readGatewayOperation } from '../server/apiGateway.mjs'

function response() {
  const out = { statusCode: 200, headers: {}, body: '' }
  return {
    out,
    setHeader(name, value) {
      out.headers[name] = value
    },
    end(body = '') {
      out.body = body
    },
    get statusCode() {
      return out.statusCode
    },
    set statusCode(value) {
      out.statusCode = value
    },
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
      readGatewayOperation({
        url: '/api/bookings?operation=public-book&operation=plate-lookup&plate=ABC123',
      }),
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
