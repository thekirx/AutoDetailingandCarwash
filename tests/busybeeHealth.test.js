import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { busybeeProviderStatusLabel } from '../src/lib/busybeeHealth.js'

describe('busybeeProviderStatusLabel', () => {
  it('returns null when health missing', () => {
    assert.equal(busybeeProviderStatusLabel(null), null)
  })

  it('shows credits when connected', () => {
    const label = busybeeProviderStatusLabel({
      ok: true,
      json: { ErrorCode: 0, Data: [{ Credits: 42 }] },
    })
    assert.equal(label.tone, 'ok')
    assert.match(label.text, /42/)
  })

  it('maps ErrorCode 11 to IP whitelist copy', () => {
    const label = busybeeProviderStatusLabel({
      ok: false,
      status: 200,
      json: { ErrorCode: 11, ErrorDescription: 'Unauthorized IP address' },
    })
    assert.equal(label.tone, 'warn')
    assert.match(label.text, /IP not whitelisted/i)
  })

  it('maps rate limit', () => {
    const label = busybeeProviderStatusLabel({ ok: false, http: 429 })
    assert.equal(label.tone, 'warn')
    assert.match(label.text, /rate-limited/i)
  })
})
